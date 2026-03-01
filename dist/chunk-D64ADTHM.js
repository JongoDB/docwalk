import {
  LOGICAL_SECTIONS,
  estimateTokens
} from "./chunk-GEYCHOKI.js";

// src/analysis/context-builder.ts
import path from "path";
function detectSection(filePath) {
  const parts = filePath.toLowerCase().split("/");
  for (const [section, keywords] of Object.entries(LOGICAL_SECTIONS)) {
    for (const part of parts) {
      if (keywords.includes(part)) return section;
    }
  }
  return "";
}
async function buildContext(options) {
  const { targetModule, topic, tokenBudget, manifest, readFile } = options;
  const { dependencyGraph, modules } = manifest;
  const scored = [];
  if (targetModule) {
    const targetPath = targetModule.filePath;
    const targetDir = path.dirname(targetPath);
    const targetSection = detectSection(targetPath);
    const directDeps = /* @__PURE__ */ new Set();
    const directDependents = /* @__PURE__ */ new Set();
    for (const edge of dependencyGraph.edges) {
      if (edge.from === targetPath) directDeps.add(edge.to);
      if (edge.to === targetPath) directDependents.add(edge.from);
    }
    const transitiveSet = /* @__PURE__ */ new Set();
    for (const dep of directDeps) {
      for (const edge of dependencyGraph.edges) {
        if (edge.from === dep && edge.to !== targetPath) {
          transitiveSet.add(edge.to);
        }
      }
    }
    for (const dep of directDependents) {
      for (const edge of dependencyGraph.edges) {
        if (edge.to === dep && edge.from !== targetPath) {
          transitiveSet.add(edge.from);
        }
      }
    }
    for (const mod of modules) {
      if (mod.filePath === targetPath) continue;
      let score = 0;
      if (directDeps.has(mod.filePath) || directDependents.has(mod.filePath)) {
        score = 1;
      } else if (transitiveSet.has(mod.filePath)) {
        score = 0.6;
      } else if (path.dirname(mod.filePath) === targetDir) {
        score = 0.4;
      } else if (targetSection && detectSection(mod.filePath) === targetSection) {
        score = 0.3;
      } else if (mod.filePath.toLowerCase().includes("readme") || mod.filePath.toLowerCase().includes("doc")) {
        score = 0.2;
      }
      if (score > 0) {
        scored.push({ module: mod, score });
      }
    }
  } else if (topic) {
    const topicLower = topic.toLowerCase();
    const topicWords = topicLower.split(/\s+/);
    for (const mod of modules) {
      let score = 0;
      const pathLower = mod.filePath.toLowerCase();
      for (const word of topicWords) {
        if (pathLower.includes(word)) {
          score = Math.max(score, 0.8);
        }
      }
      for (const sym of mod.symbols) {
        const nameLower = sym.name.toLowerCase();
        for (const word of topicWords) {
          if (nameLower.includes(word)) {
            score = Math.max(score, 0.7);
          }
        }
      }
      if (pathLower.includes("readme")) {
        score = Math.max(score, 0.5);
      }
      if (score > 0) {
        scored.push({ module: mod, score });
      }
    }
  } else {
    const connectionCounts = /* @__PURE__ */ new Map();
    for (const edge of dependencyGraph.edges) {
      connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
      connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
    }
    for (const mod of modules) {
      const connections = connectionCounts.get(mod.filePath) ?? 0;
      const score = Math.min(connections / 10, 1);
      if (score > 0) {
        scored.push({ module: mod, score });
      }
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const chunks = [];
  let usedTokens = 0;
  if (targetModule) {
    try {
      const content = await readFile(targetModule.filePath);
      const tokens = estimateTokens(content);
      if (tokens <= tokenBudget * 0.4) {
        chunks.push({
          filePath: targetModule.filePath,
          startLine: 1,
          endLine: content.split("\n").length,
          content,
          relevanceScore: 1,
          kind: "full-file"
        });
        usedTokens += tokens;
      } else {
        const lines = content.split("\n");
        const maxLines = Math.floor(tokenBudget * 0.4 / (estimateTokens(content) / lines.length));
        const truncated = lines.slice(0, maxLines).join("\n");
        chunks.push({
          filePath: targetModule.filePath,
          startLine: 1,
          endLine: maxLines,
          content: truncated,
          relevanceScore: 1,
          kind: "full-file"
        });
        usedTokens += estimateTokens(truncated);
      }
    } catch {
    }
  }
  for (const { module: mod, score } of scored) {
    if (usedTokens >= tokenBudget) break;
    try {
      const content = await readFile(mod.filePath);
      const tokens = estimateTokens(content);
      const remaining = tokenBudget - usedTokens;
      if (tokens <= remaining) {
        chunks.push({
          filePath: mod.filePath,
          startLine: 1,
          endLine: content.split("\n").length,
          content,
          relevanceScore: score,
          kind: "full-file"
        });
        usedTokens += tokens;
      } else if (remaining > 100) {
        const lines = content.split("\n");
        const maxLines = Math.floor(remaining / (tokens / lines.length));
        if (maxLines > 5) {
          const truncated = lines.slice(0, maxLines).join("\n");
          chunks.push({
            filePath: mod.filePath,
            startLine: 1,
            endLine: maxLines,
            content: truncated,
            relevanceScore: score,
            kind: "full-file"
          });
          usedTokens += estimateTokens(truncated);
        }
      }
    } catch {
    }
  }
  return chunks;
}

// src/generators/diagrams.ts
var MERMAID_BLOCK_REGEX = /```(?:mermaid)?\n?([\s\S]*?)```/;
function extractAllMermaidBlocks(text) {
  const blocks = [];
  const globalRegex = new RegExp(MERMAID_BLOCK_REGEX.source, "g");
  let match;
  while ((match = globalRegex.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

// src/generators/narrative-engine.ts
async function generateOverviewNarrative(options) {
  const { provider, manifest, readFile, contextBudget = 8e3 } = options;
  const contextChunks = await buildContext({
    tokenBudget: contextBudget,
    manifest,
    readFile
  });
  const contextText = formatContextChunks(contextChunks);
  const moduleList = manifest.modules.map((m) => `- ${m.filePath} (${m.language}, ${m.symbols.length} symbols)`).slice(0, 30).join("\n");
  const prompt = `You are writing the overview page for a technical documentation site. Based on the following codebase analysis, write a comprehensive but concise overview of this project.

PROJECT: ${manifest.projectMeta.name}
LANGUAGES: ${manifest.projectMeta.languages.map((l) => `${l.name} (${l.percentage}%)`).join(", ")}
TOTAL FILES: ${manifest.stats.totalFiles}
TOTAL SYMBOLS: ${manifest.stats.totalSymbols}

KEY MODULES:
${moduleList}

SOURCE CODE CONTEXT:
${contextText}

INSTRUCTIONS:
1. Write 3-5 paragraphs explaining what this project does, its architecture, and key design decisions
2. Use [file:line] notation for source citations (e.g., [src/engine.ts:42])
3. Mention the most important modules and how they interact
4. Write for developers who are new to the codebase
5. Be specific \u2014 reference actual function/class names from the code
6. Do NOT use marketing language. Be technical and precise.

Write the overview in Markdown format.`;
  const prose = await provider.generate(prompt, {
    maxTokens: 2048,
    temperature: 0.3,
    systemPrompt: "You are a technical documentation writer. Write clear, precise, developer-focused documentation."
  });
  const citations = extractCitations(prose);
  const suggestedDiagrams = extractDiagramSuggestions(prose);
  return { prose, citations, suggestedDiagrams };
}
async function generateGettingStartedNarrative(options) {
  const { provider, manifest, readFile, contextBudget = 6e3 } = options;
  const entryModules = manifest.modules.filter(
    (m) => m.filePath.includes("index.") || m.filePath.includes("main.") || m.filePath.includes("app.")
  );
  const contextChunks = [];
  let usedTokens = 0;
  for (const mod of entryModules.slice(0, 5)) {
    try {
      const content = await readFile(mod.filePath);
      const tokens = estimateTokens(content);
      if (usedTokens + tokens <= contextBudget) {
        contextChunks.push({
          filePath: mod.filePath,
          startLine: 1,
          endLine: content.split("\n").length,
          content,
          relevanceScore: 1,
          kind: "full-file"
        });
        usedTokens += tokens;
      }
    } catch {
    }
  }
  const contextText = formatContextChunks(contextChunks);
  const prompt = `You are writing a Getting Started guide for a technical documentation site.

PROJECT: ${manifest.projectMeta.name}
LANGUAGES: ${manifest.projectMeta.languages.map((l) => l.name).join(", ")}
PACKAGE MANAGER: ${manifest.projectMeta.packageManager || "unknown"}
ENTRY POINTS: ${manifest.projectMeta.entryPoints.join(", ")}

SOURCE CODE CONTEXT:
${contextText}

INSTRUCTIONS:
1. Write a practical getting-started guide that helps developers set up and start using this project
2. Include prerequisites, installation steps, and a first-use walkthrough
3. Reference specific files and commands from the codebase
4. Use [file:line] notation for source citations
5. Keep it actionable \u2014 every section should help the reader DO something
6. Write in Markdown format with proper headings

Write the getting-started guide.`;
  const prose = await provider.generate(prompt, {
    maxTokens: 2048,
    temperature: 0.3,
    systemPrompt: "You are a technical documentation writer. Write clear, practical, step-by-step guides."
  });
  const citations = extractCitations(prose);
  return { prose, citations, suggestedDiagrams: [] };
}
async function generateModuleNarrative(module, options) {
  const { provider, manifest, readFile, contextBudget = 6e3 } = options;
  const contextChunks = await buildContext({
    targetModule: module,
    tokenBudget: contextBudget,
    manifest,
    readFile
  });
  const contextText = formatContextChunks(contextChunks);
  const symbolList = module.symbols.filter((s) => s.exported).map((s) => `- ${s.kind} ${s.name}${s.signature ? `: ${s.signature}` : ""}`).join("\n");
  const prompt = `You are writing documentation for a specific module in a codebase.

FILE: ${module.filePath}
LANGUAGE: ${module.language}
EXPORTED SYMBOLS:
${symbolList || "(none)"}

RELATED SOURCE CODE:
${contextText}

INSTRUCTIONS:
1. Write 2-4 paragraphs explaining what this module does and how it fits into the project
2. Describe the key exported symbols and their purposes
3. Explain how other modules use this one (based on the dependency context)
4. Use [file:line] notation for source citations
5. If there are complex algorithms or patterns, explain them clearly
6. Write for developers who need to understand or modify this code

Write the module description in Markdown format. Do NOT include headings \u2014 this will be inserted into an existing page structure.`;
  const prose = await provider.generate(prompt, {
    maxTokens: 1024,
    temperature: 0.3,
    systemPrompt: "You are a technical documentation writer. Be precise and reference specific code."
  });
  const citations = extractCitations(prose);
  const suggestedDiagrams = extractDiagramSuggestions(prose);
  return { prose, citations, suggestedDiagrams };
}
async function generateArchitectureNarrative(options) {
  const { provider, manifest, readFile, contextBudget = 8e3 } = options;
  const contextChunks = await buildContext({
    topic: "architecture core engine",
    tokenBudget: contextBudget,
    manifest,
    readFile
  });
  const contextText = formatContextChunks(contextChunks);
  const { dependencyGraph } = manifest;
  const connectionCounts = /* @__PURE__ */ new Map();
  for (const edge of dependencyGraph.edges) {
    connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
    connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
  }
  const topModules = [...connectionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([file, count]) => `- ${file} (${count} connections)`).join("\n");
  const prompt = `You are writing the architecture documentation for a software project.

PROJECT: ${manifest.projectMeta.name}
MODULES: ${dependencyGraph.nodes.length}
DEPENDENCY EDGES: ${dependencyGraph.edges.length}

MOST CONNECTED MODULES:
${topModules}

SOURCE CODE CONTEXT:
${contextText}

INSTRUCTIONS:
1. Write 4-6 paragraphs describing the system architecture
2. Explain the major components/layers and how they interact
3. Describe the data flow and key architectural patterns used
4. Mention design decisions and trade-offs where apparent from the code
5. Use [file:line] notation for source citations
6. Suggest what types of diagrams would be helpful (sequence, class, flowchart)

Write the architecture overview in Markdown format.`;
  const prose = await provider.generate(prompt, {
    maxTokens: 2048,
    temperature: 0.3,
    systemPrompt: "You are a software architect documenting a system. Be thorough and precise."
  });
  const citations = extractCitations(prose);
  const suggestedDiagrams = extractDiagramSuggestions(prose);
  return { prose, citations, suggestedDiagrams };
}
function formatContextChunks(chunks) {
  return chunks.map((c) => {
    const header = `--- ${c.filePath} (lines ${c.startLine}-${c.endLine}, relevance: ${c.relevanceScore.toFixed(1)}) ---`;
    return `${header}
${c.content}`;
  }).join("\n\n");
}
function extractCitations(prose) {
  const citations = [];
  const regex = /\[([^\]]+?):(\d+)\]/g;
  let match;
  while ((match = regex.exec(prose)) !== null) {
    citations.push({
      text: match[0],
      filePath: match[1],
      line: parseInt(match[2], 10)
    });
  }
  return citations;
}
function extractDiagramSuggestions(prose) {
  const blocks = extractAllMermaidBlocks(prose);
  return blocks.map((code) => {
    let type = "flowchart";
    if (code.startsWith("sequenceDiagram")) type = "sequence";
    else if (code.startsWith("classDiagram")) type = "class";
    else if (code.startsWith("graph") || code.startsWith("flowchart")) type = "flowchart";
    return {
      type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Diagram`,
      mermaidCode: code
    };
  });
}
function renderCitations(prose, citations, repoUrl, branch) {
  let result = prose;
  const seen = /* @__PURE__ */ new Set();
  for (const citation of citations) {
    if (seen.has(citation.text)) continue;
    seen.add(citation.text);
    const linkTarget = repoUrl ? `https://github.com/${repoUrl}/blob/${branch || "main"}/${citation.filePath}#L${citation.line}` : `api/${citation.filePath.replace(/\.[^.]+$/, "")}.md`;
    result = result.replaceAll(
      citation.text,
      `[${citation.filePath}:${citation.line}](${linkTarget})`
    );
  }
  return result;
}

export {
  buildContext,
  generateOverviewNarrative,
  generateGettingStartedNarrative,
  generateModuleNarrative,
  generateArchitectureNarrative,
  renderCitations
};
