/**
 * BM25 Text Search Engine
 *
 * Lightweight full-text search that runs in both Node.js and the browser.
 * Used by the Q&A widget to find relevant documentation chunks without
 * needing an embedding API call at query time.
 *
 * BM25 (Best Matching 25) scores documents by term frequency, inverse
 * document frequency, and document length normalization.
 */

import type { ContentChunk } from "./chunker.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TextSearchIndex {
  version: number;
  /** Stored chunks (content + metadata) */
  chunks: StoredChunk[];
  /** Inverted index: term → { df, postings: [{ chunkIdx, tf }] } */
  terms: Record<string, TermEntry>;
  /** Average document length (in tokens) */
  avgDl: number;
}

interface StoredChunk {
  id: string;
  pagePath: string;
  pageTitle: string;
  heading?: string;
  content: string;
  /** Token count for BM25 length normalization */
  tokenCount: number;
}

interface TermEntry {
  /** Document frequency — number of chunks containing this term */
  df: number;
  /** Posting list — which chunks contain this term and how often */
  postings: Array<{ chunkIdx: number; tf: number }>;
}

export interface TextSearchResult {
  chunk: ContentChunk;
  score: number;
}

// ─── BM25 Parameters ─────────────────────────────────────────────────────────

const K1 = 1.2;
const B = 0.75;

// ─── Stopwords ───────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "this", "that",
  "these", "those", "it", "its", "not", "no", "so", "if", "as", "up",
  "out", "about", "into", "over", "after", "then", "than", "also",
]);

// ─── Tokenizer ───────────────────────────────────────────────────────────────

/**
 * Tokenize text: lowercase, split on non-alphanumeric, remove stopwords.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// ─── Index Building ──────────────────────────────────────────────────────────

/**
 * Build a BM25 text search index from content chunks.
 * The resulting index is fully serializable to JSON.
 */
export function buildTextIndex(chunks: ContentChunk[]): TextSearchIndex {
  const storedChunks: StoredChunk[] = [];
  const terms: Record<string, TermEntry> = {};
  let totalTokens = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const tokens = tokenize(chunk.content);
    const tokenCount = tokens.length;
    totalTokens += tokenCount;

    storedChunks.push({
      id: chunk.id,
      pagePath: chunk.pagePath,
      pageTitle: chunk.pageTitle,
      heading: chunk.heading,
      content: chunk.content,
      tokenCount,
    });

    // Count term frequencies for this chunk
    const tfMap = new Map<string, number>();
    for (const token of tokens) {
      tfMap.set(token, (tfMap.get(token) ?? 0) + 1);
    }

    // Update inverted index
    for (const [term, tf] of tfMap) {
      if (!terms[term]) {
        terms[term] = { df: 0, postings: [] };
      }
      terms[term].df++;
      terms[term].postings.push({ chunkIdx: i, tf });
    }
  }

  return {
    version: 1,
    chunks: storedChunks,
    terms,
    avgDl: chunks.length > 0 ? totalTokens / chunks.length : 0,
  };
}

// ─── Search ──────────────────────────────────────────────────────────────────

/**
 * Search the index with a text query using BM25 scoring.
 * Returns top-k results sorted by relevance score (descending).
 */
export function searchText(
  index: TextSearchIndex,
  query: string,
  topK: number = 5,
): TextSearchResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const N = index.chunks.length;
  if (N === 0) return [];

  // Score each chunk
  const scores = new Float64Array(N);

  for (const token of queryTokens) {
    const entry = index.terms[token];
    if (!entry) continue;

    // IDF: log((N - df + 0.5) / (df + 0.5) + 1)
    const idf = Math.log((N - entry.df + 0.5) / (entry.df + 0.5) + 1);

    for (const posting of entry.postings) {
      const dl = index.chunks[posting.chunkIdx].tokenCount;
      // BM25 term score: idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / avgDl))
      const tfNorm =
        (posting.tf * (K1 + 1)) /
        (posting.tf + K1 * (1 - B + B * (dl / index.avgDl)));
      scores[posting.chunkIdx] += idf * tfNorm;
    }
  }

  // Collect top-k results
  const results: TextSearchResult[] = [];

  for (let i = 0; i < N; i++) {
    if (scores[i] > 0) {
      const stored = index.chunks[i];
      results.push({
        chunk: {
          id: stored.id,
          pagePath: stored.pagePath,
          pageTitle: stored.pageTitle,
          heading: stored.heading,
          content: stored.content,
          tokenCount: stored.tokenCount,
        },
        score: scores[i],
      });
    }
  }

  // Sort by score descending and take top-k
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

// ─── Serialization ───────────────────────────────────────────────────────────

/**
 * Serialize the text search index to a JSON string.
 */
export function serializeTextIndex(index: TextSearchIndex): string {
  return JSON.stringify(index);
}

/**
 * Deserialize a text search index from a JSON string.
 */
export function deserializeTextIndex(data: string): TextSearchIndex {
  const parsed = JSON.parse(data) as TextSearchIndex;
  if (parsed.version !== 1) {
    throw new Error(`Unsupported text search index version: ${parsed.version}`);
  }
  return parsed;
}
