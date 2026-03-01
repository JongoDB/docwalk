/**
 * DocWalk Proxy AI Provider
 *
 * Routes AI requests through DocWalk's free AI service (ai.docwalk.dev),
 * backed by a self-hosted LiteLLM instance with local models.
 * No API key required — uses a virtual key for free-tier usage tracking.
 *
 * Used as an automatic fallback when `--ai` is passed without any configured key.
 */

import type { ModuleInfo, Symbol } from "../types.js";
import type { AIProvider, GenerateOptions } from "./base.js";
import { buildModuleSummaryPrompt, buildSymbolSummaryPrompt } from "./base.js";

const DEFAULT_BASE_URL = "https://ai.docwalk.dev";

export class DocWalkProxyProvider implements AIProvider {
  readonly name = "DocWalk AI";
  private readonly baseURL: string;

  constructor(baseURL?: string) {
    this.baseURL = (baseURL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  async summarizeModule(module: ModuleInfo, fileContent: string): Promise<string> {
    return this.generate(buildModuleSummaryPrompt(module, fileContent));
  }

  async summarizeSymbol(symbol: Symbol, fileContent: string, filePath: string): Promise<string> {
    return this.generate(buildSymbolSummaryPrompt(symbol, fileContent, filePath));
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    const res = await fetch(`${this.baseURL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer sk-docwalk-free",
      },
      body: JSON.stringify({
        model: "docwalk-default",
        messages,
        max_tokens: options?.maxTokens ?? 256,
        temperature: options?.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`DocWalk AI error (${res.status}): ${body}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0].message.content.trim();
  }
}
