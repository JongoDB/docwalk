/**
 * DocWalk Try-It Proxy — Cloudflare Worker
 *
 * Accepts a public GitHub repo URL, validates it, rate-limits,
 * and dispatches the try-docwalk.yml workflow via the GitHub API.
 * Returns the expected result URL for the frontend to poll.
 *
 * Also provides GET /status/:slug for real-time build progress.
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
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Visitor-FP",
    "Access-Control-Max-Age": "86400",
  };
}

// ─── GitHub Actions status endpoint ─────────────────────────────────────────

interface WorkflowRun {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
}

interface JobStep {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
}

interface Job {
  id: number;
  status: string;
  conclusion: string | null;
  steps?: JobStep[];
}

async function ghApi(path: string, pat: string): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "docwalk-try-proxy/1.0",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
}

async function handleStatus(
  slug: string,
  sinceMs: number,
  env: Env,
  headers: Record<string, string>,
): Promise<Response> {
  // Find recent workflow_dispatch runs
  const runsRes = await ghApi(
    `/repos/${env.REPO_OWNER}/${env.REPO_NAME}/actions/runs?event=workflow_dispatch&per_page=10`,
    env.GITHUB_PAT,
  );

  if (!runsRes.ok) {
    return Response.json(
      { status: "unknown", error: "Failed to query GitHub Actions" },
      { status: 502, headers },
    );
  }

  const runsData = (await runsRes.json()) as { workflow_runs: WorkflowRun[] };

  // Use the `since` timestamp from the frontend to find the correct run.
  // This avoids depending on in-memory state which doesn't survive across
  // CF Worker instances. We look for a run created after (or near) the
  // dispatch time — this is the run the frontend triggered.
  let matchedRun: WorkflowRun | undefined;

  if (sinceMs) {
    // Find the run created closest to (and after) the dispatch time
    for (const run of runsData.workflow_runs) {
      const runCreated = new Date(run.created_at).getTime();
      // Run must have been created within 2 minutes after dispatch
      // (accounts for GitHub queue delay)
      if (runCreated >= sinceMs - 5_000 && runCreated <= sinceMs + 120_000) {
        matchedRun = run;
        break;
      }
    }
  }

  // Fallback: use in-memory dispatch time if frontend didn't send `since`
  if (!matchedRun) {
    const dispatchTime = recentDispatches.get(slug);
    if (dispatchTime) {
      for (const run of runsData.workflow_runs) {
        const runCreated = new Date(run.created_at).getTime();
        if (Math.abs(runCreated - dispatchTime) < 30_000) {
          matchedRun = run;
          break;
        }
      }
    }
  }

  // Last resort: pick the most recent in_progress or queued run only
  // (never match a completed run — that could be from a previous build)
  if (!matchedRun) {
    matchedRun = runsData.workflow_runs.find(
      (r) => r.status === "in_progress" || r.status === "queued",
    );
  }

  if (!matchedRun) {
    // No active run found — either still queuing or already finished.
    // Return "queued" so the frontend keeps polling. The frontend's own
    // result URL check will catch the completed case.
    return Response.json(
      { status: "queued", current_step: null, steps_completed: 0, steps_total: 0, elapsed_seconds: 0 },
      { headers },
    );
  }

  // Get job details for step-level progress
  const jobsRes = await ghApi(
    `/repos/${env.REPO_OWNER}/${env.REPO_NAME}/actions/runs/${matchedRun.id}/jobs`,
    env.GITHUB_PAT,
  );

  if (!jobsRes.ok) {
    return Response.json(
      {
        status: matchedRun.status === "completed"
          ? (matchedRun.conclusion === "success" ? "completed" : "failed")
          : matchedRun.status,
        current_step: null,
        steps_completed: 0,
        steps_total: 0,
        elapsed_seconds: Math.round((Date.now() - new Date(matchedRun.created_at).getTime()) / 1000),
      },
      { headers },
    );
  }

  const jobsData = (await jobsRes.json()) as { jobs: Job[] };
  const job = jobsData.jobs[0];

  if (!job || !job.steps) {
    return Response.json(
      {
        status: matchedRun.status,
        current_step: null,
        steps_completed: 0,
        steps_total: 0,
        elapsed_seconds: Math.round((Date.now() - new Date(matchedRun.created_at).getTime()) / 1000),
      },
      { headers },
    );
  }

  const completedSteps = job.steps.filter((s) => s.status === "completed").length;
  const currentStep = job.steps.find((s) => s.status === "in_progress");
  const elapsed = Math.round((Date.now() - new Date(matchedRun.created_at).getTime()) / 1000);

  let status: string;
  if (job.status === "completed") {
    status = job.conclusion === "success" ? "completed" : "failed";
  } else {
    status = job.status; // "queued" | "in_progress"
  }

  return Response.json(
    {
      status,
      current_step: currentStep?.name || null,
      steps_completed: completedSteps,
      steps_total: job.steps.length,
      elapsed_seconds: elapsed,
    },
    { headers },
  );
}

// ─── Worker handler ─────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    // Route: GET /status/:slug?since=<timestamp>
    const statusMatch = url.pathname.match(/^\/status\/([A-Za-z0-9._-]+)$/);
    if (request.method === "GET" && statusMatch) {
      const sinceParam = url.searchParams.get("since");
      const sinceMs = sinceParam ? parseInt(sinceParam, 10) : 0;
      return handleStatus(statusMatch[1], sinceMs, env, headers);
    }

    // Only accept POST for dispatch
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
