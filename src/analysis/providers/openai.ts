/**
 * OpenAI GPT AI Provider
 */

import type { ModuleInfo, Symbol } from "../types.js";
import type { AIProvider, GenerateOptions } from "./base.js";
import { buildModuleSummaryPrompt, buildSymbolSummaryPrompt } from "./base.js";

export class OpenAIProvider implements AIProvider {
  readonly name: string = "OpenAI GPT";
  private readonly model: string;
  private readonly apiKey: string;
  private readonly baseURL?: string;

  constructor(apiKey: string, model?: string, baseURL?: string) {
    this.apiKey = apiKey;
    this.model = model || "gpt-4o-mini";
    this.baseURL = baseURL;
  }

  async summarizeModule(module: ModuleInfo, fileContent: string): Promise<string> {
    return this.generate(buildModuleSummaryPrompt(module, fileContent));
  }

  async summarizeSymbol(symbol: Symbol, fileContent: string, filePath: string): Promise<string> {
    return this.generate(buildSymbolSummaryPrompt(symbol, fileContent, filePath));
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({
      apiKey: this.apiKey,
      ...(this.baseURL ? { baseURL: this.baseURL } : {}),
    });

    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const response = await client.chat.completions.create({
      model: this.model,
      max_tokens: options?.maxTokens ?? 256,
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      messages,
    });

    return response.choices[0]?.message?.content?.trim() || "";
  }
}
