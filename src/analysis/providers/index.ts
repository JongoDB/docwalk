/**
 * AI Provider Registry
 *
 * Factory function to create the appropriate AI provider based on config.
 * Centralizes provider instantiation and API key resolution.
 */

export type { AISummaryProvider, AIProvider, GenerateOptions } from "./base.js";
export { AnthropicProvider } from "./anthropic.js";
export { OpenAIProvider } from "./openai.js";
export { GeminiProvider } from "./gemini.js";
export { OllamaProvider } from "./ollama.js";
export { OpenRouterProvider } from "./openrouter.js";

import type { AnalysisConfig } from "../../config/schema.js";
import type { AIProvider } from "./base.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { GeminiProvider } from "./gemini.js";
import { OllamaProvider } from "./ollama.js";
import { OpenRouterProvider } from "./openrouter.js";

/** Well-known environment variable names for each provider. */
const WELL_KNOWN_ENV_VARS: Record<string, string[]> = {
  anthropic: ["ANTHROPIC_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
};

/**
 * Resolve an API key for a provider using a priority chain:
 * 1. Explicit configured env var (`configuredEnvVar`)
 * 2. Universal override (`DOCWALK_AI_KEY`), if not already the configured var
 * 3. Well-known provider env vars (e.g. `ANTHROPIC_API_KEY` for anthropic)
 *
 * Returns `undefined` when no key is found.
 */
export function resolveApiKey(
  providerName: string,
  configuredEnvVar: string
): string | undefined {
  // 1. Explicit configured env var
  const fromConfigured = process.env[configuredEnvVar];
  if (fromConfigured) return fromConfigured;

  // 2. Universal override (skip if it's the same var we already checked)
  if (configuredEnvVar !== "DOCWALK_AI_KEY") {
    const fromUniversal = process.env.DOCWALK_AI_KEY;
    if (fromUniversal) return fromUniversal;
  }

  // 3. Well-known provider env vars
  const wellKnown = WELL_KNOWN_ENV_VARS[providerName];
  if (wellKnown) {
    for (const envVar of wellKnown) {
      if (envVar === configuredEnvVar) continue; // already checked
      const val = process.env[envVar];
      if (val) return val;
    }
  }

  return undefined;
}

/**
 * Create the appropriate AI provider based on config.
 * Returns undefined if the API key is not available (except for Ollama which needs none).
 */
export function createProvider(
  config: NonNullable<AnalysisConfig["ai_provider"]>
): AIProvider | undefined {
  const apiKey = resolveApiKey(config.name, config.api_key_env);

  switch (config.name) {
    case "anthropic": {
      if (!apiKey) return undefined;
      return new AnthropicProvider(apiKey, config.model);
    }
    case "openai": {
      if (!apiKey) return undefined;
      return new OpenAIProvider(apiKey, config.model, config.base_url);
    }
    case "gemini": {
      if (!apiKey) return undefined;
      return new GeminiProvider(apiKey, config.model);
    }
    case "ollama": {
      return new OllamaProvider(config.model, config.base_url || undefined);
    }
    case "openrouter": {
      if (!apiKey) return undefined;
      return new OpenRouterProvider(apiKey, config.model);
    }
    case "local": {
      // "local" is an alias for Ollama
      return new OllamaProvider(config.model, config.base_url || undefined);
    }
    default:
      return undefined;
  }
}
