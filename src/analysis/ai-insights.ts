/**
 * AI-Enhanced Insights
 *
 * Enriches static analysis insights with AI-generated actionable suggestions.
 * Each insight gets a focused, code-aware fix recommendation from the LLM.
 */

import type { Insight } from "./types.js";
import type { AIProvider } from "./providers/base.js";

export interface EnhanceInsightsOptions {
  insights: Insight[];
  aiProvider: AIProvider;
  readFile: (filePath: string) => Promise<string>;
  maxInsights?: number;
  onProgress?: (current: number, total: number, message: string) => void;
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

/**
 * Enhance the top N insights with AI-generated suggestions.
 * Non-fatal: errors per-insight are caught and logged, processing continues.
 */
export async function enhanceInsightsWithAI(
  options: EnhanceInsightsOptions
): Promise<Insight[]> {
  const { insights, aiProvider, readFile, maxInsights = 20, onProgress } = options;

  // Sort by severity (critical first), take top N
  const sorted = [...insights].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2)
  );
  const toEnhance = sorted.slice(0, maxInsights);
  const skipped = sorted.slice(maxInsights);

  for (let i = 0; i < toEnhance.length; i++) {
    const insight = toEnhance[i];
    onProgress?.(i + 1, toEnhance.length, `AI analyzing: ${insight.title}`);

    try {
      // Read first affected file for context (truncated)
      let fileContext = "";
      if (insight.affectedFiles.length > 0) {
        try {
          const content = await readFile(insight.affectedFiles[0]);
          const lines = content.split("\n");
          fileContext = lines.slice(0, 100).join("\n");
        } catch {
          // File read failure is non-fatal
        }
      }

      const prompt = buildInsightPrompt(insight, fileContext);
      const suggestion = await aiProvider.generate(prompt, {
        maxTokens: 300,
        temperature: 0.3,
      });

      if (suggestion) {
        insight.aiSuggestion = suggestion.trim();
      }
    } catch {
      // Per-insight failure is non-fatal — continue to next
    }
  }

  return [...toEnhance, ...skipped];
}

function buildInsightPrompt(insight: Insight, fileContext: string): string {
  return `You are a senior software engineer reviewing code quality insights. Provide a specific, actionable fix for this issue. Be concise (2-4 sentences). Include a brief code example if helpful.

Category: ${insight.category}
Severity: ${insight.severity}
Issue: ${insight.title}
Description: ${insight.description}
Affected files: ${insight.affectedFiles.join(", ")}
Static suggestion: ${insight.suggestion}
${fileContext ? `\nFile context (first 100 lines of ${insight.affectedFiles[0]}):\n\`\`\`\n${fileContext}\n\`\`\`` : ""}

Provide your specific fix recommendation:`;
}
