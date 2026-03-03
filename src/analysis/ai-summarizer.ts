/**
 * DocWalk AI Summarizer
 *
 * Generates human-readable summaries for modules and symbols
 * using LLM providers. Provider implementations live in ./providers/.
 *
 * This module contains:
 * - RateLimiter for concurrency control
 * - SummaryCache for content-hash-based caching
 * - summarizeModules() orchestrator
 * - createProvider() factory (re-exported from providers)
 */

import type { AnalysisConfig } from "../config/schema.js";
import type { ModuleInfo, Symbol } from "./types.js";
import type { AISummaryProvider, AIProvider } from "./providers/base.js";
import {
  buildBatchSystemPrompt,
  buildBatchSummaryPrompt,
  parseBatchSummaryResponse,
  buildMultiFileBatchPrompt,
  parseMultiFileBatchResponse,
} from "./providers/base.js";
import type { MultiFileBatchEntry } from "./providers/base.js";
import { createProvider as _createProvider } from "./providers/index.js";
import { OpenAIProvider } from "./providers/openai.js";

// ─── Groq Model Pool ─────────────────────────────────────────────────────────
// Groq rate limits are per-model. Running parallel requests across N models
// multiplies effective RPM/TPM by N×. Each model's capacity determines how
// many files it should handle per wave.
// 12 models: ~430 RPM combined, ~228K TPM combined. ~65 files/wave.

interface GroqModelSpec {
  id: string;
  rpm: number;    // requests per minute
  tpm: number;    // tokens per minute
  /** Estimated files per request based on TPM. ~500 tokens/file summary round-trip. */
  filesPerRequest: number;
}

// ~500 tokens per file (prompt + response) — conservative estimate.
// Models with higher TPM can pack more files per request.
const TOKENS_PER_FILE = 500;

const GROQ_MODELS: GroqModelSpec[] = [
  // Compound models: 70K TPM each — by far the highest capacity.
  // Groq's compound AI routing models. Cap at 10 files/req to keep prompt size reasonable.
  { id: "groq/compound",                                  rpm: 30, tpm: 70000, filesPerRequest: 10 },
  { id: "groq/compound-mini",                             rpm: 30, tpm: 70000, filesPerRequest: 10 },
  // Scout: best all-rounder, 30K TPM
  { id: "meta-llama/llama-4-scout-17b-16e-instruct",     rpm: 30, tpm: 30000, filesPerRequest: 8 },
  // High-quality large models
  { id: "llama-3.3-70b-versatile",                        rpm: 30, tpm: 12000, filesPerRequest: 6 },
  { id: "moonshotai/kimi-k2-instruct",                    rpm: 60, tpm: 10000, filesPerRequest: 5 },
  { id: "moonshotai/kimi-k2-instruct-0905",               rpm: 60, tpm: 10000, filesPerRequest: 5 },
  { id: "openai/gpt-oss-120b",                            rpm: 30, tpm: 8000,  filesPerRequest: 4 },
  { id: "openai/gpt-oss-20b",                             rpm: 30, tpm: 8000,  filesPerRequest: 4 },
  { id: "openai/gpt-oss-safeguard-20b",                   rpm: 30, tpm: 8000,  filesPerRequest: 4 },
  // Smaller/faster models
  { id: "qwen/qwen3-32b",                                 rpm: 60, tpm: 6000,  filesPerRequest: 3 },
  { id: "meta-llama/llama-4-maverick-17b-128e-instruct",  rpm: 30, tpm: 6000,  filesPerRequest: 3 },
  { id: "llama-3.1-8b-instant",                           rpm: 30, tpm: 6000,  filesPerRequest: 3 },
];

/** A provider slot in the pool, with its capacity metadata. */
interface PoolSlot {
  provider: OpenAIProvider;
  spec: GroqModelSpec;
}

/**
 * Capacity-aware provider pool. Assigns more files to models with higher
 * TPM limits, and dispatches all models in parallel per wave.
 *
 * Total capacity per wave: sum of all filesPerRequest = ~65 files.
 */
class ProviderPool {
  private readonly slots: PoolSlot[];
  private slotIndex = 0;

  constructor(apiKey: string, baseURL: string, specs: GroqModelSpec[]) {
    this.slots = specs.map((spec) => ({
      provider: new OpenAIProvider(apiKey, spec.id, baseURL),
      spec,
    }));
  }

  /**
   * Plan work distribution for a set of modules.
   * Returns assignments: which provider handles which modules, respecting
   * per-model TPM capacity. Higher-TPM models get more files.
   */
  planWave(modules: ModuleInfo[]): Array<{ provider: OpenAIProvider; batch: ModuleInfo[] }> {
    const assignments: Array<{ provider: OpenAIProvider; batch: ModuleInfo[] }> = [];
    let offset = 0;

    for (const slot of this.slots) {
      if (offset >= modules.length) break;
      const count = Math.min(slot.spec.filesPerRequest, modules.length - offset);
      assignments.push({
        provider: slot.provider,
        batch: modules.slice(offset, offset + count),
      });
      offset += count;
    }

    return assignments;
  }

  /** Total files that can be processed in one wave across all models. */
  get waveCapacity(): number {
    return this.slots.reduce((sum, s) => sum + s.spec.filesPerRequest, 0);
  }

  /** Get a different provider than the one that failed (for retry on 429). */
  nextAfter(failed: OpenAIProvider): OpenAIProvider {
    const startIdx = this.slotIndex;
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[(startIdx + i) % this.slots.length];
      if (slot.provider !== failed) {
        this.slotIndex = (startIdx + i + 1) % this.slots.length;
        return slot.provider;
      }
    }
    this.slotIndex++;
    return this.slots[this.slotIndex % this.slots.length].provider;
  }

  get size(): number {
    return this.slots.length;
  }
}

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

/**
 * Retry an async function with exponential backoff on transient errors.
 * When a model rotator is provided, rotates to the next model on 429 errors
 * before retrying — this often succeeds immediately since limits are per-model.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 3000,
  onRateLimit?: () => void
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

      // Rotate to next model before retrying (if available)
      onRateLimit?.();

      // Short delay when rotating models (new model has fresh quota),
      // longer backoff otherwise
      const delay = onRateLimit ? 500 : baseDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// ─── Try-Mode Module Scoring ─────────────────────────────────────────────
// Ranks modules by "demo impressiveness" — classes with methods, interfaces
// with rich type signatures, and core architectural files score highest.
// This ensures try-mode showcases the most compelling AI summaries.

/**
 * Score a module for demo impressiveness.
 * Higher scores = better showcase in try-mode's 50-module cap.
 */
function scoreModuleForDemo(mod: ModuleInfo): number {
  let score = 0;
  const exported = mod.symbols.filter((s) => s.exported);

  // ── Symbol variety (capped to avoid route-file inflation) ────────────
  const classes = exported.filter((s) => s.kind === "class");
  const interfaces = exported.filter((s) => s.kind === "interface");
  const functions = exported.filter((s) => s.kind === "function");
  const types = exported.filter((s) => s.kind === "type" || s.kind === "enum");

  score += Math.min(classes.length, 3) * 15;     // Classes are doc gold
  score += Math.min(interfaces.length, 4) * 12;  // Interfaces define contracts
  score += Math.min(functions.length, 5) * 4;    // Functions: cap at 5 to avoid route inflation
  score += Math.min(types.length, 5) * 3;        // Types/enums add completeness

  // Symbol diversity bonus: having multiple KINDS of exports is more impressive
  const kinds = new Set(exported.map((s) => s.kind));
  score += (kinds.size - 1) * 8; // 0 for 1 kind, +8 for 2, +16 for 3, etc.

  // Documented symbols produce better AI summaries
  score += Math.min(exported.filter((s) => s.docs?.summary).length, 8) * 3;

  // ── File role (what the file IS, not just its name) ──────────────────
  const name = mod.filePath.toLowerCase();
  const base = name.split("/").pop() || "";

  // Core architectural files — these tell the most interesting story
  if (/^(index|main|app|server)\.[^/]+$/.test(base)) score += 12;
  if (/model|entity|schema|types/.test(base)) score += 10;
  if (/config/.test(base)) score += 8;
  if (/service|controller|manager|handler/.test(base)) score += 6;
  if (/store|state|context/.test(base)) score += 8;  // State management
  if (/hook|composable/.test(base)) score += 6;       // React/Vue hooks
  if (/component|widget|view|page/.test(base)) score += 5; // UI components
  if (/util|helper|lib/.test(base)) score += 4;
  if (/middleware|interceptor|guard/.test(base)) score += 5;
  if (/factory|builder|provider/.test(base)) score += 6;

  // Route files: small bonus for the FIRST one, but not 20+ of them
  // (the diversity selection below handles this via directory caps)
  if (/route|endpoint|api/.test(base)) score += 3;

  // Moderate file size — sweet spot for readable summaries
  if (mod.lineCount >= 80 && mod.lineCount <= 400) score += 5;
  else if (mod.lineCount >= 50 && mod.lineCount <= 600) score += 3;
  if (mod.lineCount < 15) score -= 10;

  // ── Penalties ────────────────────────────────────────────────────────
  if (/\.(test|spec|mock|fixture)\.[^/]+$/.test(name)) score -= 30;
  if (/__(tests|mocks|fixtures|snapshots)__/.test(name)) score -= 30;
  if (/\.d\.ts$/.test(name)) score -= 15;
  if (/generated|dist\/|\.min\./.test(name)) score -= 20;
  if (/migration|seed/.test(name)) score -= 10;
  if (/\.lock|\.config\.[^/]+$/.test(name)) score -= 10;

  // Tutorial / example / docs_src files — these are illustrative snippets,
  // not core library code. Heavy penalty keeps them out of the top 50.
  if (/\b(docs_src|examples?|samples?|tutorials?|snippets?|demos?)\b/.test(name)) score -= 25;
  // Vendored or third-party code
  if (/\b(vendor|third[_-]?party|external|node_modules)\b/.test(name)) score -= 20;

  // ── Depth bonus ────────────────────────────────────────────────────
  // Core library files live near the project root (depth 1-2).
  // Deeply nested files (depth 4+) are usually less architecturally significant.
  const depth = mod.filePath.split("/").length - 1;
  if (depth <= 2) score += 6;
  else if (depth >= 4) score -= 3;

  // Import graph: more imports = more architectural significance
  score += Math.min(mod.imports.length, 8);

  return score;
}

/**
 * Select modules with diversity — no single directory dominates.
 * Picks top-scored modules but limits how many come from the same parent dir.
 */
function selectDiverseModules(
  modules: ModuleInfo[],
  maxModules: number
): { selected: ModuleInfo[]; skipped: ModuleInfo[] } {
  const scored = modules.map((mod) => ({ mod, score: scoreModuleForDemo(mod) }));
  scored.sort((a, b) => b.score - a.score);

  // Two-level directory caps prevent both leaf directories (e.g. docs_src/security/)
  // and parent directories (e.g. docs_src/) from dominating the selection.
  const maxPerLeafDir = Math.max(3, Math.ceil(maxModules * 0.2));   // ~20% per leaf
  const maxPerTopDir = Math.max(5, Math.ceil(maxModules * 0.3));    // ~30% per top-level
  const leafDirCounts: Record<string, number> = {};
  const topDirCounts: Record<string, number> = {};
  const selected: ModuleInfo[] = [];
  const skipped: ModuleInfo[] = [];

  for (const { mod } of scored) {
    if (selected.length >= maxModules) {
      skipped.push(mod);
      continue;
    }

    const parts = mod.filePath.split("/");
    const leafDir = parts.slice(0, -1).join("/");
    const topDir = parts[0] || leafDir;  // first path segment (e.g. "docs_src", "fastapi")

    const leafCount = leafDirCounts[leafDir] || 0;
    const topCount = topDirCounts[topDir] || 0;

    if (leafCount >= maxPerLeafDir || topCount >= maxPerTopDir) {
      skipped.push(mod);
      continue;
    }

    leafDirCounts[leafDir] = leafCount + 1;
    topDirCounts[topDir] = topCount + 1;
    selected.push(mod);
  }

  // If we haven't filled the budget (due to dir caps), backfill from skipped
  if (selected.length < maxModules && skipped.length > 0) {
    const backfill = skipped.splice(0, maxModules - selected.length);
    selected.push(...backfill);
  }

  return { selected, skipped };
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

  /** Max modules to summarize (excess skipped). Useful for try-mode. */
  maxModules?: number;
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
 * to O(modules), which is more efficient regardless of backend.
 *
 * Fault-tolerant:
 * - If the API key is missing, returns modules unchanged
 * - If individual API calls fail, those summaries are skipped
 * - Cached summaries are reused when content hasn't changed
 * - Retry with backoff handles transient network errors
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
    concurrency = 10,
    delayMs = 0,
    maxModules,
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
  let generated = 0;
  let cached = 0;
  let failed = 0;
  let firstError: string | undefined;

  // Check if provider supports general generate() (needed for batch prompts)
  const canBatch = "generate" in provider && typeof (provider as AIProvider).generate === "function";

  // Rate-limited providers skip symbol-level summaries to halve token usage.
  // Local models have no rate limits; remote free tiers (concurrency ≤ 4) do.
  const isLocal = providerConfig.name === "local" || providerConfig.name === "ollama";
  const isRateLimited = !isLocal && concurrency <= 4;

  // Pre-build the system prompt once (Groq caches these — cached tokens are free)
  const systemPrompt = buildBatchSystemPrompt();

  // Number of files to pack into each API request.
  // Rate-limited providers batch 4 files/request to stay under TPM limits.
  // Groq free tier: 30 RPM, 30k TPM — 4 files ≈ 2k tokens/req.
  const filesPerRequest = isRateLimited ? 4 : 1;

  // Detect Groq and set up parallel model pool to multiply effective rate limits.
  // Each model gets its own RPM/TPM quota, and higher-TPM models handle more files.
  const isGroq = providerConfig.base_url?.includes("groq.com") ?? false;
  const poolApiKey = providerConfig.api_key_env ? process.env[providerConfig.api_key_env] : undefined;
  const pool = isGroq && poolApiKey && providerConfig.base_url
    ? new ProviderPool(poolApiKey, providerConfig.base_url, GROQ_MODELS)
    : undefined;

  // When using a model pool, allow pool-sized concurrency since each model
  // has independent rate limits. Otherwise use the configured concurrency.
  const effectiveConcurrency = pool ? pool.size : concurrency;
  const limiter = new RateLimiter(effectiveConcurrency, pool ? 0 : delayMs);

  // Cap modules for try-mode: pick the most impressive modules with
  // directory diversity so no single folder (e.g. api/routes/) dominates.
  let modulesToSummarize = modules;
  let skippedModules: ModuleInfo[] = [];
  if (maxModules && modules.length > maxModules) {
    const { selected, skipped } = selectDiverseModules(modules, maxModules);
    modulesToSummarize = selected;
    skippedModules = skipped;
  }

  let progressCount = 0;

  // ── Multi-file batch path (rate-limited providers) ──────────────────────
  // Packs N files into a single API call, reducing request count by N×.
  // Accepts an explicit provider so parallel batches can use different models.

  async function processMultiFileBatch(
    batch: ModuleInfo[],
    batchProvider: AIProvider
  ): Promise<ModuleInfo[]> {
    // Separate cached vs uncached modules
    const results: ModuleInfo[] = [];
    const uncached: ModuleInfo[] = [];

    for (const mod of batch) {
      const cachedSummary = cache.get(mod.contentHash);
      if (cachedSummary) {
        cached++;
        results.push({ ...mod, aiSummary: cachedSummary });
        onProgress?.(++progressCount, modules.length, `Cached ${mod.filePath}`);
      } else {
        uncached.push(mod);
      }
    }

    if (uncached.length === 0) return results;

    try {
      await limiter.acquire();

      // Read all file contents in parallel
      const entries: MultiFileBatchEntry[] = await Promise.all(
        uncached.map(async (mod) => ({
          module: mod,
          content: await readFile(mod.filePath),
        }))
      );

      const prompt = buildMultiFileBatchPrompt(entries);
      const filePaths = uncached.map((m) => m.filePath);

      onProgress?.(progressCount + 1, modules.length, `Summarizing ${filePaths.length} files...`);

      // On 429, try a different model from the pool if available
      const onRateLimit = pool
        ? () => {
            if (batchProvider instanceof OpenAIProvider) {
              batchProvider.setModel(pool.nextAfter(batchProvider).getModel());
            }
          }
        : undefined;

      const response = await withRetry(
        () => batchProvider.generate(prompt, {
          maxTokens: 512,
          temperature: 0.2,
          systemPrompt,
        }),
        3, 3000, onRateLimit
      );

      const summaries = parseMultiFileBatchResponse(response, filePaths);

      for (const mod of uncached) {
        const summary = summaries[mod.filePath];
        if (summary) {
          cache.set(mod.contentHash, summary);
          generated++;
          results.push({ ...mod, aiSummary: summary });
        } else {
          failed++;
          results.push(mod);
        }
        onProgress?.(++progressCount, modules.length, `Summarizing ${mod.filePath}`);
      }

      return results;
    } catch (err) {
      for (const mod of uncached) {
        failed++;
        results.push(mod);
        onProgress?.(++progressCount, modules.length, `Summarizing ${mod.filePath}`);
      }
      if (!firstError) {
        firstError = err instanceof Error ? err.message : String(err);
      }
      return results;
    } finally {
      await limiter.release();
    }
  }

  // ── Single-file path (local/unrestricted providers) ─────────────────────

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

    try {
      await limiter.acquire();
      const content = await readFile(mod.filePath);

      if (canBatch && uncachedSymbols.length > 0) {
        const batchPrompt = buildBatchSummaryPrompt(mod, content, uncachedSymbols);
        const response = await withRetry(
          () => (provider as AIProvider).generate(batchPrompt, {
            maxTokens: 256,
            temperature: 0.2,
            systemPrompt,
          })
        );
        const result = parseBatchSummaryResponse(response, uncachedSymbols.map(s => s.name));

        const moduleSummary = cachedModuleSummary || result.moduleSummary;
        if (!cachedModuleSummary && result.moduleSummary) {
          cache.set(mod.contentHash, result.moduleSummary);
          generated++;
        } else if (cachedModuleSummary) {
          cached++;
        }

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
        let moduleSummary = cachedModuleSummary;
        if (!moduleSummary) {
          if (canBatch) {
            const batchPrompt = buildBatchSummaryPrompt(mod, content, []);
            const response = await withRetry(
              () => (provider as AIProvider).generate(batchPrompt, {
                maxTokens: 256,
                temperature: 0.2,
                systemPrompt,
              })
            );
            const result = parseBatchSummaryResponse(response, []);
            moduleSummary = result.moduleSummary;
          } else {
            moduleSummary = await withRetry(
              () => provider!.summarizeModule(mod, content)
            );
          }
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
      return {
        ...mod,
        aiSummary: cachedModuleSummary,
        symbols: updatedSymbols,
      };
    } finally {
      await limiter.release();
    }
  }

  // ── Dispatch ────────────────────────────────────────────────────────────

  let updatedModules: ModuleInfo[];

  if (pool && canBatch) {
    // ── Groq model pool: capacity-aware parallel dispatch ───────────────
    // Each model gets files proportional to its TPM limit:
    //   compound (70K TPM) → 10 files, scout (30K) → 8, llama-70b (12K) → 6, etc.
    // All models fire in parallel per wave. ~65 files/wave total.
    // For 50 try-mode files, this means a single wave — all at once.
    const allResults: ModuleInfo[] = [];
    let remaining = [...modulesToSummarize];

    while (remaining.length > 0) {
      const assignments = pool.planWave(remaining);
      const consumed = assignments.reduce((n, a) => n + a.batch.length, 0);

      const waveResults = await Promise.all(
        assignments.map(({ provider: p, batch }) =>
          processMultiFileBatch(batch, p)
        )
      );
      for (const results of waveResults) {
        allResults.push(...results);
      }

      remaining = remaining.slice(consumed);

      // Brief pause between waves to let rate windows recover
      if (remaining.length > 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    updatedModules = [...allResults, ...skippedModules];
  } else if (isRateLimited && canBatch && filesPerRequest > 1) {
    // ── Sequential multi-file batching (non-Groq rate-limited providers) ──
    const allResults: ModuleInfo[] = [];
    const chunks: ModuleInfo[][] = [];
    for (let i = 0; i < modulesToSummarize.length; i += filesPerRequest) {
      chunks.push(modulesToSummarize.slice(i, i + filesPerRequest));
    }
    for (const chunk of chunks) {
      const batchResults = await processMultiFileBatch(chunk, provider as AIProvider);
      allResults.push(...batchResults);
    }

    updatedModules = [...allResults, ...skippedModules];
  } else {
    // Single-file: parallel with rate limiter (local/unrestricted providers)
    const summarized = await Promise.all(modulesToSummarize.map(processModule));
    updatedModules = [...summarized, ...skippedModules];
  }

  // ── Retry pass for failed modules ──────────────────────────────────────
  // Transient 503s and empty responses often succeed on a second attempt
  // after rate windows have partially recovered.
  const failedModules = updatedModules.filter((m) => !m.aiSummary && !skippedModules.includes(m));

  if (failedModules.length > 0 && failedModules.length < modules.length && canBatch) {
    onProgress?.(progressCount, modules.length,
      `Retrying ${failedModules.length} failed modules...`);

    // Brief pause before retry to let rate limits recover
    await new Promise((r) => setTimeout(r, 3000));

    // Reset counters for retry pass
    const retryFailed = failed;
    failed = 0;
    progressCount = modules.length - failedModules.length;

    if (pool) {
      let remaining = [...failedModules];
      while (remaining.length > 0) {
        const assignments = pool.planWave(remaining);
        const consumed = assignments.reduce((n, a) => n + a.batch.length, 0);
        const waveResults = await Promise.all(
          assignments.map(({ provider: p, batch }) => processMultiFileBatch(batch, p))
        );
        for (const results of waveResults) {
          // Replace failed modules in updatedModules with retry results
          for (const mod of results) {
            if (mod.aiSummary) {
              const idx = updatedModules.findIndex((m) => m.filePath === mod.filePath);
              if (idx >= 0) updatedModules[idx] = mod;
            }
          }
        }
        remaining = remaining.slice(consumed);
        if (remaining.length > 0) await new Promise((r) => setTimeout(r, 1500));
      }
    } else {
      // Sequential retry for proxy/non-pool path
      const retryChunks: ModuleInfo[][] = [];
      for (let i = 0; i < failedModules.length; i += filesPerRequest) {
        retryChunks.push(failedModules.slice(i, i + filesPerRequest));
      }
      for (const chunk of retryChunks) {
        const results = await processMultiFileBatch(chunk, provider as AIProvider);
        for (const mod of results) {
          if (mod.aiSummary) {
            const idx = updatedModules.findIndex((m) => m.filePath === mod.filePath);
            if (idx >= 0) updatedModules[idx] = mod;
          }
        }
      }
    }

    // Merge retry failures back (don't double-count)
    failed = updatedModules.filter((m) => !m.aiSummary && !skippedModules.includes(m)).length;
  }

  // Log failure summary if calls still failed after retry
  if (failed > 0 && onProgress) {
    const truncatedError = firstError && firstError.length > 120
      ? firstError.slice(0, 120) + "..."
      : firstError;
    onProgress(modules.length, modules.length,
      `AI summary failures: ${failed} calls failed after retry. First error: ${truncatedError || "unknown"}`);
  }

  return {
    modules: updatedModules,
    cache: cache.toArray(),
    generated,
    cached,
    failed,
  };
}
