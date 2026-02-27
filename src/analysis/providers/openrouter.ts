/**
 * OpenRouter AI Provider
 *
 * Reuses the OpenAI SDK with OpenRouter's base URL.
 * OpenRouter provides access to multiple models via a single API key.
 */

import { OpenAIProvider } from "./openai.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export class OpenRouterProvider extends OpenAIProvider {
  override readonly name: string = "OpenRouter";

  constructor(apiKey: string, model?: string) {
    super(apiKey, model || "anthropic/claude-3.5-sonnet", OPENROUTER_BASE_URL);
  }
}
