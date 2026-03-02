/**
 * DocWalk Proxy AI Provider
 *
 * Routes AI requests through DocWalk's Cloudflare Worker proxy, which holds
 * the Groq API key and handles model rotation across 8 free-tier models.
 * No API key required from the user — the worker handles auth.
 *
 * Used as automatic fallback when `--ai` is passed without any configured key.
 */

import type { ModuleInfo, Symbol } from "../types.js";
import type { AIProvider, GenerateOptions } from "./base.js";
import { buildModuleSummaryPrompt, buildSymbolSummaryPrompt } from "./base.js";

const DEFAULT_BASE_URL = "https://docwalk-ai-proxy.jonathanrannabargar.workers.dev";

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
    const res = await fetch(`${this.baseURL}/v1/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        systemPrompt: options?.systemPrompt,
        maxTokens: options?.maxTokens ?? 256,
        temperature: options?.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`DocWalk AI error (${res.status}): ${body}`);
    }

    const data = (await res.json()) as { text: string };
    return data.text.trim();
  }
}
