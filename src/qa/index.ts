/**
 * Q&A Index Builder
 *
 * Orchestrates chunking, embedding, and index serialization
 * for the Q&A widget's retrieval pipeline.
 */

import type { GeneratedPage } from "../analysis/types.js";
import { chunkPages, type ContentChunk } from "./chunker.js";
import { generateEmbeddings, type EmbedderOptions } from "./embedder.js";
import { VectorStore, type SerializedIndex } from "./vector-store.js";
import { buildTextIndex, serializeTextIndex } from "./text-search.js";

export { chunkPages, type ContentChunk } from "./chunker.js";
export { generateEmbeddings, type EmbedderOptions } from "./embedder.js";
export { VectorStore, type SerializedIndex } from "./vector-store.js";
export { buildTextIndex, searchText, serializeTextIndex, deserializeTextIndex } from "./text-search.js";
export type { TextSearchIndex, TextSearchResult } from "./text-search.js";

export interface BuildQAIndexOptions {
  /** Generated pages to index */
  pages: GeneratedPage[];
  /** Embedding provider configuration */
  embedder: EmbedderOptions;
  /** Progress callback */
  onProgress?: (message: string) => void;
  /** Overlap tokens between adjacent chunks (default: 50) */
  chunkOverlap?: number;
  /** Target token count for chunks (default: 300) */
  chunkTargetSize?: number;
}

export interface QAIndex {
  /** Serialized vector store for persistence */
  serialized: SerializedIndex;
  /** Serialized BM25 text search index (no embeddings needed at query time) */
  textIndex: string;
  /** Number of chunks indexed */
  chunkCount: number;
  /** Number of pages processed */
  pageCount: number;
}

/**
 * Build a Q&A index from generated pages.
 * Chunks pages, generates embeddings, and creates a searchable index.
 */
export async function buildQAIndex(options: BuildQAIndexOptions): Promise<QAIndex> {
  const { pages, embedder, onProgress, chunkOverlap, chunkTargetSize } = options;

  // Step 1: Chunk all pages
  onProgress?.("Chunking pages for Q&A index...");
  const chunks = chunkPages(
    pages.map((p) => ({ path: p.path, title: p.title, content: p.content })),
    { overlapTokens: chunkOverlap ?? 50, targetSize: chunkTargetSize ?? 300 }
  );
  onProgress?.(`Created ${chunks.length} chunks from ${pages.length} pages`);

  // Step 2: Generate embeddings
  onProgress?.("Generating embeddings...");
  const textsForEmbedding = chunks.map((c) => ({
    id: c.id,
    content: c.heading ? `${c.heading}: ${c.content}` : c.content,
  }));

  const embeddings = await generateEmbeddings(textsForEmbedding, embedder);
  onProgress?.(`Generated ${embeddings.length} embeddings`);

  // Step 3: Build vector store
  const store = new VectorStore();
  store.addEntries(chunks, embeddings);

  // Step 4: Build BM25 text search index (runs client-side, no API needed)
  onProgress?.("Building text search index...");
  const textIdx = buildTextIndex(chunks);
  const textIndexJson = serializeTextIndex(textIdx);
  onProgress?.(`Text search index: ${Object.keys(textIdx.terms).length} terms`);

  return {
    serialized: store.serialize(),
    textIndex: textIndexJson,
    chunkCount: chunks.length,
    pageCount: pages.length,
  };
}
