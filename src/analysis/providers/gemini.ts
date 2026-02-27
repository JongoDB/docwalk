/**
 * Google Gemini AI Provider
 *
 * Uses the @google/generative-ai SDK. Default model: gemini-2.0-flash.
 * The Gemini free tier powers "try" builds.
 */

import type { ModuleInfo, Symbol } from "../types.js";
import type { AIProvider, GenerateOptions } from "./base.js";
import { buildModuleSummaryPrompt, buildSymbolSummaryPrompt } from "./base.js";

export class GeminiProvider implements AIProvider {
  readonly name = "Google Gemini";
  private readonly model: string;
  private readonly apiKey: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || "gemini-2.0-flash";
  }

  async summarizeModule(module: ModuleInfo, fileContent: string): Promise<string> {
    return this.generate(buildModuleSummaryPrompt(module, fileContent));
  }

  async summarizeSymbol(symbol: Symbol, fileContent: string, filePath: string): Promise<string> {
    return this.generate(buildSymbolSummaryPrompt(symbol, fileContent, filePath));
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({
      model: this.model,
      generationConfig: {
        maxOutputTokens: options?.maxTokens ?? 256,
        ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      },
      ...(options?.systemPrompt ? { systemInstruction: options.systemPrompt } : {}),
    });

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  }
}
