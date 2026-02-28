/**
 * DocWalk Proxy AI Provider
 *
 * Routes AI requests through DocWalk's free proxy service (api.docwalk.dev),
 * which forwards to Gemini Flash. No API key required — the proxy holds the key.
 *
 * Used as an automatic fallback when `--ai` is passed without any configured key.
 */

import type { ModuleInfo, Symbol } from "../types.js";
import type { AIProvider, GenerateOptions } from "./base.js";
import { buildModuleSummaryPrompt, buildSymbolSummaryPrompt } from "./base.js";

const DEFAULT_BASE_URL = "https://docwalk-ai-proxy.jonathanrannabargar.workers.dev";

export class DocWalkProxyProvider implements AIProvider {
  readonly name = "DocWalk Proxy (Gemini Flash)";
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
    const res = await fetch(`${this.baseURL}/v1/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
        systemPrompt: options?.systemPrompt,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`DocWalk proxy error (${res.status}): ${body}`);
    }

    const data = (await res.json()) as { text: string };
    return data.text.trim();
  }
}
