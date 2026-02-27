/**
 * Ollama AI Provider
 *
 * Uses Ollama's native /api/chat endpoint for better control over
 * context window size and generation parameters. A smaller num_ctx
 * means less VRAM per slot, enabling more parallel requests.
 */

import type { ModuleInfo, Symbol } from "../types.js";
import type { AIProvider, GenerateOptions } from "./base.js";
import { buildModuleSummaryPrompt, buildSymbolSummaryPrompt } from "./base.js";

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

export class OllamaProvider implements AIProvider {
  readonly name: string = "Ollama (Local)";
  private readonly model: string;
  private readonly baseURL: string;

  constructor(model?: string, baseURL?: string) {
    this.model = model || "llama3.2";
    // Strip /v1 suffix if present (user may have set the OpenAI-compat URL)
    const raw = baseURL || DEFAULT_OLLAMA_BASE_URL;
    this.baseURL = raw.replace(/\/v1\/?$/, "");
  }

  async summarizeModule(module: ModuleInfo, fileContent: string): Promise<string> {
    return this.generate(buildModuleSummaryPrompt(module, fileContent));
  }

  async summarizeSymbol(symbol: Symbol, fileContent: string, filePath: string): Promise<string> {
    return this.generate(buildSymbolSummaryPrompt(symbol, fileContent, filePath));
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        options: {
          num_ctx: 4096,
          num_predict: options?.maxTokens ?? 256,
          ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { message?: { content?: string } };
    return data.message?.content?.trim() || "";
  }
}
