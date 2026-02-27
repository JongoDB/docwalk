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
import type { AISummaryProvider } from "./providers/base.js";
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
 * This is designed to be fault-tolerant:
 * - If the API key is missing, returns modules unchanged
 * - If individual API calls fail, those summaries are skipped
 * - Cached summaries are reused when content hasn't changed
 * - Rate limiting prevents hitting provider quotas
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
    concurrency = 3,
    delayMs = 200,
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

  // Process modules
  const updatedModules: ModuleInfo[] = [];

  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];
    onProgress?.(i + 1, modules.length, `Summarizing ${mod.filePath}`);

    // Check cache for module summary
    const cachedModuleSummary = cache.get(mod.contentHash);
    let moduleSummary: string | undefined;

    if (cachedModuleSummary) {
      moduleSummary = cachedModuleSummary;
      cached++;
    } else {
      try {
        await limiter.acquire();
        const content = await readFile(mod.filePath);
        moduleSummary = await provider.summarizeModule(mod, content);
        cache.set(mod.contentHash, moduleSummary);
        generated++;
      } catch {
        failed++;
      } finally {
        await limiter.release();
      }
    }

    // Summarize exported symbols (only public API surface)
    const updatedSymbols = [...mod.symbols];
    const exportedSymbols = updatedSymbols.filter(
      (s) => s.exported && (s.kind === "function" || s.kind === "class" || s.kind === "interface")
    );

    for (const sym of exportedSymbols) {
      // Build a content-based cache key for the symbol
      const symbolCacheKey = `${mod.contentHash}:${sym.id}`;
      const cachedSymSummary = cache.get(symbolCacheKey);

      if (cachedSymSummary) {
        sym.aiSummary = cachedSymSummary;
        cached++;
      } else {
        try {
          await limiter.acquire();
          const content = await readFile(mod.filePath);
          const summary = await provider.summarizeSymbol(sym, content, mod.filePath);
          sym.aiSummary = summary;
          cache.set(symbolCacheKey, summary);
          generated++;
        } catch {
          failed++;
        } finally {
          await limiter.release();
        }
      }
    }

    updatedModules.push({
      ...mod,
      aiSummary: moduleSummary,
      symbols: updatedSymbols,
    });
  }

  return {
    modules: updatedModules,
    cache: cache.toArray(),
    generated,
    cached,
    failed,
  };
}
