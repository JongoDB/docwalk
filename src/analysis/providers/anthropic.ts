/**
 * Anthropic Claude AI Provider
 */

import type { ModuleInfo, Symbol } from "../types.js";
import type { AIProvider, GenerateOptions } from "./base.js";
import { buildModuleSummaryPrompt, buildSymbolSummaryPrompt } from "./base.js";

export class AnthropicProvider implements AIProvider {
  readonly name = "Anthropic Claude";
  private readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || "claude-sonnet-4-20250514";
  }

  async summarizeModule(module: ModuleInfo, fileContent: string): Promise<string> {
    return this.callAPI(buildModuleSummaryPrompt(module, fileContent));
  }

  async summarizeSymbol(symbol: Symbol, fileContent: string, filePath: string): Promise<string> {
    return this.callAPI(buildSymbolSummaryPrompt(symbol, fileContent, filePath));
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    return this.callAPI(prompt, options);
  }

  private async callAPI(prompt: string, options?: GenerateOptions): Promise<string> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: this.apiKey });

    const messages: Array<{ role: "user"; content: string }> = [
      { role: "user", content: prompt },
    ];

    const response = await client.messages.create({
      model: this.model,
      max_tokens: options?.maxTokens ?? 256,
      ...(options?.systemPrompt ? { system: options.systemPrompt } : {}),
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      messages,
    });

    const block = response.content[0];
    if (block.type === "text") {
      return block.text.trim();
    }
    return "";
  }
}
