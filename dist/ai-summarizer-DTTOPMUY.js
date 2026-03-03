import {
  OpenAIProvider,
  buildBatchSummaryPrompt,
  buildBatchSystemPrompt,
  buildMultiFileBatchPrompt,
  createProvider,
  parseBatchSummaryResponse,
  parseMultiFileBatchResponse
} from "./chunk-5FUP7YMS.js";

// src/analysis/ai-summarizer.ts
var GROQ_MODELS = [
  // Reliable Groq models only — kimi-k2 and gpt-oss frequently return 503.
  // Cap all models at 3-5 files/request for reliable JSON parsing.
  // 7 models × ~4 files = ~28 files/wave. 50 files in 2 waves (~4-6s).
  { id: "groq/compound", rpm: 30, tpm: 7e4, filesPerRequest: 5 },
  { id: "groq/compound-mini", rpm: 30, tpm: 7e4, filesPerRequest: 5 },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", rpm: 30, tpm: 3e4, filesPerRequest: 4 },
  { id: "llama-3.3-70b-versatile", rpm: 30, tpm: 12e3, filesPerRequest: 4 },
  { id: "meta-llama/llama-4-maverick-17b-128e-instruct", rpm: 30, tpm: 6e3, filesPerRequest: 3 },
  { id: "llama-3.1-8b-instant", rpm: 30, tpm: 6e3, filesPerRequest: 3 },
  { id: "qwen/qwen3-32b", rpm: 60, tpm: 6e3, filesPerRequest: 3 }
];
var ProviderPool = class {
  slots;
  slotIndex = 0;
  constructor(apiKey, baseURL, specs) {
    this.slots = specs.map((spec) => ({
      provider: new OpenAIProvider(apiKey, spec.id, baseURL),
      spec
    }));
  }
  /** Expose slots for round-robin retry access. */
  getSlots() {
    return this.slots;
  }
  /**
   * Plan work distribution for a set of modules.
   * Returns assignments: which provider handles which modules, respecting
   * per-model TPM capacity. Higher-TPM models get more files.
   */
  planWave(modules) {
    const assignments = [];
    let offset = 0;
    for (const slot of this.slots) {
      if (offset >= modules.length) break;
      const count = Math.min(slot.spec.filesPerRequest, modules.length - offset);
      assignments.push({
        provider: slot.provider,
        batch: modules.slice(offset, offset + count)
      });
      offset += count;
    }
    return assignments;
  }
  /** Total files that can be processed in one wave across all models. */
  get waveCapacity() {
    return this.slots.reduce((sum, s) => sum + s.spec.filesPerRequest, 0);
  }
  /** Get a different provider than the one that failed (for retry on 429). */
  nextAfter(failed) {
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
  get size() {
    return this.slots.length;
  }
};
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
async function withRetry(fn, maxRetries = 3, baseDelayMs = 3e3, onRateLimit) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      const isRateLimit = message.includes("429") || message.toLowerCase().includes("rate") || message.toLowerCase().includes("quota") || message.toLowerCase().includes("resource_exhausted");
      if (!isRateLimit || attempt === maxRetries) throw err;
      onRateLimit?.();
      const delay = onRateLimit ? 500 : baseDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
function scoreModuleForDemo(mod) {
  let score = 0;
  const exported = mod.symbols.filter((s) => s.exported);
  const classes = exported.filter((s) => s.kind === "class");
  const interfaces = exported.filter((s) => s.kind === "interface");
  const functions = exported.filter((s) => s.kind === "function");
  const types = exported.filter((s) => s.kind === "type" || s.kind === "enum");
  score += Math.min(classes.length, 3) * 15;
  score += Math.min(interfaces.length, 4) * 12;
  score += Math.min(functions.length, 5) * 4;
  score += Math.min(types.length, 5) * 3;
  const kinds = new Set(exported.map((s) => s.kind));
  score += (kinds.size - 1) * 8;
  score += Math.min(exported.filter((s) => s.docs?.summary).length, 8) * 3;
  const name = mod.filePath.toLowerCase();
  const base = name.split("/").pop() || "";
  if (/^(index|main|app|server)\.[^/]+$/.test(base)) score += 12;
  if (/model|entity|schema|types/.test(base)) score += 10;
  if (/config/.test(base)) score += 8;
  if (/service|controller|manager|handler/.test(base)) score += 6;
  if (/store|state|context/.test(base)) score += 8;
  if (/hook|composable/.test(base)) score += 6;
  if (/component|widget|view|page/.test(base)) score += 5;
  if (/util|helper|lib/.test(base)) score += 4;
  if (/middleware|interceptor|guard/.test(base)) score += 5;
  if (/factory|builder|provider/.test(base)) score += 6;
  if (/route|endpoint|api/.test(base)) score += 3;
  if (mod.lineCount >= 80 && mod.lineCount <= 400) score += 5;
  else if (mod.lineCount >= 50 && mod.lineCount <= 600) score += 3;
  if (mod.lineCount < 15) score -= 10;
  if (/\.(test|spec|mock|fixture)\.[^/]+$/.test(name)) score -= 30;
  if (/__(tests|mocks|fixtures|snapshots)__/.test(name)) score -= 30;
  if (/\.d\.ts$/.test(name)) score -= 15;
  if (/generated|dist\/|\.min\./.test(name)) score -= 20;
  if (/migration|seed/.test(name)) score -= 10;
  if (/\.lock|\.config\.[^/]+$/.test(name)) score -= 10;
  if (/\b(docs_src|examples?|samples?|tutorials?|snippets?|demos?)\b/.test(name)) score -= 25;
  if (/\b(vendor|third[_-]?party|external|node_modules)\b/.test(name)) score -= 20;
  const depth = mod.filePath.split("/").length - 1;
  if (depth <= 2) score += 6;
  else if (depth >= 4) score -= 3;
  score += Math.min(mod.imports.length, 8);
  return score;
}
function selectDiverseModules(modules, maxModules) {
  const scored = modules.map((mod) => ({ mod, score: scoreModuleForDemo(mod) }));
  scored.sort((a, b) => b.score - a.score);
  const maxPerLeafDir = Math.max(3, Math.ceil(maxModules * 0.2));
  const maxPerTopDir = Math.max(5, Math.ceil(maxModules * 0.3));
  const leafDirCounts = {};
  const topDirCounts = {};
  const selected = [];
  const skipped = [];
  for (const { mod } of scored) {
    if (selected.length >= maxModules) {
      skipped.push(mod);
      continue;
    }
    const parts = mod.filePath.split("/");
    const leafDir = parts.slice(0, -1).join("/");
    const topDir = parts[0] || leafDir;
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
  if (selected.length < maxModules && skipped.length > 0) {
    const backfill = skipped.splice(0, maxModules - selected.length);
    selected.push(...backfill);
  }
  return { selected, skipped };
}
async function summarizeModules(options) {
  const {
    providerConfig,
    modules,
    readFile,
    previousCache,
    onProgress,
    concurrency = 10,
    delayMs = 0,
    maxModules
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
  let generated = 0;
  let cached = 0;
  let failed = 0;
  let firstError;
  const canBatch = "generate" in provider && typeof provider.generate === "function";
  const isLocal = providerConfig.name === "local" || providerConfig.name === "ollama";
  const isRateLimited = !isLocal && concurrency <= 4;
  const systemPrompt = buildBatchSystemPrompt();
  const filesPerRequest = isRateLimited ? 4 : 1;
  const isGroq = providerConfig.base_url?.includes("groq.com") ?? false;
  const poolApiKey = providerConfig.api_key_env ? process.env[providerConfig.api_key_env] : void 0;
  const pool = isGroq && poolApiKey && providerConfig.base_url ? new ProviderPool(poolApiKey, providerConfig.base_url, GROQ_MODELS) : void 0;
  const effectiveConcurrency = pool ? pool.size : concurrency;
  const limiter = new RateLimiter(effectiveConcurrency, pool ? 0 : delayMs);
  let modulesToSummarize = modules;
  let skippedModules = [];
  if (maxModules && modules.length > maxModules) {
    const { selected, skipped } = selectDiverseModules(modules, maxModules);
    modulesToSummarize = selected;
    skippedModules = skipped;
  }
  let progressCount = 0;
  async function processMultiFileBatch(batch, batchProvider) {
    const results = [];
    const uncached = [];
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
      const entries = await Promise.all(
        uncached.map(async (mod) => ({
          module: mod,
          content: await readFile(mod.filePath)
        }))
      );
      const prompt = buildMultiFileBatchPrompt(entries);
      const filePaths = uncached.map((m) => m.filePath);
      onProgress?.(progressCount + 1, modules.length, `Summarizing ${filePaths.length} files...`);
      const onRateLimit = pool ? () => {
        if (batchProvider instanceof OpenAIProvider) {
          batchProvider.setModel(pool.nextAfter(batchProvider).getModel());
        }
      } : void 0;
      const response = await withRetry(
        () => batchProvider.generate(prompt, {
          maxTokens: 512,
          temperature: 0.2,
          systemPrompt
        }),
        pool ? 1 : 3,
        // Pool: fail fast (1 retry), catch in retry pass
        pool ? 500 : 3e3,
        // Pool: short delay (model rotation handles 429)
        onRateLimit
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
  async function processModule(mod) {
    onProgress?.(++progressCount, modules.length, `Summarizing ${mod.filePath}`);
    const updatedSymbols = [...mod.symbols];
    const exportedSymbols = isLocal ? [] : updatedSymbols.filter(
      (s) => s.exported && (s.kind === "function" || s.kind === "class" || s.kind === "interface")
    );
    const cachedModuleSummary = cache.get(mod.contentHash);
    const uncachedSymbols = [];
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
          () => provider.generate(batchPrompt, {
            maxTokens: 256,
            temperature: 0.2,
            systemPrompt
          })
        );
        const result = parseBatchSummaryResponse(response, uncachedSymbols.map((s) => s.name));
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
              () => provider.generate(batchPrompt, {
                maxTokens: 256,
                temperature: 0.2,
                systemPrompt
              })
            );
            const result = parseBatchSummaryResponse(response, []);
            moduleSummary = result.moduleSummary;
          } else {
            moduleSummary = await withRetry(
              () => provider.summarizeModule(mod, content)
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
        symbols: updatedSymbols
      };
    } finally {
      await limiter.release();
    }
  }
  let updatedModules;
  if (pool && canBatch) {
    const allResults = [];
    let remaining = [...modulesToSummarize];
    while (remaining.length > 0) {
      const assignments = pool.planWave(remaining);
      const consumed = assignments.reduce((n, a) => n + a.batch.length, 0);
      const waveResults = await Promise.all(
        assignments.map(
          ({ provider: p, batch }) => processMultiFileBatch(batch, p)
        )
      );
      for (const results of waveResults) {
        allResults.push(...results);
      }
      remaining = remaining.slice(consumed);
      if (remaining.length > 0) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    updatedModules = [...allResults, ...skippedModules];
  } else if (isRateLimited && canBatch && filesPerRequest > 1) {
    const allResults = [];
    const chunks = [];
    for (let i = 0; i < modulesToSummarize.length; i += filesPerRequest) {
      chunks.push(modulesToSummarize.slice(i, i + filesPerRequest));
    }
    for (const chunk of chunks) {
      const batchResults = await processMultiFileBatch(chunk, provider);
      allResults.push(...batchResults);
    }
    updatedModules = [...allResults, ...skippedModules];
  } else {
    const summarized = await Promise.all(modulesToSummarize.map(processModule));
    updatedModules = [...summarized, ...skippedModules];
  }
  const failedModules = updatedModules.filter((m) => !m.aiSummary && !skippedModules.includes(m));
  if (failedModules.length > 0 && failedModules.length < modules.length && canBatch) {
    onProgress?.(
      progressCount,
      modules.length,
      `Retrying ${failedModules.length} failed modules...`
    );
    await new Promise((r) => setTimeout(r, 500));
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
          for (const mod of results) {
            if (mod.aiSummary) {
              const idx = updatedModules.findIndex((m) => m.filePath === mod.filePath);
              if (idx >= 0) updatedModules[idx] = mod;
            }
          }
        }
        remaining = remaining.slice(consumed);
      }
    } else {
      const retryChunks = [];
      for (let i = 0; i < failedModules.length; i += filesPerRequest) {
        retryChunks.push(failedModules.slice(i, i + filesPerRequest));
      }
      for (const chunk of retryChunks) {
        const results = await processMultiFileBatch(chunk, provider);
        for (const mod of results) {
          if (mod.aiSummary) {
            const idx = updatedModules.findIndex((m) => m.filePath === mod.filePath);
            if (idx >= 0) updatedModules[idx] = mod;
          }
        }
      }
    }
    failed = updatedModules.filter((m) => !m.aiSummary && !skippedModules.includes(m)).length;
  }
  if (failed > 0 && onProgress) {
    const truncatedError = firstError && firstError.length > 120 ? firstError.slice(0, 120) + "..." : firstError;
    onProgress(
      modules.length,
      modules.length,
      `AI summary failures: ${failed} calls failed after retry. First error: ${truncatedError || "unknown"}`
    );
  }
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
