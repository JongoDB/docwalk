import {
  detectLogicalSection
} from "./chunk-GEYCHOKI.js";

// src/analysis/structure-advisor.ts
async function analyzeStructure(manifest, provider) {
  if (!provider) {
    return { conceptPages: [], audienceSplit: false, navGroups: [] };
  }
  const modulesBySection = {};
  for (const mod of manifest.modules) {
    const section = detectLogicalSection(mod.filePath);
    if (!modulesBySection[section]) modulesBySection[section] = [];
    modulesBySection[section].push(mod.filePath);
  }
  const sectionSummary = Object.entries(modulesBySection).map(([section, files]) => `${section}: ${files.length} files (${files.slice(0, 3).join(", ")}${files.length > 3 ? `, +${files.length - 3} more` : ""})`).join("\n");
  const { dependencyGraph } = manifest;
  const clusters = /* @__PURE__ */ new Map();
  for (const node of dependencyGraph.nodes) {
    const parts = node.split("/");
    const dir = parts.length > 2 ? parts.slice(0, 2).join("/") : parts[0];
    clusters.set(dir, (clusters.get(dir) || 0) + 1);
  }
  const clusterSummary = [...clusters.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([dir, count]) => `${dir}: ${count} files`).join("\n");
  const prompt = `Analyze this codebase and suggest additional conceptual documentation pages beyond the standard set (Overview, Getting Started, Architecture, API Reference).

PROJECT: ${manifest.projectMeta.name}
LANGUAGES: ${manifest.projectMeta.languages.map((l) => `${l.name} (${l.percentage}%)`).join(", ")}
TOTAL FILES: ${manifest.stats.totalFiles}
TOTAL SYMBOLS: ${manifest.stats.totalSymbols}

LOGICAL SECTIONS:
${sectionSummary}

DEPENDENCY CLUSTERS:
${clusterSummary}

Return a JSON array of page suggestions. Each item should have:
- "id": lowercase-kebab-case identifier
- "title": human-readable page title
- "description": what this page should cover (1 sentence)
- "navGroup": which navigation group this belongs to
- "relatedModules": array of file paths this page relates to (max 10)

Suggest 2-6 conceptual pages based on patterns you see (e.g., "Authentication Flow", "Data Pipeline", "Event System", "Plugin Architecture"). Only suggest pages where there's enough code to warrant a dedicated page.

Return ONLY valid JSON, no explanation.`;
  try {
    const response = await provider.generate(prompt, {
      maxTokens: 1024,
      temperature: 0.2,
      systemPrompt: "You are a documentation architect. Return only valid JSON."
    });
    const cleaned = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const suggestions = JSON.parse(cleaned);
    const conceptPages = suggestions.map((s, i) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      navGroup: s.navGroup || "Concepts",
      navOrder: 20 + i,
      relatedModules: s.relatedModules || []
    }));
    return {
      conceptPages,
      audienceSplit: manifest.modules.some(
        (m) => m.filePath.includes("cli/") || m.filePath.includes("commands/")
      ),
      navGroups: [...new Set(conceptPages.map((p) => p.navGroup))]
    };
  } catch {
    return { conceptPages: [], audienceSplit: false, navGroups: [] };
  }
}
export {
  analyzeStructure
};
