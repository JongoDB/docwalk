/**
 * Ollama / Local AI Provider
 *
 * Reuses the OpenAI provider since Ollama (and most local servers
 * like vLLM, LM Studio, LocalAI, llama.cpp) expose an
 * OpenAI-compatible /v1/chat/completions endpoint.
 */

import { OpenAIProvider } from "./openai.js";

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";

export class OllamaProvider extends OpenAIProvider {
  override readonly name: string = "Ollama (Local)";

  constructor(model?: string, baseURL?: string) {
    // Ollama doesn't require an API key, but the OpenAI SDK expects one
    super("ollama", model || "llama3.2", baseURL || DEFAULT_OLLAMA_BASE_URL);
  }
}
