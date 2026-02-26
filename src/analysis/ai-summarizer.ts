/**
 * DocWalk AI Summarizer
 *
 * Generates human-readable summaries for modules and symbols
 * using LLM providers (Anthropic Claude, OpenAI GPT).
 *
 * Features:
 * - Provider-agnostic interface with Anthropic and OpenAI implementations
 * - Rate limiting with configurable concurrency and delay
 * - Content-hash-based caching to avoid re-summarizing unchanged code
 * - Graceful fallback when API keys are missing or calls fail
 * - Batch processing with progress reporting
 */

import type { AnalysisConfig } from "../config/schema.js";
import type { ModuleInfo, Symbol } from "./types.js";

// ─── Provider Interface ─────────────────────────────────────────────────────

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

/** Provider-agnostic interface for LLM summarization. */
export interface AISummaryProvider {
  /** Provider name for logging. */
  readonly name: string;

  /** Generate a summary for a module (file-level overview). */
  summarizeModule(module: ModuleInfo, fileContent: string): Promise<string>;

  /** Generate a summary for a specific symbol (function, class, etc.). */
  summarizeSymbol(symbol: Symbol, fileContent: string, filePath: string): Promise<string>;
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

// ─── Anthropic Provider ──────────────────────────────────────────────────────

/** Summarization provider using Anthropic's Claude API. */
export class AnthropicSummaryProvider implements AISummaryProvider {
  readonly name = "Anthropic Claude";
  private readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || "claude-sonnet-4-20250514";
  }

  async summarizeModule(module: ModuleInfo, fileContent: string): Promise<string> {
    const symbolList = module.symbols
      .filter((s) => s.exported)
      .map((s) => `- ${s.kind} ${s.name}${s.docs?.summary ? `: ${s.docs.summary}` : ""}`)
      .join("\n");

    const prompt = `You are a technical documentation assistant. Summarize this source file in 2-3 sentences for a documentation site. Focus on what the module does and its role in the project. Be concise and precise.

File: ${module.filePath}
Language: ${module.language}
Exported symbols:
${symbolList || "(none)"}

File content (truncated to first 200 lines):
\`\`\`
${fileContent.split("\n").slice(0, 200).join("\n")}
\`\`\`

Write only the summary, no preamble.`;

    return this.callAPI(prompt);
  }

  async summarizeSymbol(symbol: Symbol, fileContent: string, filePath: string): Promise<string> {
    const lines = fileContent.split("\n");
    const startLine = symbol.location.line - 1;
    const endLine = symbol.location.endLine
      ? symbol.location.endLine
      : Math.min(startLine + 30, lines.length);
    const snippet = lines.slice(startLine, endLine).join("\n");

    const prompt = `You are a technical documentation assistant. Write a brief 1-2 sentence summary for this ${symbol.kind}. Focus on what it does and when to use it.

File: ${filePath}
Symbol: ${symbol.name} (${symbol.kind})
${symbol.parameters ? `Parameters: ${symbol.parameters.map((p) => p.name).join(", ")}` : ""}
${symbol.returns?.type ? `Returns: ${symbol.returns.type}` : ""}

Code:
\`\`\`
${snippet}
\`\`\`

Write only the summary, no preamble.`;

    return this.callAPI(prompt);
  }

  private async callAPI(prompt: string): Promise<string> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: this.apiKey });

    const response = await client.messages.create({
      model: this.model,
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    if (block.type === "text") {
      return block.text.trim();
    }
    return "";
  }
}

// ─── OpenAI Provider ─────────────────────────────────────────────────────────

/** Summarization provider using OpenAI's GPT API. */
export class OpenAISummaryProvider implements AISummaryProvider {
  readonly name = "OpenAI GPT";
  private readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || "gpt-4o-mini";
  }

  async summarizeModule(module: ModuleInfo, fileContent: string): Promise<string> {
    const symbolList = module.symbols
      .filter((s) => s.exported)
      .map((s) => `- ${s.kind} ${s.name}${s.docs?.summary ? `: ${s.docs.summary}` : ""}`)
      .join("\n");

    const prompt = `Summarize this source file in 2-3 sentences for a documentation site. Focus on what the module does and its role in the project. Be concise and precise.

File: ${module.filePath}
Language: ${module.language}
Exported symbols:
${symbolList || "(none)"}

File content (truncated to first 200 lines):
\`\`\`
${fileContent.split("\n").slice(0, 200).join("\n")}
\`\`\`

Write only the summary, no preamble.`;

    return this.callAPI(prompt);
  }

  async summarizeSymbol(symbol: Symbol, fileContent: string, filePath: string): Promise<string> {
    const lines = fileContent.split("\n");
    const startLine = symbol.location.line - 1;
    const endLine = symbol.location.endLine
      ? symbol.location.endLine
      : Math.min(startLine + 30, lines.length);
    const snippet = lines.slice(startLine, endLine).join("\n");

    const prompt = `Write a brief 1-2 sentence summary for this ${symbol.kind}. Focus on what it does and when to use it.

File: ${filePath}
Symbol: ${symbol.name} (${symbol.kind})
${symbol.parameters ? `Parameters: ${symbol.parameters.map((p) => p.name).join(", ")}` : ""}
${symbol.returns?.type ? `Returns: ${symbol.returns.type}` : ""}

Code:
\`\`\`
${snippet}
\`\`\`

Write only the summary, no preamble.`;

    return this.callAPI(prompt);
  }

  private async callAPI(prompt: string): Promise<string> {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: this.apiKey });

    const response = await client.chat.completions.create({
      model: this.model,
      max_tokens: 256,
      messages: [
        {
          role: "system",
          content: "You are a technical documentation assistant. Be concise and precise.",
        },
        { role: "user", content: prompt },
      ],
    });

    return response.choices[0]?.message?.content?.trim() || "";
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
 * Create the appropriate AI provider based on config.
 * Returns undefined if the API key is not available.
 */
export function createProvider(
  config: NonNullable<AnalysisConfig["ai_provider"]>
): AISummaryProvider | undefined {
  const apiKey = process.env[config.api_key_env];

  if (!apiKey) {
    return undefined;
  }

  switch (config.name) {
    case "anthropic":
      return new AnthropicSummaryProvider(apiKey, config.model);
    case "openai":
      return new OpenAISummaryProvider(apiKey, config.model);
    case "local":
      // Local provider not yet implemented
      return undefined;
    default:
      return undefined;
  }
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
  const provider = createProvider(providerConfig);
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
