# Q&A Streaming Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade DocWalk's Q&A widget from a non-functional stub to a full streaming conversational Q&A system that matches/exceeds DeepWiki's "Ask" feature, with dual-mode architecture (client-side free + server-side premium).

**Architecture:** Client-side BM25 text search loads a lightweight index in-browser, finds relevant chunks, then streams LLM answers from Cloudflare AI proxy via SSE. Server-side premium mode offloads search to the worker for large indexes. Multi-turn conversation context carried in widget state.

**Tech Stack:** TypeScript, Cloudflare Workers (SSE streaming), BM25 text search, Groq LLM API

---

### Task 1: Build BM25 Text Search Engine

**Files:**
- Create: `src/qa/text-search.ts`

Build a lightweight BM25 text search engine that can run both server-side (Node.js) and client-side (browser). This replaces the need for embedding API calls at query time.

**What to build:**
- `buildTextIndex(chunks: ContentChunk[])` — tokenizes chunks, computes term frequencies, IDF scores, and doc lengths. Returns a serializable `TextSearchIndex`.
- `searchText(index: TextSearchIndex, query: string, topK: number)` — BM25 scoring against all chunks, returns ranked results with scores.
- `serializeTextIndex(index)` / `deserializeTextIndex(data)` — JSON round-trip.
- Tokenizer: lowercase, split on non-alphanumeric, remove stopwords (hard-coded 50-word list).
- BM25 params: k1=1.2, b=0.75 (standard defaults).
- Index format: `{ version: 1, chunks: [{id, pagePath, pageTitle, heading, content}], terms: {term: {df: number, postings: [{chunkIdx, tf}]}}, avgDl: number }`.
- Keep the serialized index small — omit vectors, only store text + term postings.

**Verification:** `npm run typecheck`

---

### Task 2: Integrate Text Search Index into Build Pipeline

**Files:**
- Modify: `src/qa/index.ts`
- Modify: `src/generators/mkdocs.ts`

Wire the text search index into the existing Q&A build pipeline so it ships alongside `qa-index.json`.

**What to change:**
- In `src/qa/index.ts`: Import `buildTextIndex` and `serializeTextIndex`. After building the vector store, also build the text search index from the same chunks. Return both in `QAIndex`.
- Update `QAIndex` type to include `textIndex?: string` (serialized JSON).
- In `src/generators/mkdocs.ts`: Write the text search index to `docs/_docwalk/qa-search.json` alongside the existing `qa-index.json`.
- The text search index is typically 5-10x smaller than the vector index (no 1536-dim vectors).

**Verification:** `npm run typecheck`

---

### Task 3: Upgrade AI Proxy Worker with SSE Streaming Q&A

**Files:**
- Modify: `worker/ai-proxy/src/index.ts`

Add a new `POST /v1/qa/stream` endpoint that accepts a question + context chunks and streams the LLM answer back via Server-Sent Events (SSE).

**New endpoint: `POST /v1/qa/stream`**

Request body:
```json
{
  "question": "How does authentication work?",
  "chunks": [{"content": "...", "pagePath": "...", "heading": "..."}],
  "history": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}],
  "systemPrompt": "optional override"
}
```

**Implementation:**
- Build messages array: system prompt (Q&A expert) + history + context chunks + question.
- Call Groq with `stream: true` — returns an async iterable of SSE chunks.
- Forward each chunk to the client as SSE: `data: {"token": "word"}\n\n`.
- Final message: `data: {"done": true, "citations": [...]}\n\n`.
- Extract citations from the LLM response (page paths mentioned in answer).
- Rate limit: 10 Q&A requests/min per IP (separate from generate limit).
- System prompt: "You are a helpful documentation assistant. Answer based ONLY on the provided context. If the context doesn't contain the answer, say so. Cite source pages when possible. Keep answers concise (2-4 paragraphs max)."

**Also add: `POST /v1/qa/search` (premium server-side mode)**
- Accepts `{ question, indexUrl }` — fetches the text search index from URL, runs BM25 search, then streams LLM answer.
- This is for large indexes that can't load in-browser.

**Verification:** `npx wrangler dev` and test with curl.

---

### Task 4: Rewrite Widget with Streaming + Multi-Turn + Client-Side Search

**Files:**
- Modify: `src/generators/qa-widget/widget.ts`

Complete rewrite of the widget JS to support:

1. **Client-side search**: On first open, fetch `_docwalk/qa-search.json`, deserialize the BM25 index, search locally.
2. **Streaming responses**: Connect to AI proxy `/v1/qa/stream` via `fetch()` with `ReadableStream`, parse SSE tokens, render incrementally.
3. **Multi-turn conversation**: Maintain message history in widget state, send last 3 exchanges as context to LLM.
4. **Markdown rendering**: Simple inline markdown (bold, code, links) in bot responses.
5. **Citations**: Show source page links below each answer.
6. **Loading states**: Typing indicator while streaming, chunk-by-chunk text appearance.

**Widget config additions:**
```typescript
{
  apiEndpoint: string;       // AI proxy URL
  searchIndexUrl: string;    // _docwalk/qa-search.json path
  mode: "client" | "server"; // Search mode
  position: "bottom-right" | "bottom-left";
  greeting: string;
  dailyLimit: number;
}
```

**Key behaviors:**
- Index loaded lazily on first question (not on page load)
- Search returns top 5 chunks
- Conversation history capped at last 3 exchanges (6 messages)
- Streaming tokens render character-by-character with cursor blink
- Error states: network failure, rate limit, daily limit
- Keyboard: Enter to send, Escape to close panel

**Verification:** Build docs site, verify widget renders and search index loads.

---

### Task 5: Update Widget CSS for Streaming UI

**Files:**
- Modify: `src/generators/qa-widget/widget.css`

Update CSS to support streaming message rendering:
- Typing cursor animation (blinking bar after last token)
- Citation links styling (small, muted, clickable)
- Multi-turn conversation visual hierarchy (alternating colors)
- "New conversation" button
- Streaming text fade-in effect
- Message timestamp (relative: "just now", "2m ago")

---

### Task 6: Wire Config + CLI Integration

**Files:**
- Modify: `src/generators/qa-widget/inject.ts`
- Modify: `src/generators/mkdocs.ts`
- Modify: `src/cli/commands/init.ts`

**inject.ts changes:**
- Pass `searchIndexUrl` and `mode` to `generateWidgetJS()`.
- Default `searchIndexUrl` to `_docwalk/qa-search.json` (relative path).
- Default `mode` to `"client"` (free tier).

**mkdocs.ts changes:**
- When `qa_widget` is enabled, write both `qa-index.json` (vectors) and `qa-search.json` (BM25 text index).
- Only build vector index when `mode: "server"` or when embeddings provider is configured.
- Always build text search index (no API key needed).

**init.ts changes:**
- Add Q&A prompt to custom track: "Enable Q&A chat widget?" (default: no)
- If yes, auto-configure with client-side mode and docwalk-proxy endpoint

**Verification:** `npm run typecheck && npm run build`

---

### Task 7: End-to-End Testing

**Files:**
- Modify: `tests/unit/qa-modules.test.ts`

Add tests for:
- BM25 text search: index building, search ranking, serialization round-trip
- Text search relevance: query "authentication" should rank auth-related chunks higher
- Streaming SSE parsing (mock response stream)
- Conversation history truncation (cap at 3 exchanges)

**Verification:** `npm test`

---

## Files Summary

| Task | File | Change |
|------|------|--------|
| 1 | `src/qa/text-search.ts` | New: BM25 text search engine |
| 2 | `src/qa/index.ts`, `src/generators/mkdocs.ts` | Integrate text index into build pipeline |
| 3 | `worker/ai-proxy/src/index.ts` | SSE streaming `/v1/qa/stream` + `/v1/qa/search` |
| 4 | `src/generators/qa-widget/widget.ts` | Full rewrite: streaming, multi-turn, client-side search |
| 5 | `src/generators/qa-widget/widget.css` | Streaming UI styles |
| 6 | `inject.ts`, `mkdocs.ts`, `init.ts` | Config wiring + CLI prompts |
| 7 | `tests/unit/qa-modules.test.ts` | BM25 + streaming tests |

## Verification

After all tasks:
1. `npm run typecheck` — no errors
2. `npm run build` — clean build
3. `npm test` — all tests pass
4. Generate docs with `npm run docwalk -- generate --ai` on a test repo
5. Verify `qa-search.json` is created in output
6. Open generated site, verify widget loads, search works, streaming renders
