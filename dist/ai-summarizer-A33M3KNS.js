import {
  createProvider
} from "./chunk-NOZSCKAF.js";

// src/analysis/ai-summarizer.ts
var RateLimiter = class {
  constructor(maxConcurrent, delayMs) {
    this.maxConcurrent = maxConcurrent;
    this.delayMs = delayMs;
  }
  queue = [];
  running = 0;
  async acquire() {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }
  async release() {
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
};
var SummaryCache = class {
  entries = /* @__PURE__ */ new Map();
  constructor(existing) {
    if (existing) {
      for (const entry of existing) {
        this.entries.set(entry.contentHash, entry);
      }
    }
  }
  /** Get a cached summary if the content hash matches. */
  get(contentHash) {
    return this.entries.get(contentHash)?.summary;
  }
  /** Store a summary with its content hash. */
  set(contentHash, summary) {
    this.entries.set(contentHash, {
      contentHash,
      summary,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  /** Export all cache entries for persistence. */
  toArray() {
    return [...this.entries.values()];
  }
  get size() {
    return this.entries.size;
  }
};
async function summarizeModules(options) {
  const {
    providerConfig,
    modules,
    readFile,
    previousCache,
    onProgress,
    concurrency = 10,
    delayMs = 0
  } = options;
  const provider = createProvider(providerConfig);
  if (!provider) {
    return {
      modules,
      cache: previousCache || [],
      generated: 0,
      cached: 0,
      failed: 0
    };
  }
  const cache = new SummaryCache(previousCache);
  const limiter = new RateLimiter(concurrency, delayMs);
  let generated = 0;
  let cached = 0;
  let failed = 0;
  const isLocal = providerConfig.name === "local" || providerConfig.name === "ollama";
  let progressCount = 0;
  async function processModule(mod) {
    onProgress?.(++progressCount, modules.length, `Summarizing ${mod.filePath}`);
    const cachedModuleSummary = cache.get(mod.contentHash);
    let moduleSummary;
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
    const updatedSymbols = [...mod.symbols];
    if (!isLocal) {
      const exportedSymbols = updatedSymbols.filter(
        (s) => s.exported && (s.kind === "function" || s.kind === "class" || s.kind === "interface")
      );
      await Promise.all(exportedSymbols.map(async (sym) => {
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
      }));
    }
    return {
      ...mod,
      aiSummary: moduleSummary,
      symbols: updatedSymbols
    };
  }
  const updatedModules = await Promise.all(modules.map(processModule));
  return {
    modules: updatedModules,
    cache: cache.toArray(),
    generated,
    cached,
    failed
  };
}
export {
  SummaryCache,
  createProvider,
  summarizeModules
};
