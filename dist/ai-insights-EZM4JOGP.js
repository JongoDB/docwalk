// src/analysis/ai-insights.ts
var SEVERITY_ORDER = {
  critical: 0,
  warning: 1,
  info: 2
};
async function enhanceInsightsWithAI(options) {
  const { insights, aiProvider, readFile, maxInsights = 20, onProgress } = options;
  const sorted = [...insights].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2)
  );
  const toEnhance = sorted.slice(0, maxInsights);
  const skipped = sorted.slice(maxInsights);
  for (let i = 0; i < toEnhance.length; i++) {
    const insight = toEnhance[i];
    onProgress?.(i + 1, toEnhance.length, `AI analyzing: ${insight.title}`);
    try {
      let fileContext = "";
      if (insight.affectedFiles.length > 0) {
        try {
          const content = await readFile(insight.affectedFiles[0]);
          const lines = content.split("\n");
          fileContext = lines.slice(0, 100).join("\n");
        } catch {
        }
      }
      const prompt = buildInsightPrompt(insight, fileContext);
      const suggestion = await aiProvider.generate(prompt, {
        maxTokens: 300,
        temperature: 0.3
      });
      if (suggestion) {
        insight.aiSuggestion = suggestion.trim();
      }
    } catch {
    }
  }
  return [...toEnhance, ...skipped];
}
function buildInsightPrompt(insight, fileContext) {
  return `You are a senior software engineer reviewing code quality insights. Provide a specific, actionable fix for this issue. Be concise (2-4 sentences). Include a brief code example if helpful.

Category: ${insight.category}
Severity: ${insight.severity}
Issue: ${insight.title}
Description: ${insight.description}
Affected files: ${insight.affectedFiles.join(", ")}
Static suggestion: ${insight.suggestion}
${fileContext ? `
File context (first 100 lines of ${insight.affectedFiles[0]}):
\`\`\`
${fileContext}
\`\`\`` : ""}

Provide your specific fix recommendation:`;
}
export {
  enhanceInsightsWithAI
};
