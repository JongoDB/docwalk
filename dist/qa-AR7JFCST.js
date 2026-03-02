import {
  estimateTokens
} from "./chunk-VTREF62W.js";

// src/qa/chunker.ts
var MIN_CHUNK_TOKENS = 50;
var DEFAULT_TARGET_CHUNK_TOKENS = 300;
var MAX_CHUNK_TOKENS = 500;
function chunkPage(pagePath, pageTitle, content, options) {
  const targetChunkTokens = options?.targetSize ?? DEFAULT_TARGET_CHUNK_TOKENS;
  const overlapTokens = options?.overlapTokens ?? 0;
  const chunks = [];
  let chunkIndex = 0;
  const stripped = content.replace(/^---[\s\S]*?---\n*/m, "");
  const sections = splitByHeadings(stripped);
  for (const section of sections) {
    const heading = section.heading;
    const sectionContent = section.content.trim();
    if (!sectionContent) continue;
    const tokens = estimateTokens(sectionContent);
    if (tokens <= MAX_CHUNK_TOKENS) {
      if (tokens >= MIN_CHUNK_TOKENS) {
        chunks.push({
          id: `${pagePath}:${chunkIndex++}`,
          pagePath,
          pageTitle,
          heading,
          content: sectionContent,
          tokenCount: tokens
        });
      }
    } else {
      const paragraphs = sectionContent.split(/\n\n+/);
      let currentChunk = "";
      let currentTokens = 0;
      let previousTail = "";
      for (const para of paragraphs) {
        const paraTokens = estimateTokens(para);
        if (currentTokens + paraTokens > MAX_CHUNK_TOKENS && currentChunk) {
          const finalContent = currentChunk.trim();
          chunks.push({
            id: `${pagePath}:${chunkIndex++}`,
            pagePath,
            pageTitle,
            heading,
            content: finalContent,
            tokenCount: estimateTokens(finalContent)
          });
          if (overlapTokens > 0) {
            const words = finalContent.split(/\s+/);
            const overlapWords = Math.min(overlapTokens, words.length);
            previousTail = words.slice(-overlapWords).join(" ") + "\n\n";
          }
          currentChunk = previousTail;
          currentTokens = estimateTokens(previousTail);
        }
        currentChunk += para + "\n\n";
        currentTokens += paraTokens;
        if (currentTokens >= targetChunkTokens) {
          const finalContent = currentChunk.trim();
          chunks.push({
            id: `${pagePath}:${chunkIndex++}`,
            pagePath,
            pageTitle,
            heading,
            content: finalContent,
            tokenCount: estimateTokens(finalContent)
          });
          if (overlapTokens > 0) {
            const words = finalContent.split(/\s+/);
            const overlapWords = Math.min(overlapTokens, words.length);
            previousTail = words.slice(-overlapWords).join(" ") + "\n\n";
          }
          currentChunk = previousTail;
          currentTokens = estimateTokens(previousTail);
        }
      }
      if (currentChunk.trim() && estimateTokens(currentChunk.trim()) >= MIN_CHUNK_TOKENS) {
        chunks.push({
          id: `${pagePath}:${chunkIndex++}`,
          pagePath,
          pageTitle,
          heading,
          content: currentChunk.trim(),
          tokenCount: estimateTokens(currentChunk.trim())
        });
      }
    }
  }
  return chunks;
}
function splitByHeadings(markdown) {
  const sections = [];
  const lines = markdown.split("\n");
  let currentHeading;
  let currentContent = [];
  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      if (currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n")
        });
      }
      currentHeading = headingMatch[2];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join("\n")
    });
  }
  return sections;
}
function chunkPages(pages, options) {
  const allChunks = [];
  for (const page of pages) {
    allChunks.push(...chunkPage(page.path, page.title, page.content, options));
  }
  return allChunks;
}

// src/qa/embedder.ts
async function generateEmbeddings(texts, options) {
  switch (options.provider) {
    case "openai":
      return generateOpenAIEmbeddings(texts, options);
    case "gemini":
      return generateGeminiEmbeddings(texts, options);
    case "ollama":
    case "local":
      return generateOllamaEmbeddings(texts, options);
    case "anthropic":
      return generateSimpleEmbeddings(texts);
    default:
      return generateSimpleEmbeddings(texts);
  }
}
async function generateOpenAIEmbeddings(texts, options) {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: options.apiKey });
  const model = options.model || "text-embedding-3-small";
  const results = [];
  const batchSize = 100;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await client.embeddings.create({
      model,
      input: batch.map((t) => t.content)
    });
    for (let j = 0; j < batch.length; j++) {
      results.push({
        chunkId: batch[j].id,
        vector: response.data[j].embedding
      });
    }
  }
  return results;
}
async function generateGeminiEmbeddings(texts, options) {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(options.apiKey);
  const model = genAI.getGenerativeModel({ model: options.model || "text-embedding-004" });
  const results = [];
  for (const text of texts) {
    try {
      const result = await model.embedContent(text.content);
      results.push({
        chunkId: text.id,
        vector: result.embedding.values
      });
    } catch {
    }
  }
  return results;
}
async function generateOllamaEmbeddings(texts, options) {
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({
      baseURL: options.base_url || "http://localhost:11434/v1",
      apiKey: "ollama"
    });
    const model = options.model || "nomic-embed-text";
    const results = [];
    const batchSize = 100;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      try {
        const response = await client.embeddings.create({
          model,
          input: batch.map((t) => t.content)
        });
        for (let j = 0; j < batch.length; j++) {
          results.push({
            chunkId: batch[j].id,
            vector: response.data[j].embedding
          });
        }
      } catch {
        const fallback = await generateSimpleEmbeddings(batch);
        results.push(...fallback);
      }
    }
    return results;
  } catch {
    return generateSimpleEmbeddings(texts);
  }
}
function generateSimpleEmbeddings(texts) {
  const VOCAB_SIZE = 256;
  const results = texts.map((text) => {
    const words = text.content.toLowerCase().split(/\W+/).filter(Boolean);
    const vector = new Array(VOCAB_SIZE).fill(0);
    for (const word of words) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash << 5) - hash + word.charCodeAt(i) & 4294967295;
      }
      const bucket = Math.abs(hash) % VOCAB_SIZE;
      vector[bucket] += 1;
    }
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }
    return { chunkId: text.id, vector };
  });
  return Promise.resolve(results);
}

// src/qa/vector-store.ts
var VectorStore = class _VectorStore {
  entries = [];
  /**
   * Add chunks with their embeddings to the store.
   */
  addEntries(chunks, embeddings) {
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
  search(queryVector, topK = 5) {
    const scored = this.entries.map((entry) => ({
      chunk: entry.chunk,
      score: cosineSimilarity(queryVector, entry.vector)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
  /**
   * Serialize the index for persistence (written to qa-index.json).
   */
  serialize() {
    return {
      version: 1,
      entries: this.entries.map((e) => ({
        chunkId: e.chunkId,
        vector: e.vector,
        pagePath: e.chunk.pagePath,
        pageTitle: e.chunk.pageTitle,
        heading: e.chunk.heading,
        content: e.chunk.content
      }))
    };
  }
  /**
   * Deserialize an index from JSON.
   */
  static deserialize(data) {
    const store = new _VectorStore();
    store.entries = data.entries.map((e) => ({
      chunkId: e.chunkId,
      vector: e.vector,
      chunk: {
        id: e.chunkId,
        pagePath: e.pagePath,
        pageTitle: e.pageTitle,
        heading: e.heading,
        content: e.content,
        tokenCount: estimateTokens(e.content)
      }
    }));
    return store;
  }
  get size() {
    return this.entries.length;
  }
};
function cosineSimilarity(a, b) {
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

// src/qa/text-search.ts
var K1 = 1.2;
var B = 0.75;
var STOPWORDS = /* @__PURE__ */ new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "not",
  "no",
  "so",
  "if",
  "as",
  "up",
  "out",
  "about",
  "into",
  "over",
  "after",
  "then",
  "than",
  "also"
]);
function tokenize(text) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOPWORDS.has(t));
}
function buildTextIndex(chunks) {
  const storedChunks = [];
  const terms = /* @__PURE__ */ Object.create(null);
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
      tokenCount
    });
    const tfMap = /* @__PURE__ */ new Map();
    for (const token of tokens) {
      tfMap.set(token, (tfMap.get(token) ?? 0) + 1);
    }
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
    avgDl: chunks.length > 0 ? totalTokens / chunks.length : 0
  };
}
function searchText(index, query, topK = 5) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];
  const N = index.chunks.length;
  if (N === 0) return [];
  const scores = new Float64Array(N);
  for (const token of queryTokens) {
    const entry = index.terms[token];
    if (!entry || !entry.postings) continue;
    const idf = Math.log((N - entry.df + 0.5) / (entry.df + 0.5) + 1);
    for (const posting of entry.postings) {
      const dl = index.chunks[posting.chunkIdx].tokenCount;
      const tfNorm = posting.tf * (K1 + 1) / (posting.tf + K1 * (1 - B + B * (dl / index.avgDl)));
      scores[posting.chunkIdx] += idf * tfNorm;
    }
  }
  const results = [];
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
          tokenCount: stored.tokenCount
        },
        score: scores[i]
      });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}
function serializeTextIndex(index) {
  return JSON.stringify(index);
}
function deserializeTextIndex(data) {
  const parsed = JSON.parse(data);
  if (parsed.version !== 1) {
    throw new Error(`Unsupported text search index version: ${parsed.version}`);
  }
  return parsed;
}

// src/qa/index.ts
async function buildQAIndex(options) {
  const { pages, embedder, onProgress, chunkOverlap, chunkTargetSize } = options;
  onProgress?.("Chunking pages for Q&A index...");
  const chunks = chunkPages(
    pages.map((p) => ({ path: p.path, title: p.title, content: p.content })),
    { overlapTokens: chunkOverlap ?? 50, targetSize: chunkTargetSize ?? 300 }
  );
  onProgress?.(`Created ${chunks.length} chunks from ${pages.length} pages`);
  onProgress?.("Generating embeddings...");
  const textsForEmbedding = chunks.map((c) => ({
    id: c.id,
    content: c.heading ? `${c.heading}: ${c.content}` : c.content
  }));
  const embeddings = await generateEmbeddings(textsForEmbedding, embedder);
  onProgress?.(`Generated ${embeddings.length} embeddings`);
  const store = new VectorStore();
  store.addEntries(chunks, embeddings);
  onProgress?.("Building text search index...");
  const textIdx = buildTextIndex(chunks);
  const textIndexJson = serializeTextIndex(textIdx);
  onProgress?.(`Text search index: ${Object.keys(textIdx.terms).length} terms`);
  return {
    serialized: store.serialize(),
    textIndex: textIndexJson,
    chunkCount: chunks.length,
    pageCount: pages.length
  };
}
export {
  VectorStore,
  buildQAIndex,
  buildTextIndex,
  chunkPages,
  deserializeTextIndex,
  generateEmbeddings,
  searchText,
  serializeTextIndex
};
