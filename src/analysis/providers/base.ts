/**
 * Base AI Provider Interface
 *
 * Extends the existing AISummaryProvider with a general-purpose
 * `generate()` method for arbitrary LLM prompts (narratives, diagrams, etc.).
 */

import type { ModuleInfo, Symbol } from "../types.js";

/** Provider-agnostic interface for LLM summarization. */
export interface AISummaryProvider {
  /** Provider name for logging. */
  readonly name: string;

  /** Generate a summary for a module (file-level overview). */
  summarizeModule(module: ModuleInfo, fileContent: string): Promise<string>;

  /** Generate a summary for a specific symbol (function, class, etc.). */
  summarizeSymbol(symbol: Symbol, fileContent: string, filePath: string): Promise<string>;
}

/** Options for the general-purpose generate method. */
export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * Extended AI provider interface with general-purpose generation.
 * Used for narrative docs, diagram generation, structure advice, etc.
 */
export interface AIProvider extends AISummaryProvider {
  /** Generate arbitrary text from a prompt. */
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
}

// ─── Shared prompt builders (used by all provider implementations) ────────

/** Build the prompt for module summarization. */
export function buildModuleSummaryPrompt(module: ModuleInfo, fileContent: string): string {
  const symbolList = module.symbols
    .filter((s) => s.exported)
    .map((s) => `- ${s.kind} ${s.name}${s.docs?.summary ? `: ${s.docs.summary}` : ""}`)
    .join("\n");

  return `You are a technical documentation assistant. Summarize this source file in 2-3 sentences for a documentation site. Focus on what the module does and its role in the project. Be concise and precise.

File: ${module.filePath}
Language: ${module.language}
Exported symbols:
${symbolList || "(none)"}

File content (truncated):
\`\`\`
${fileContent.split("\n").slice(0, 80).join("\n")}
\`\`\`

Write only the summary, no preamble.`;
}

/** Build the prompt for symbol summarization. */
export function buildSymbolSummaryPrompt(symbol: Symbol, fileContent: string, filePath: string): string {
  const lines = fileContent.split("\n");
  const startLine = symbol.location.line - 1;
  const endLine = symbol.location.endLine
    ? symbol.location.endLine
    : Math.min(startLine + 30, lines.length);
  const snippet = lines.slice(startLine, endLine).join("\n");

  return `You are a technical documentation assistant. Write a brief 1-2 sentence summary for this ${symbol.kind}. Focus on what it does and when to use it.

File: ${filePath}
Symbol: ${symbol.name} (${symbol.kind})
${symbol.parameters ? `Parameters: ${symbol.parameters.map((p) => p.name).join(", ")}` : ""}
${symbol.returns?.type ? `Returns: ${symbol.returns.type}` : ""}

Code:
\`\`\`
${snippet}
\`\`\`

Write only the summary, no preamble.`;
}

/** Result from a batched module+symbols summarization call. */
export interface BatchSummaryResult {
  moduleSummary: string;
  symbolSummaries: Record<string, string>;
}

/**
 * Build a single prompt that requests both a module summary and summaries
 * for all its exported symbols. Returns structured output we can parse.
 */
export function buildBatchSummaryPrompt(
  module: ModuleInfo,
  fileContent: string,
  symbols: Symbol[]
): string {
  const truncated = fileContent.split("\n").slice(0, 200).join("\n");

  const symbolSection = symbols
    .map((s) => {
      const lines = fileContent.split("\n");
      const startLine = s.location.line - 1;
      const endLine = s.location.endLine
        ? s.location.endLine
        : Math.min(startLine + 20, lines.length);
      const snippet = lines.slice(startLine, endLine).join("\n");
      return `### ${s.name} (${s.kind})
${s.parameters ? `Parameters: ${s.parameters.map((p) => p.name).join(", ")}` : ""}
${s.returns?.type ? `Returns: ${s.returns.type}` : ""}
\`\`\`
${snippet}
\`\`\``;
    })
    .join("\n\n");

  return `You are a technical documentation assistant. Respond ONLY with valid JSON, no markdown fences.

Summarize this source file and its exported symbols.

File: ${module.filePath} (${module.language})

Source (first 200 lines):
\`\`\`
${truncated}
\`\`\`

${symbols.length > 0 ? `Exported symbols to summarize:\n\n${symbolSection}` : ""}

Respond with this exact JSON structure:
{"module":"2-3 sentence file summary"${symbols.map((s) => `,"${s.name}":"1-2 sentence summary"`).join("")}}`;
}

/**
 * Parse the batched summary response. Tolerant of minor formatting issues.
 */
export function parseBatchSummaryResponse(
  response: string,
  symbolNames: string[]
): BatchSummaryResult {
  // Strip markdown code fences if present
  let cleaned = response.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?\s*```\s*$/i, "");

  try {
    const parsed = JSON.parse(cleaned);
    const moduleSummary = parsed.module || "";
    const symbolSummaries: Record<string, string> = {};
    for (const name of symbolNames) {
      if (parsed[name]) {
        symbolSummaries[name] = parsed[name];
      }
    }
    return { moduleSummary, symbolSummaries };
  } catch {
    // Fallback: use the whole response as the module summary
    return { moduleSummary: cleaned, symbolSummaries: {} };
  }
}
