/**
 * In-Memory Vector Store
 *
 * Simple cosine similarity search for Q&A retrieval.
 * Serializable to JSON for inclusion in built docs.
 */

import type { ContentChunk } from "./chunker.js";
import type { EmbeddingResult } from "./embedder.js";
import { estimateTokens } from "../generators/utils.js";

export interface VectorEntry {
  chunkId: string;
  vector: number[];
  chunk: ContentChunk;
}

export interface SearchResult {
  chunk: ContentChunk;
  score: number;
}

export interface SerializedIndex {
  version: number;
  entries: Array<{
    chunkId: string;
    vector: number[];
    pagePath: string;
    pageTitle: string;
    heading?: string;
    content: string;
  }>;
}

export class VectorStore {
  private entries: VectorEntry[] = [];

  /**
   * Add chunks with their embeddings to the store.
   */
  addEntries(chunks: ContentChunk[], embeddings: EmbeddingResult[]): void {
    const embeddingMap = new Map(embeddings.map((e) => [e.chunkId, e.vector]));

    for (const chunk of chunks) {
      const vector = embeddingMap.get(chunk.id);
      if (vector) {
        this.entries.push({ chunkId: chunk.id, vector, chunk });
      }
    }
  }

  /**
   * Search for the top-k most similar chunks to the query vector.
   */
  search(queryVector: number[], topK: number = 5): SearchResult[] {
    const scored = this.entries.map((entry) => ({
      chunk: entry.chunk,
      score: cosineSimilarity(queryVector, entry.vector),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * Serialize the index for persistence (written to qa-index.json).
   */
  serialize(): SerializedIndex {
    return {
      version: 1,
      entries: this.entries.map((e) => ({
        chunkId: e.chunkId,
        vector: e.vector,
        pagePath: e.chunk.pagePath,
        pageTitle: e.chunk.pageTitle,
        heading: e.chunk.heading,
        content: e.chunk.content,
      })),
    };
  }

  /**
   * Deserialize an index from JSON.
   */
  static deserialize(data: SerializedIndex): VectorStore {
    const store = new VectorStore();
    store.entries = data.entries.map((e) => ({
      chunkId: e.chunkId,
      vector: e.vector,
      chunk: {
        id: e.chunkId,
        pagePath: e.pagePath,
        pageTitle: e.pageTitle,
        heading: e.heading,
        content: e.content,
        tokenCount: estimateTokens(e.content),
      },
    }));
    return store;
  }

  get size(): number {
    return this.entries.length;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}
