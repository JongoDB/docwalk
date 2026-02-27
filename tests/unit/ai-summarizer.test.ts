/**
 * AI Summarizer Tests
 *
 * Tests the caching logic, provider creation, and graceful fallback
 * behavior without making actual API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  SummaryCache,
  createProvider,
  summarizeModules,
} from "../../src/analysis/ai-summarizer.js";
import { AnthropicProvider } from "../../src/analysis/providers/anthropic.js";
import { OpenAIProvider } from "../../src/analysis/providers/openai.js";
import { OllamaProvider } from "../../src/analysis/providers/ollama.js";
import type { ModuleInfo } from "../../src/analysis/types.js";

// ─── Summary Cache ──────────────────────────────────────────────────────────

describe("SummaryCache", () => {
  it("stores and retrieves entries by content hash", () => {
    const cache = new SummaryCache();
    cache.set("abc123", "This module handles auth.");
    expect(cache.get("abc123")).toBe("This module handles auth.");
  });

  it("returns undefined for missing entries", () => {
    const cache = new SummaryCache();
    expect(cache.get("nonexistent")).toBeUndefined();
  });

  it("initializes from existing entries", () => {
    const cache = new SummaryCache([
      { contentHash: "hash1", summary: "Summary 1", generatedAt: "2024-01-01" },
      { contentHash: "hash2", summary: "Summary 2", generatedAt: "2024-01-01" },
    ]);
    expect(cache.get("hash1")).toBe("Summary 1");
    expect(cache.get("hash2")).toBe("Summary 2");
    expect(cache.size).toBe(2);
  });

  it("exports all entries to array", () => {
    const cache = new SummaryCache();
    cache.set("a", "Summary A");
    cache.set("b", "Summary B");

    const arr = cache.toArray();
    expect(arr).toHaveLength(2);
    expect(arr.map((e) => e.contentHash).sort()).toEqual(["a", "b"]);
  });

  it("overwrites existing entry with same hash", () => {
    const cache = new SummaryCache();
    cache.set("abc", "Old summary");
    cache.set("abc", "New summary");
    expect(cache.get("abc")).toBe("New summary");
    expect(cache.size).toBe(1);
  });
});

// ─── Provider Creation ──────────────────────────────────────────────────────

describe("createProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns undefined when API key env is not set", () => {
    delete process.env.DOCWALK_AI_KEY;
    const provider = createProvider({
      name: "anthropic",
      api_key_env: "DOCWALK_AI_KEY",
    });
    expect(provider).toBeUndefined();
  });

  it("creates Anthropic provider when key is available", () => {
    process.env.DOCWALK_AI_KEY = "test-key";
    const provider = createProvider({
      name: "anthropic",
      api_key_env: "DOCWALK_AI_KEY",
    });
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider!.name).toBe("Anthropic Claude");
  });

  it("creates OpenAI provider when key is available", () => {
    process.env.MY_OPENAI_KEY = "test-key";
    const provider = createProvider({
      name: "openai",
      api_key_env: "MY_OPENAI_KEY",
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider!.name).toBe("OpenAI GPT");
  });

  it("creates Ollama provider for local provider name", () => {
    process.env.DOCWALK_AI_KEY = "test-key";
    const provider = createProvider({
      name: "local",
      api_key_env: "DOCWALK_AI_KEY",
    });
    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider!.name).toBe("Ollama (Local)");
  });

  it("uses custom env var name", () => {
    process.env.CUSTOM_KEY = "custom-value";
    const provider = createProvider({
      name: "anthropic",
      api_key_env: "CUSTOM_KEY",
    });
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });
});

// ─── Graceful Fallback ──────────────────────────────────────────────────────

describe("summarizeModules", () => {
  const mockModule: ModuleInfo = {
    filePath: "src/index.ts",
    language: "typescript",
    symbols: [
      {
        id: "src/index.ts:hello",
        name: "hello",
        kind: "function",
        visibility: "public",
        location: { file: "src/index.ts", line: 1, column: 0 },
        exported: true,
      },
    ],
    imports: [],
    exports: [{ name: "hello", isDefault: false, isReExport: false }],
    fileSize: 100,
    lineCount: 5,
    contentHash: "hash123",
    analyzedAt: "2024-01-01",
  };

  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns modules unchanged when API key is missing", async () => {
    delete process.env.DOCWALK_AI_KEY;

    const result = await summarizeModules({
      providerConfig: { name: "anthropic", api_key_env: "DOCWALK_AI_KEY" },
      modules: [mockModule],
      readFile: async () => "export const hello = 'world';",
    });

    expect(result.modules).toEqual([mockModule]);
    expect(result.generated).toBe(0);
    expect(result.cached).toBe(0);
    expect(result.failed).toBe(0);
  });

  it("preserves previous cache when provider unavailable", async () => {
    delete process.env.DOCWALK_AI_KEY;

    const previousCache = [
      { contentHash: "old-hash", summary: "Old summary", generatedAt: "2024-01-01" },
    ];

    const result = await summarizeModules({
      providerConfig: { name: "anthropic", api_key_env: "DOCWALK_AI_KEY" },
      modules: [mockModule],
      readFile: async () => "",
      previousCache,
    });

    expect(result.cache).toEqual(previousCache);
  });

  it("uses cached summaries when content hash matches", async () => {
    process.env.DOCWALK_AI_KEY = "test-key";

    // Mock the module import to avoid real API calls
    const result = await summarizeModules({
      providerConfig: { name: "anthropic", api_key_env: "DOCWALK_AI_KEY" },
      modules: [mockModule],
      readFile: async () => "export const hello = 'world';",
      previousCache: [
        {
          contentHash: "hash123",
          summary: "This is the cached module summary",
          generatedAt: "2024-01-01",
        },
        {
          contentHash: "hash123:src/index.ts:hello",
          summary: "This is the cached function summary",
          generatedAt: "2024-01-01",
        },
      ],
    });

    // Module summary should come from cache
    expect(result.modules[0].aiSummary).toBe("This is the cached module summary");
    // Symbol summary should come from cache
    expect(result.modules[0].symbols[0].aiSummary).toBe("This is the cached function summary");
    expect(result.cached).toBe(2);
    expect(result.generated).toBe(0);
  });

  it("tracks progress via callback", async () => {
    delete process.env.DOCWALK_AI_KEY;

    const progress: string[] = [];

    await summarizeModules({
      providerConfig: { name: "anthropic", api_key_env: "DOCWALK_AI_KEY" },
      modules: [mockModule],
      readFile: async () => "",
      onProgress: (_c, _t, msg) => progress.push(msg),
    });

    // No progress reported when provider is unavailable (returns early)
    expect(progress).toHaveLength(0);
  });
});
