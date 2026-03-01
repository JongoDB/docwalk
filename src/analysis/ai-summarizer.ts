/**
 * DocWalk AI Summarizer
 *
 * Generates human-readable summaries for modules and symbols
 * using LLM providers. Provider implementations live in ./providers/.
 *
 * This module contains:
 * - RateLimiter for API call throttling
 * - SummaryCache for content-hash-based caching
 * - summarizeModules() orchestrator
 * - createProvider() factory (re-exported from providers)
 */

import type { AnalysisConfig } from "../config/schema.js";
import type { ModuleInfo, Symbol } from "./types.js";
import type { AISummaryProvider, AIProvider } from "./providers/base.js";
import { buildBatchSummaryPrompt, parseBatchSummaryResponse } from "./providers/base.js";
import { createProvider as _createProvider } from "./providers/index.js";

// Re-export provider types and factory
export type { AISummaryProvider } from "./providers/base.js";
export type { AIProvider, GenerateOptions } from "./providers/base.js";
export { createProvider } from "./providers/index.js";

/** Result from a single summarization call. */
export interface SummaryResult {
  /** The generated summary text. */
  summary: string;

  /** Content hash used as cache key. */
  contentHash: string;
}

/** Cache entry persisted alongside the manifest. */
export interface SummaryCacheEntry {
  contentHash: string;
  summary: string;
  generatedAt: string;
}

// ─── Rate Limiter ────────────────────────────────────────────────────────────

/**
 * Simple token-bucket rate limiter for API calls.
 * Ensures we don't exceed provider rate limits.
 */
class RateLimiter {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(
    private readonly maxConcurrent: number,
    private readonly delayMs: number
  ) {}

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  async release(): Promise<void> {
    if (this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }

    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next();
    }
  }
}

// ─── Summary Cache ───────────────────────────────────────────────────────────

/** In-memory cache backed by content hashes. */
export class SummaryCache {
  private entries = new Map<string, SummaryCacheEntry>();

  constructor(existing?: SummaryCacheEntry[]) {
    if (existing) {
      for (const entry of existing) {
        this.entries.set(entry.contentHash, entry);
      }
    }
  }

  /** Get a cached summary if the content hash matches. */
  get(contentHash: string): string | undefined {
    return this.entries.get(contentHash)?.summary;
  }

  /** Store a summary with its content hash. */
  set(contentHash: string, summary: string): void {
    this.entries.set(contentHash, {
      contentHash,
      summary,
      generatedAt: new Date().toISOString(),
    });
  }

  /** Export all cache entries for persistence. */
  toArray(): SummaryCacheEntry[] {
    return [...this.entries.values()];
  }

  get size(): number {
    return this.entries.size;
  }
}

// ─── Retry Helper ────────────────────────────────────────────────────────────

/** Retry an async function with exponential backoff on rate-limit errors. */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 2000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      const isRateLimit = message.includes("429")
        || message.toLowerCase().includes("rate")
        || message.toLowerCase().includes("quota")
        || message.toLowerCase().includes("resource_exhausted");
      if (!isRateLimit || attempt === maxRetries) throw err;
      // Exponential backoff: 2s, 4s, 8s
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

/** Options for the AI summarization pass. */
export interface SummarizeOptions {
  /** AI provider configuration from docwalk config. */
  providerConfig: NonNullable<AnalysisConfig["ai_provider"]>;

  /** Modules to summarize. */
  modules: ModuleInfo[];

  /** Function to read file content by relative path. */
  readFile: (filePath: string) => Promise<string>;

  /** Previous cache entries to avoid re-summarizing. */
  previousCache?: SummaryCacheEntry[];

  /** Progress callback. */
  onProgress?: (current: number, total: number, message: string) => void;

  /** Maximum concurrent API calls. */
  concurrency?: number;

  /** Delay between API calls in milliseconds. */
  delayMs?: number;
}

/** Result of the summarization pass. */
export interface SummarizeResult {
  /** Updated modules with AI summaries attached. */
  modules: ModuleInfo[];

  /** Cache entries for persistence. */
  cache: SummaryCacheEntry[];

  /** Number of summaries generated (not cached). */
  generated: number;

  /** Number of summaries retrieved from cache. */
  cached: number;

  /** Number of summaries that failed (gracefully skipped). */
  failed: number;
}

/**
 * Run AI summarization on all modules.
 *
 * Uses batched calls: one API request per module summarizes both the module
 * and all its exported symbols. This reduces API call count from O(modules * symbols)
 * to O(modules), critical for rate-limited free tiers (e.g. Gemini: 5-10 RPM).
 *
 * Fault-tolerant:
 * - If the API key is missing, returns modules unchanged
 * - If individual API calls fail, those summaries are skipped
 * - Cached summaries are reused when content hasn't changed
 * - Rate limiting + retry prevents hitting provider quotas
 */
export async function summarizeModules(
  options: SummarizeOptions
): Promise<SummarizeResult> {
  const {
    providerConfig,
    modules,
    readFile,
    previousCache,
    onProgress,
    concurrency = 2,
    delayMs = 500,
  } = options;

  // Create provider — gracefully bail if no API key
  const provider = _createProvider(providerConfig);
  if (!provider) {
    return {
      modules,
      cache: previousCache || [],
      generated: 0,
      cached: 0,
      failed: 0,
    };
  }

  const cache = new SummaryCache(previousCache);
  const limiter = new RateLimiter(concurrency, delayMs);
  let generated = 0;
  let cached = 0;
  let failed = 0;
  let firstError: string | undefined;

  // Check if provider supports general generate() (needed for batch prompts)
  const canBatch = "generate" in provider && typeof (provider as AIProvider).generate === "function";
  const isLocal = providerConfig.name === "local" || providerConfig.name === "ollama";

  let progressCount = 0;

  async function processModule(mod: ModuleInfo): Promise<ModuleInfo> {
    onProgress?.(++progressCount, modules.length, `Summarizing ${mod.filePath}`);

    const updatedSymbols = [...mod.symbols];
    const exportedSymbols = isLocal ? [] : updatedSymbols.filter(
      (s) => s.exported && (s.kind === "function" || s.kind === "class" || s.kind === "interface")
    );

    // Check if everything is cached
    const cachedModuleSummary = cache.get(mod.contentHash);
    const uncachedSymbols: Symbol[] = [];
    for (const sym of exportedSymbols) {
      const symbolCacheKey = `${mod.contentHash}:${sym.id}`;
      const cachedSym = cache.get(symbolCacheKey);
      if (cachedSym) {
        sym.aiSummary = cachedSym;
        cached++;
      } else {
        uncachedSymbols.push(sym);
      }
    }

    if (cachedModuleSummary && uncachedSymbols.length === 0) {
      cached++;
      return { ...mod, aiSummary: cachedModuleSummary, symbols: updatedSymbols };
    }

    // Use batched call: one API request for module + all uncached symbols
    try {
      await limiter.acquire();
      const content = await readFile(mod.filePath);

      if (canBatch && uncachedSymbols.length > 0) {
        // Batched: module + symbols in one call
        const batchPrompt = buildBatchSummaryPrompt(mod, content, uncachedSymbols);
        const response = await withRetry(
          () => (provider as AIProvider).generate(batchPrompt, { maxTokens: 1024, temperature: 0.2 })
        );
        const result = parseBatchSummaryResponse(response, uncachedSymbols.map(s => s.name));

        // Apply module summary
        const moduleSummary = cachedModuleSummary || result.moduleSummary;
        if (!cachedModuleSummary && result.moduleSummary) {
          cache.set(mod.contentHash, result.moduleSummary);
          generated++;
        } else if (cachedModuleSummary) {
          cached++;
        }

        // Apply symbol summaries
        for (const sym of uncachedSymbols) {
          const summary = result.symbolSummaries[sym.name];
          if (summary) {
            sym.aiSummary = summary;
            cache.set(`${mod.contentHash}:${sym.id}`, summary);
            generated++;
          }
        }

        return { ...mod, aiSummary: moduleSummary, symbols: updatedSymbols };
      } else {
        // Non-batched fallback: just the module summary
        let moduleSummary = cachedModuleSummary;
        if (!moduleSummary) {
          moduleSummary = await withRetry(
            () => provider!.summarizeModule(mod, content)
          );
          cache.set(mod.contentHash, moduleSummary);
          generated++;
        } else {
          cached++;
        }
        return { ...mod, aiSummary: moduleSummary, symbols: updatedSymbols };
      }
    } catch (err) {
      failed++;
      if (!firstError) {
        firstError = err instanceof Error ? err.message : String(err);
      }
      // Still return cached module summary if available
      return {
        ...mod,
        aiSummary: cachedModuleSummary,
        symbols: updatedSymbols,
      };
    } finally {
      await limiter.release();
    }
  }

  const updatedModules = await Promise.all(modules.map(processModule));

  // Log failure summary if many calls failed
  if (failed > 0 && onProgress) {
    const truncatedError = firstError && firstError.length > 120
      ? firstError.slice(0, 120) + "..."
      : firstError;
    onProgress(modules.length, modules.length,
      `AI summary failures: ${failed} calls failed. First error: ${truncatedError || "unknown"}`);
  }

  return {
    modules: updatedModules,
    cache: cache.toArray(),
    generated,
    cached,
    failed,
  };
}
