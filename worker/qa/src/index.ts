/**
 * DocWalk Q&A API — Cloudflare Worker
 *
 * RAG pipeline: embed question → vector search → LLM answer.
 * Serves the Q&A widget's backend.
 */

interface Env {
  QA_API_KEY: string;
  ALLOWED_ORIGIN: string;
}

interface QARequest {
  question: string;
  page?: string;
  site_id?: string;
}

interface QAResponse {
  answer: string;
  citations: string[];
}

// Simple cosine similarity
function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const mag = Math.sqrt(na) * Math.sqrt(nb);
  return mag === 0 ? 0 : dot / mag;
}

function corsHeaders(origin: string, allowedOrigin: string): Record<string, string> {
  const allowed = origin === allowedOrigin || allowedOrigin === "*";
  return {
    "Access-Control-Allow-Origin": allowed ? origin : allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405, headers });
    }

    let body: QARequest;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400, headers });
    }

    if (!body.question || typeof body.question !== "string") {
      return Response.json({ error: "Missing question" }, { status: 400, headers });
    }

    try {
      // For now, return a placeholder response
      // In production, this would:
      // 1. Load the site's QA index from R2/KV
      // 2. Embed the question
      // 3. Vector search for top-k chunks
      // 4. Prompt the LLM with context
      // 5. Return the answer with citations

      const response: QAResponse = {
        answer: "This Q&A feature requires a Team or Enterprise plan. The widget will use RAG (Retrieval-Augmented Generation) to answer questions about the codebase using the generated documentation as context.",
        citations: [],
      };

      return Response.json(response, { status: 200, headers });
    } catch (error) {
      return Response.json(
        { error: "Internal error" },
        { status: 500, headers }
      );
    }
  },
};
