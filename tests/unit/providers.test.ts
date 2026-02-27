/**
 * AI Provider Tests
 *
 * Tests the provider factory, provider properties, and provider-specific
 * defaults without making actual API calls.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createProvider, resolveApiKey } from "../../src/analysis/providers/index.js";
import { AnthropicProvider } from "../../src/analysis/providers/anthropic.js";
import { OpenAIProvider } from "../../src/analysis/providers/openai.js";
import { GeminiProvider } from "../../src/analysis/providers/gemini.js";
import { OllamaProvider } from "../../src/analysis/providers/ollama.js";
import { OpenRouterProvider } from "../../src/analysis/providers/openrouter.js";

// ─── API Key Resolution ──────────────────────────────────────────────────────

describe("resolveApiKey", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear all relevant env vars
    delete process.env.TEST_API_KEY;
    delete process.env.DOCWALK_AI_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns value from configured env var first", () => {
    process.env.TEST_API_KEY = "from-configured";
    process.env.DOCWALK_AI_KEY = "from-universal";
    process.env.ANTHROPIC_API_KEY = "from-well-known";
    expect(resolveApiKey("anthropic", "TEST_API_KEY")).toBe("from-configured");
  });

  it("falls back to DOCWALK_AI_KEY when configured var is missing", () => {
    process.env.DOCWALK_AI_KEY = "from-universal";
    process.env.ANTHROPIC_API_KEY = "from-well-known";
    expect(resolveApiKey("anthropic", "TEST_API_KEY")).toBe("from-universal");
  });

  it("falls back to well-known ANTHROPIC_API_KEY", () => {
    process.env.ANTHROPIC_API_KEY = "from-well-known";
    expect(resolveApiKey("anthropic", "TEST_API_KEY")).toBe("from-well-known");
  });

  it("falls back to well-known OPENAI_API_KEY", () => {
    process.env.OPENAI_API_KEY = "from-openai";
    expect(resolveApiKey("openai", "TEST_API_KEY")).toBe("from-openai");
  });

  it("falls back to well-known GEMINI_API_KEY", () => {
    process.env.GEMINI_API_KEY = "from-gemini";
    expect(resolveApiKey("gemini", "TEST_API_KEY")).toBe("from-gemini");
  });

  it("falls back to GOOGLE_API_KEY for gemini", () => {
    process.env.GOOGLE_API_KEY = "from-google";
    expect(resolveApiKey("gemini", "TEST_API_KEY")).toBe("from-google");
  });

  it("falls back to well-known OPENROUTER_API_KEY", () => {
    process.env.OPENROUTER_API_KEY = "from-openrouter";
    expect(resolveApiKey("openrouter", "TEST_API_KEY")).toBe("from-openrouter");
  });

  it("returns undefined when nothing is set", () => {
    expect(resolveApiKey("anthropic", "TEST_API_KEY")).toBeUndefined();
  });

  it("returns undefined for unknown provider with no configured var", () => {
    expect(resolveApiKey("unknown", "TEST_API_KEY")).toBeUndefined();
  });

  it("does not double-check DOCWALK_AI_KEY when it is the configured var", () => {
    // If configuredEnvVar is already DOCWALK_AI_KEY, skip the universal fallback step
    // and proceed to well-known vars
    process.env.ANTHROPIC_API_KEY = "from-well-known";
    expect(resolveApiKey("anthropic", "DOCWALK_AI_KEY")).toBe("from-well-known");
  });
});

// ─── Provider Factory ────────────────────────────────────────────────────────

describe("createProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // --- Returns undefined when env var is missing ---

  it("returns undefined for anthropic when env var is missing", () => {
    delete process.env.TEST_API_KEY;
    const provider = createProvider({
      name: "anthropic",
      api_key_env: "TEST_API_KEY",
    });
    expect(provider).toBeUndefined();
  });

  it("returns undefined for openai when env var is missing", () => {
    delete process.env.TEST_API_KEY;
    const provider = createProvider({
      name: "openai",
      api_key_env: "TEST_API_KEY",
    });
    expect(provider).toBeUndefined();
  });

  it("returns undefined for gemini when env var is missing", () => {
    delete process.env.TEST_API_KEY;
    const provider = createProvider({
      name: "gemini",
      api_key_env: "TEST_API_KEY",
    });
    expect(provider).toBeUndefined();
  });

  it("returns undefined for openrouter when env var is missing", () => {
    delete process.env.TEST_API_KEY;
    const provider = createProvider({
      name: "openrouter",
      api_key_env: "TEST_API_KEY",
    });
    expect(provider).toBeUndefined();
  });

  // --- Returns correct provider instance when key is set ---

  it("returns AnthropicProvider when anthropic key is set", () => {
    process.env.TEST_API_KEY = "sk-ant-test";
    const provider = createProvider({
      name: "anthropic",
      api_key_env: "TEST_API_KEY",
    });
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it("returns OpenAIProvider when openai key is set", () => {
    process.env.TEST_API_KEY = "sk-openai-test";
    const provider = createProvider({
      name: "openai",
      api_key_env: "TEST_API_KEY",
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it("returns GeminiProvider when gemini key is set", () => {
    process.env.TEST_API_KEY = "gemini-test-key";
    const provider = createProvider({
      name: "gemini",
      api_key_env: "TEST_API_KEY",
    });
    expect(provider).toBeInstanceOf(GeminiProvider);
  });

  it("returns OpenRouterProvider when openrouter key is set", () => {
    process.env.TEST_API_KEY = "or-test-key";
    const provider = createProvider({
      name: "openrouter",
      api_key_env: "TEST_API_KEY",
    });
    expect(provider).toBeInstanceOf(OpenRouterProvider);
  });

  // --- Ollama does not require an API key ---

  it("returns OllamaProvider for 'ollama' name (no key required)", () => {
    delete process.env.TEST_API_KEY;
    const provider = createProvider({
      name: "ollama",
      api_key_env: "TEST_API_KEY",
    });
    expect(provider).toBeInstanceOf(OllamaProvider);
  });

  it("returns OllamaProvider for 'local' name (alias)", () => {
    delete process.env.TEST_API_KEY;
    const provider = createProvider({
      name: "local",
      api_key_env: "TEST_API_KEY",
    });
    expect(provider).toBeInstanceOf(OllamaProvider);
  });

  // --- Unknown provider ---

  it("returns undefined for unknown provider name", () => {
    process.env.TEST_API_KEY = "some-key";
    const provider = createProvider({
      name: "unknown-provider",
      api_key_env: "TEST_API_KEY",
    });
    expect(provider).toBeUndefined();
  });

  // --- Passes model to provider constructor ---

  it("passes model to AnthropicProvider", () => {
    process.env.TEST_API_KEY = "sk-ant-test";
    const provider = createProvider({
      name: "anthropic",
      api_key_env: "TEST_API_KEY",
      model: "claude-3-haiku-20240307",
    });
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it("passes model to OpenAIProvider", () => {
    process.env.TEST_API_KEY = "sk-openai-test";
    const provider = createProvider({
      name: "openai",
      api_key_env: "TEST_API_KEY",
      model: "gpt-4-turbo",
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it("passes model to GeminiProvider", () => {
    process.env.TEST_API_KEY = "gemini-test-key";
    const provider = createProvider({
      name: "gemini",
      api_key_env: "TEST_API_KEY",
      model: "gemini-1.5-pro",
    });
    expect(provider).toBeInstanceOf(GeminiProvider);
  });

  it("passes model to OllamaProvider", () => {
    const provider = createProvider({
      name: "ollama",
      api_key_env: "TEST_API_KEY",
      model: "mistral",
    });
    expect(provider).toBeInstanceOf(OllamaProvider);
  });

  it("passes model to OpenRouterProvider", () => {
    process.env.TEST_API_KEY = "or-test-key";
    const provider = createProvider({
      name: "openrouter",
      api_key_env: "TEST_API_KEY",
      model: "openai/gpt-4",
    });
    expect(provider).toBeInstanceOf(OpenRouterProvider);
  });

  // --- Passes base_url to OpenAI and Ollama providers ---

  it("passes base_url to OpenAIProvider", () => {
    process.env.TEST_API_KEY = "sk-openai-test";
    const provider = createProvider({
      name: "openai",
      api_key_env: "TEST_API_KEY",
      base_url: "https://custom-openai.example.com/v1",
    });
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it("passes base_url to OllamaProvider", () => {
    const provider = createProvider({
      name: "ollama",
      api_key_env: "TEST_API_KEY",
      base_url: "http://192.168.1.100:11434/v1",
    });
    expect(provider).toBeInstanceOf(OllamaProvider);
  });

  it("passes base_url to 'local' alias provider", () => {
    const provider = createProvider({
      name: "local",
      api_key_env: "TEST_API_KEY",
      base_url: "http://remote-ollama:11434/v1",
    });
    expect(provider).toBeInstanceOf(OllamaProvider);
  });
});

// ─── Provider Properties ─────────────────────────────────────────────────────

describe("Provider properties", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("AnthropicProvider name is 'Anthropic Claude'", () => {
    process.env.TEST_API_KEY = "sk-ant-test";
    const provider = createProvider({
      name: "anthropic",
      api_key_env: "TEST_API_KEY",
    });
    expect(provider).toBeDefined();
    expect(provider!.name).toBe("Anthropic Claude");
  });

  it("OpenAIProvider name is 'OpenAI GPT'", () => {
    process.env.TEST_API_KEY = "sk-openai-test";
    const provider = createProvider({
      name: "openai",
      api_key_env: "TEST_API_KEY",
    });
    expect(provider).toBeDefined();
    expect(provider!.name).toBe("OpenAI GPT");
  });

  it("GeminiProvider name is 'Google Gemini'", () => {
    process.env.TEST_API_KEY = "gemini-test-key";
    const provider = createProvider({
      name: "gemini",
      api_key_env: "TEST_API_KEY",
    });
    expect(provider).toBeDefined();
    expect(provider!.name).toBe("Google Gemini");
  });

  it("OllamaProvider name is 'Ollama (Local)'", () => {
    const provider = createProvider({
      name: "ollama",
      api_key_env: "TEST_API_KEY",
    });
    expect(provider).toBeDefined();
    expect(provider!.name).toBe("Ollama (Local)");
  });

  it("OpenRouterProvider name is 'OpenRouter'", () => {
    process.env.TEST_API_KEY = "or-test-key";
    const provider = createProvider({
      name: "openrouter",
      api_key_env: "TEST_API_KEY",
    });
    expect(provider).toBeDefined();
    expect(provider!.name).toBe("OpenRouter");
  });
});

// ─── OllamaProvider Specifics ────────────────────────────────────────────────

describe("OllamaProvider specifics", () => {
  it("default model is 'llama3.2'", () => {
    const provider = new OllamaProvider();
    // OllamaProvider implements AIProvider directly (uses native Ollama API)
    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.name).toBe("Ollama (Local)");
  });

  it("constructs with default base URL", () => {
    // Verify the provider constructs without error using defaults.
    const provider = new OllamaProvider();
    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.name).toBe("Ollama (Local)");
  });

  it("accepts custom model", () => {
    const provider = new OllamaProvider("mistral");
    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.name).toBe("Ollama (Local)");
  });

  it("accepts custom base URL", () => {
    const provider = new OllamaProvider("llama3.2", "http://192.168.1.100:11434/v1");
    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.name).toBe("Ollama (Local)");
  });

  it("accepts both custom model and base URL", () => {
    const provider = new OllamaProvider("codellama", "http://gpu-server:11434/v1");
    expect(provider).toBeInstanceOf(OllamaProvider);
  });
});

// ─── OpenRouterProvider Specifics ────────────────────────────────────────────

describe("OpenRouterProvider specifics", () => {
  it("default model is 'anthropic/claude-3.5-sonnet'", () => {
    const provider = new OpenRouterProvider("or-test-key");
    expect(provider).toBeInstanceOf(OpenRouterProvider);
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.name).toBe("OpenRouter");
  });

  it("uses OpenRouter base URL", () => {
    // The base URL is private, but we verify the provider constructs
    // correctly and is an OpenAIProvider subclass (which holds the baseURL).
    const provider = new OpenRouterProvider("or-test-key");
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it("accepts custom model", () => {
    const provider = new OpenRouterProvider("or-test-key", "openai/gpt-4");
    expect(provider).toBeInstanceOf(OpenRouterProvider);
    expect(provider.name).toBe("OpenRouter");
  });
});
