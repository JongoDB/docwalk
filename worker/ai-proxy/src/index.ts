/**
 * DocWalk AI Proxy — Cloudflare Worker
 *
 * Forwards AI generation requests to Groq (OpenAI-compatible API)
 * so the CLI can offer zero-config AI features without users needing their own key.
 *
 * Endpoints:
 *   POST /v1/generate       — Non-streaming text generation (existing)
 *   POST /v1/qa/stream      — SSE-streaming Q&A answers from context chunks
 *
 * Rate limit: 20 req/min per IP for generate, 10 req/min for Q&A.
 */

interface Env {
  GROQ_API_KEY: string;
  ALLOWED_ORIGINS: string;
}

// ─── In-memory rate limiter (per-worker instance) ────────────────────────────

const ipRequests = new Map<string, number[]>();
const qaIpRequests = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const QA_RATE_LIMIT_MAX = 10;

function isRateLimited(ip: string, store: Map<string, number[]>, max: number): boolean {
  const now = Date.now();
  const timestamps = store.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  store.set(ip, recent);

  if (recent.length >= max) return true;
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
  role: "system" | "user" | "assistant";
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

/**
 * Call Groq with streaming enabled. Returns the raw Response for SSE forwarding.
 */
async function callGroqStream(
  apiKey: string,
  messages: GroqMessage[],
  maxTokens?: number,
  temperature?: number,
): Promise<Response> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages,
      stream: true,
      ...(maxTokens && { max_tokens: maxTokens }),
      ...(temperature !== undefined && { temperature }),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText}`);
  }

  return res;
}

// ─── Q&A System Prompt ───────────────────────────────────────────────────────

const QA_SYSTEM_PROMPT = `You are a helpful documentation assistant for a software project. Answer questions based ONLY on the provided context from the project's documentation.

Rules:
- If the context doesn't contain enough information to answer, say "I don't have enough information in the documentation to answer that."
- Keep answers concise: 2-4 paragraphs maximum.
- Use code examples from the context when relevant.
- Reference source pages when citing specific information (e.g. "According to the Getting Started guide...").
- Use markdown formatting for code blocks, bold, and lists.
- Never invent information or speculate beyond what's in the context.`;

// ─── Q&A Streaming Handler ───────────────────────────────────────────────────

interface QAChunk {
  content: string;
  pagePath: string;
  pageTitle: string;
  heading?: string;
}

interface QARequestBody {
  question: string;
  chunks: QAChunk[];
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

async function handleQAStream(
  request: Request,
  env: Env,
  headers: Record<string, string>,
): Promise<Response> {
  let body: QARequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers });
  }

  const { question, chunks, history } = body;
  if (!question || typeof question !== "string") {
    return Response.json({ error: "Missing 'question' field" }, { status: 400, headers });
  }
  if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
    return Response.json({ error: "Missing 'chunks' array" }, { status: 400, headers });
  }

  // Build context from chunks
  const contextParts = chunks.map((c, i) => {
    const source = c.heading ? `${c.pageTitle} > ${c.heading}` : c.pageTitle;
    return `[Source ${i + 1}: ${source}]\n${c.content}`;
  });
  const context = contextParts.join("\n\n---\n\n");

  // Build messages: system + history + context + question
  const messages: GroqMessage[] = [
    { role: "system", content: QA_SYSTEM_PROMPT },
  ];

  // Add conversation history (capped at last 3 exchanges = 6 messages)
  if (history && Array.isArray(history)) {
    const capped = history.slice(-6);
    for (const msg of capped) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
  }

  // Add current question with context
  messages.push({
    role: "user",
    content: `Context from project documentation:\n\n${context}\n\n---\n\nQuestion: ${question}`,
  });

  // Stream response from Groq
  try {
    const groqRes = await callGroqStream(env.GROQ_API_KEY, messages, 1024, 0.3);

    if (!groqRes.body) {
      throw new Error("No response body from Groq");
    }

    // Transform Groq's SSE stream into our format
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const reader = groqRes.body.getReader();
    let fullText = "";

    const stream = new ReadableStream({
      async pull(controller) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Extract citations from the full response
            const citations = extractCitations(chunks, fullText);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ done: true, citations })}\n\n`)
            );
            controller.close();
            return;
          }

          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const token = parsed.choices?.[0]?.delta?.content;
              if (token) {
                fullText += token;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
                );
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      },
      cancel() {
        reader.cancel();
      },
    });

    return new Response(stream, {
      headers: {
        ...headers,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Q&A stream failed:", message);
    return Response.json({ error: message }, { status: 502, headers });
  }
}

/**
 * Extract cited source pages from the LLM's answer text.
 * Looks for page titles mentioned in the response.
 */
function extractCitations(
  chunks: QAChunk[],
  answer: string,
): Array<{ pageTitle: string; pagePath: string }> {
  const seen = new Set<string>();
  const citations: Array<{ pageTitle: string; pagePath: string }> = [];
  const lowerAnswer = answer.toLowerCase();

  for (const chunk of chunks) {
    if (seen.has(chunk.pagePath)) continue;
    // Check if the page title or heading is referenced in the answer
    const titleWords = chunk.pageTitle.toLowerCase().split(/\s+/);
    const significant = titleWords.filter((w) => w.length > 3);
    if (significant.length > 0 && significant.some((w) => lowerAnswer.includes(w))) {
      seen.add(chunk.pagePath);
      citations.push({ pageTitle: chunk.pageTitle, pagePath: chunk.pagePath });
    }
  }

  return citations;
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

    if (request.method !== "POST") {
      return Response.json(
        { error: "Method not allowed" },
        { status: 405, headers },
      );
    }

    const url = new URL(request.url);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";

    // Route: POST /v1/qa/stream — Streaming Q&A
    if (url.pathname === "/v1/qa/stream") {
      if (isRateLimited(ip, qaIpRequests, QA_RATE_LIMIT_MAX)) {
        return Response.json(
          { error: "Rate limited. Max 10 Q&A requests per minute." },
          { status: 429, headers: { ...headers, "Retry-After": "60" } },
        );
      }
      return handleQAStream(request, env, headers);
    }

    // Route: POST /v1/generate — Non-streaming generation
    if (url.pathname === "/v1/generate") {
      if (isRateLimited(ip, ipRequests, RATE_LIMIT_MAX)) {
        return Response.json(
          { error: "Rate limited. Max 20 requests per minute." },
          { status: 429, headers: { ...headers, "Retry-After": "60" } },
        );
      }

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

      const messages: GroqMessage[] = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: prompt });

      try {
        const text = await callGroq(env.GROQ_API_KEY, messages, maxTokens, temperature);
        return Response.json({ text }, { headers });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("Groq call failed:", message);
        return Response.json({ error: message }, { status: 502, headers });
      }
    }

    return Response.json(
      { error: "Not found. Available: POST /v1/generate, POST /v1/qa/stream" },
      { status: 404, headers },
    );
  },
};
