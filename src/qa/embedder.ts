/**
 * Embedding Generator
 *
 * Generates vector embeddings for content chunks via configured
 * provider (OpenAI text-embedding-3-small, or Gemini embedding).
 */

export interface EmbeddingResult {
  /** The chunk ID */
  chunkId: string;
  /** The embedding vector */
  vector: number[];
}

export interface EmbedderOptions {
  /** Provider to use */
  provider: "openai" | "anthropic" | "gemini";
  /** Model name */
  model?: string;
  /** API key */
  apiKey: string;
}

/**
 * Generate embeddings for a batch of texts.
 */
export async function generateEmbeddings(
  texts: Array<{ id: string; content: string }>,
  options: EmbedderOptions
): Promise<EmbeddingResult[]> {
  switch (options.provider) {
    case "openai":
      return generateOpenAIEmbeddings(texts, options);
    case "gemini":
      return generateGeminiEmbeddings(texts, options);
    default:
      // Fallback: simple bag-of-words embedding
      return generateSimpleEmbeddings(texts);
  }
}

async function generateOpenAIEmbeddings(
  texts: Array<{ id: string; content: string }>,
  options: EmbedderOptions
): Promise<EmbeddingResult[]> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: options.apiKey });

  const model = options.model || "text-embedding-3-small";

  // Process in batches of 100
  const results: EmbeddingResult[] = [];
  const batchSize = 100;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await client.embeddings.create({
      model,
      input: batch.map((t) => t.content),
    });

    for (let j = 0; j < batch.length; j++) {
      results.push({
        chunkId: batch[j].id,
        vector: response.data[j].embedding,
      });
    }
  }

  return results;
}

async function generateGeminiEmbeddings(
  texts: Array<{ id: string; content: string }>,
  options: EmbedderOptions
): Promise<EmbeddingResult[]> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(options.apiKey);
  const model = genAI.getGenerativeModel({ model: options.model || "text-embedding-004" });

  const results: EmbeddingResult[] = [];

  // Gemini embedding API processes one at a time
  for (const text of texts) {
    try {
      const result = await model.embedContent(text.content);
      results.push({
        chunkId: text.id,
        vector: result.embedding.values,
      });
    } catch {
      // Skip failed embeddings
    }
  }

  return results;
}

/**
 * Simple bag-of-words embedding fallback.
 * Not great for semantic search but works without an API key.
 */
function generateSimpleEmbeddings(
  texts: Array<{ id: string; content: string }>
): Promise<EmbeddingResult[]> {
  const VOCAB_SIZE = 256;

  const results: EmbeddingResult[] = texts.map((text) => {
    const words = text.content.toLowerCase().split(/\W+/).filter(Boolean);
    const vector = new Array(VOCAB_SIZE).fill(0);

    for (const word of words) {
      // Simple hash to bucket
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash + word.charCodeAt(i)) & 0xFFFFFFFF;
      }
      const bucket = Math.abs(hash) % VOCAB_SIZE;
      vector[bucket] += 1;
    }

    // Normalize
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
