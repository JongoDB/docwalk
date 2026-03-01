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
    .map((s) => {
      const params = s.parameters?.map((p) => `${p.name}: ${p.type || "any"}`).join(", ") || "";
      const ret = s.returns?.type ? ` → ${s.returns.type}` : "";
      const doc = s.docs?.summary ? ` — ${s.docs.summary}` : "";
      return `- ${s.kind} ${s.name}(${params})${ret}${doc}`;
    })
    .join("\n");

  // Include more context — up to 150 lines instead of 80
  const lines = fileContent.split("\n");
  const truncatedContent = lines.slice(0, 150).join("\n");

  return `Summarize this source file in 2-3 sentences for a documentation site. State what the module does, its main exports, and how it fits into a larger system.

File: ${module.filePath}
Language: ${module.language}
Lines: ${module.lineCount}
Exported symbols:
${symbolList || "(none)"}

Source code:
\`\`\`
${truncatedContent}
\`\`\`

Write only the summary — no preamble, no bullet points, just 2-3 clear sentences.`;
}

/** Build the prompt for symbol summarization. */
export function buildSymbolSummaryPrompt(symbol: Symbol, fileContent: string, filePath: string): string {
  const lines = fileContent.split("\n");
  const startLine = Math.max(0, symbol.location.line - 3); // Include a few lines of context before
  const endLine = symbol.location.endLine
    ? Math.min(symbol.location.endLine + 2, lines.length) // Include a few lines after
    : Math.min(startLine + 40, lines.length);
  const snippet = lines.slice(startLine, endLine).join("\n");

  const paramInfo = symbol.parameters
    ? `Parameters: ${symbol.parameters.map((p) => `${p.name}${p.type ? `: ${p.type}` : ""}${p.optional ? " (optional)" : ""}`).join(", ")}`
    : "";

  return `Write a 1-2 sentence summary for this ${symbol.kind}. State what it does and when a developer would use it.

File: ${filePath}:${symbol.location.line}
Symbol: ${symbol.name} (${symbol.kind})
${paramInfo}
${symbol.returns?.type ? `Returns: ${symbol.returns.type}` : ""}
${symbol.docs?.summary ? `Existing doc: ${symbol.docs.summary}` : ""}

Code:
\`\`\`
${snippet}
\`\`\`

Write only the summary — no preamble, no code blocks.`;
}

/** Result from a batched module+symbols summarization call. */
export interface BatchSummaryResult {
  moduleSummary: string;
  symbolSummaries: Record<string, string>;
}

/**
 * Static system prompt for batch summarization.
 * Extracted so providers that cache system prompts (e.g. Groq) can
 * avoid counting these tokens against per-minute limits.
 */
export function buildBatchSystemPrompt(): string {
  return `You summarize source code files for a documentation site. Respond ONLY with valid JSON — no markdown fences, no explanation. For the module summary, state what it does and its role in 2-3 sentences. For each symbol, state what it does in 1 sentence.`;
}

/**
 * Build a single prompt that requests both a module summary and summaries
 * for all its exported symbols. Returns structured output we can parse.
 *
 * Optimized for low-TPM providers: 80 lines of source, no per-symbol
 * code snippets (the source already contains them). Symbol metadata
 * (name, kind, params) is cheap at ~5 tokens each.
 */
export function buildBatchSummaryPrompt(
  module: ModuleInfo,
  fileContent: string,
  symbols: Symbol[]
): string {
  const truncated = fileContent.split("\n").slice(0, 80).join("\n");

  const symbolList = symbols
    .map((s) => {
      const params = s.parameters?.map((p) => p.name).join(", ") || "";
      const ret = s.returns?.type ? ` → ${s.returns.type}` : "";
      return `- ${s.kind} ${s.name}(${params})${ret}`;
    })
    .join("\n");

  return `File: ${module.filePath} (${module.language}, ${module.lineCount} lines)

Source:
\`\`\`
${truncated}
\`\`\`
${symbols.length > 0 ? `\nExported symbols:\n${symbolList}\n` : ""}
Respond with this exact JSON structure:
{"module":"2-3 sentence file summary"${symbols.map((s) => `,"${s.name}":"1 sentence summary"`).join("")}}`;
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

// ─── Multi-file batching (packs N files into one request) ────────────────

/** Input for a single file in a multi-file batch. */
export interface MultiFileBatchEntry {
  module: ModuleInfo;
  content: string;
}

/** Result from a multi-file batch call: file path → summary. */
export type MultiFileBatchResult = Record<string, string>;

/**
 * Build a prompt that summarizes multiple files in a single API call.
 * Reduces request count by N× at the cost of larger prompts.
 * Each file gets 50 lines of source (down from 80 for single-file).
 */
export function buildMultiFileBatchPrompt(entries: MultiFileBatchEntry[]): string {
  const fileSections = entries.map((e) => {
    const truncated = e.content.split("\n").slice(0, 50).join("\n");
    return `## ${e.module.filePath} (${e.module.language}, ${e.module.lineCount} lines)
\`\`\`
${truncated}
\`\`\``;
  }).join("\n\n");

  const keys = entries.map((e) => `"${e.module.filePath}":"2-3 sentence summary"`).join(",");

  return `${fileSections}

Respond with this exact JSON structure:
{${keys}}`;
}

/**
 * Parse multi-file batch response into a map of file path → summary.
 */
export function parseMultiFileBatchResponse(
  response: string,
  filePaths: string[]
): MultiFileBatchResult {
  let cleaned = response.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?\s*```\s*$/i, "");

  try {
    const parsed = JSON.parse(cleaned);
    const result: MultiFileBatchResult = {};
    for (const fp of filePaths) {
      if (parsed[fp]) {
        result[fp] = parsed[fp];
      }
    }
    return result;
  } catch {
    return {};
  }
}
