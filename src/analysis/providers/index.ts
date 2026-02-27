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

/**
 * Create the appropriate AI provider based on config.
 * Returns undefined if the API key is not available (except for Ollama which needs none).
 */
export function createProvider(
  config: NonNullable<AnalysisConfig["ai_provider"]>
): AIProvider | undefined {
  const apiKey = process.env[config.api_key_env];

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
