/**
 * DocWalk Try-It Proxy — Cloudflare Worker
 *
 * Accepts a public GitHub repo URL, validates it, rate-limits,
 * and dispatches the try-docwalk.yml workflow via the GitHub API.
 * Returns the expected result URL for the frontend to poll.
 *
 * Rate limiting:
 * - 1 dispatch per repo per minute
 * - 5 global dispatches per minute
 * - 1 dispatch per browser fingerprint (ever)
 */

interface Env {
  GITHUB_PAT: string;
  ALLOWED_ORIGIN: string;
  REPO_OWNER: string;
  REPO_NAME: string;
  WORKFLOW_FILE: string;
}

// Simple in-memory rate limiter (per-worker instance)
const recentDispatches = new Map<string, number>();
const RATE_LIMIT_MS = 60_000; // 1 dispatch per repo per minute
const MAX_DISPATCHES_PER_MINUTE = 5; // global cap
let globalDispatchCount = 0;
let globalWindowStart = Date.now();

// Fingerprint tracking — one try per visitor (in-memory, resets on worker restart)
const usedFingerprints = new Map<string, { slug: string; ts: number }>();

function corsHeaders(origin: string, allowedOrigin: string): Record<string, string> {
  const allowed = origin === allowedOrigin || allowedOrigin === "*";
  return {
    "Access-Control-Allow-Origin": allowed ? origin : allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Visitor-FP",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    // Only accept POST
    if (request.method !== "POST") {
      return Response.json(
        { error: "Method not allowed" },
        { status: 405, headers }
      );
    }

    // Parse body
    let body: { repo_url?: string; branch?: string; theme?: string; layout?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Invalid JSON body" },
        { status: 400, headers }
      );
    }

    const { repo_url, branch = "", theme = "developer", layout = "tabs" } = body;

    // Validate repo URL
    if (!repo_url || typeof repo_url !== "string") {
      return Response.json(
        { error: "Missing repo_url" },
        { status: 400, headers }
      );
    }

    const match = repo_url.match(
      /^https?:\/\/github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)\/?$/
    );
    if (!match) {
      return Response.json(
        { error: "Invalid GitHub repo URL. Expected: https://github.com/owner/repo" },
        { status: 400, headers }
      );
    }

    const slug = `${match[1]}-${match[2]}`;

    // Fingerprint rate limiting
    const fingerprint = request.headers.get("X-Visitor-FP");
    if (fingerprint && fingerprint !== "fp-unknown") {
      const prev = usedFingerprints.get(fingerprint);
      if (prev) {
        const prevUrl = `https://jongodb.github.io/docwalk/try/${prev.slug}/`;
        return Response.json(
          {
            error: "You've already used your free demo.",
            previous_result: prevUrl,
            slug: prev.slug,
          },
          { status: 429, headers }
        );
      }
    }

    // Rate limit: per-repo
    const now = Date.now();
    const lastDispatch = recentDispatches.get(slug);
    if (lastDispatch && now - lastDispatch < RATE_LIMIT_MS) {
      const retryAfter = Math.ceil((RATE_LIMIT_MS - (now - lastDispatch)) / 1000);
      return Response.json(
        { error: `Rate limited. Try again in ${retryAfter}s.`, retry_after: retryAfter },
        { status: 429, headers: { ...headers, "Retry-After": String(retryAfter) } }
      );
    }

    // Rate limit: global
    if (now - globalWindowStart > 60_000) {
      globalDispatchCount = 0;
      globalWindowStart = now;
    }
    if (globalDispatchCount >= MAX_DISPATCHES_PER_MINUTE) {
      return Response.json(
        { error: "Service busy. Try again in a minute." },
        { status: 429, headers: { ...headers, "Retry-After": "60" } }
      );
    }

    // Dispatch workflow
    const dispatchUrl = `https://api.github.com/repos/${env.REPO_OWNER}/${env.REPO_NAME}/actions/workflows/${env.WORKFLOW_FILE}/dispatches`;

    const ghResponse = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_PAT}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "docwalk-try-proxy/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: "master",
        inputs: {
          repo_url,
          branch,
          theme,
          layout,
        },
      }),
    });

    if (!ghResponse.ok) {
      const errorText = await ghResponse.text();
      console.error(`GitHub API error: ${ghResponse.status} ${errorText}`);
      return Response.json(
        { error: "Failed to dispatch workflow. The repo may not be public or accessible." },
        { status: 502, headers }
      );
    }

    // Track for rate limiting
    recentDispatches.set(slug, now);
    globalDispatchCount++;

    // Track fingerprint
    if (fingerprint && fingerprint !== "fp-unknown") {
      usedFingerprints.set(fingerprint, { slug, ts: now });
    }

    // Clean up old entries (keep fingerprints for 24h)
    for (const [key, ts] of recentDispatches) {
      if (now - ts > RATE_LIMIT_MS * 10) recentDispatches.delete(key);
    }
    for (const [key, data] of usedFingerprints) {
      if (now - data.ts > 86_400_000) usedFingerprints.delete(key);
    }

    const resultUrl = `https://jongodb.github.io/docwalk/try/${slug}/`;

    return Response.json(
      {
        status: "dispatched",
        slug,
        result_url: resultUrl,
        message: "Build dispatched. Documentation will be available shortly.",
      },
      { status: 200, headers }
    );
  },
};
