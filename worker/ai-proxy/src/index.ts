/**
 * DocWalk AI Proxy — Cloudflare Worker
 *
 * Forwards AI generation requests to Groq (OpenAI-compatible API)
 * so the CLI can offer zero-config AI features without users needing their own key.
 *
 * POST /v1/generate  { prompt, maxTokens?, temperature?, systemPrompt? }
 * → { text: string }
 *
 * Rate limit: 20 req/min per IP (in-memory, resets on worker restart).
 */

interface Env {
  GROQ_API_KEY: string;
  ALLOWED_ORIGINS: string;
}

// ─── In-memory rate limiter (per-worker instance) ────────────────────────────

const ipRequests = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = ipRequests.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  ipRequests.set(ip, recent);

  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  return false;
}

// ─── CORS ────────────────────────────────────────────────────────────────────

function corsHeaders(origin: string, allowedOrigins: string): Record<string, string> {
  const allowed = allowedOrigins === "*" || allowedOrigins.split(",").map((s) => s.trim()).includes(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

// ─── Groq API (OpenAI-compatible) ───────────────────────────────────────────

interface GroqMessage {
  role: "system" | "user";
  content: string;
}

async function callGroq(
  apiKey: string,
  messages: GroqMessage[],
  maxTokens?: number,
  temperature?: number,
): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages,
      ...(maxTokens && { max_tokens: maxTokens }),
      ...(temperature !== undefined && { temperature }),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from Groq");
  return text;
}

// ─── Worker handler ──────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin, env.ALLOWED_ORIGINS);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    // Route: POST /v1/generate
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/v1/generate") {
      return Response.json(
        { error: "Not found. Use POST /v1/generate" },
        { status: 404, headers },
      );
    }

    // Rate limit by IP
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (isRateLimited(ip)) {
      return Response.json(
        { error: "Rate limited. Max 20 requests per minute." },
        { status: 429, headers: { ...headers, "Retry-After": "60" } },
      );
    }

    // Parse request body
    let body: { prompt?: string; maxTokens?: number; temperature?: number; systemPrompt?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400, headers });
    }

    const { prompt, maxTokens, temperature, systemPrompt } = body;
    if (!prompt || typeof prompt !== "string") {
      return Response.json({ error: "Missing 'prompt' field" }, { status: 400, headers });
    }

    // Build messages array
    const messages: GroqMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    // Forward to Groq
    try {
      const text = await callGroq(env.GROQ_API_KEY, messages, maxTokens, temperature);
      return Response.json({ text }, { headers });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Groq call failed:", message);
      return Response.json({ error: message }, { status: 502, headers });
    }
  },
};
