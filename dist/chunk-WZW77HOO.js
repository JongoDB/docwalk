import {
  LOGICAL_SECTIONS,
  estimateTokens
} from "./chunk-D4RNNKFF.js";

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
  const prompt = `You are an expert technical writer creating the overview page for a documentation site.

PROJECT: ${manifest.projectMeta.name}
LANGUAGES: ${manifest.projectMeta.languages.map((l) => `${l.name} (${l.percentage}%)`).join(", ")}
TOTAL FILES: ${manifest.stats.totalFiles}
TOTAL SYMBOLS: ${manifest.stats.totalSymbols}

KEY MODULES:
${moduleList}

SOURCE CODE CONTEXT:
${contextText}

Write a comprehensive technical overview following this structure:

1. **Introduction** (1-2 paragraphs): What the project does, who it's for, and the core problem it solves. Reference the main entry point and key modules.

2. **Architecture Overview**: Describe the major layers/components and how they interact. Include a Mermaid diagram showing the high-level architecture:
\`\`\`mermaid
flowchart TD
    A[Component] --> B[Component]
\`\`\`
Use \`flowchart TD\` (top-down), keep nodes to 3-4 words max, maximum 12 nodes.

3. **Core Components**: For each major component/layer, explain its purpose and key design decisions. Use tables to summarize modules:
| Module | Purpose |
|--------|---------|

4. **Data Flow**: How data moves through the system \u2014 from input to processing to output. Reference specific functions and types.

5. **Key Design Decisions**: Trade-offs made, patterns used (e.g., provider pattern, plugin architecture), and why.

RULES:
- Cite sources with [file:line] notation (e.g., [src/engine.ts:42]) for every significant claim
- Reference actual function, class, and type names from the code \u2014 never invent names
- Use Markdown: ## headings, tables, code blocks, bold for emphasis
- Do NOT use marketing language. Be technical and precise.
- Do NOT include a title heading (# Overview) \u2014 it will be added by the template`;
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
  const prompt = `You are writing a Getting Started guide for developers.

PROJECT: ${manifest.projectMeta.name}
LANGUAGES: ${manifest.projectMeta.languages.map((l) => l.name).join(", ")}
PACKAGE MANAGER: ${manifest.projectMeta.packageManager || "unknown"}
ENTRY POINTS: ${manifest.projectMeta.entryPoints.join(", ")}

SOURCE CODE CONTEXT:
${contextText}

Write a practical getting-started guide following this structure:

## Prerequisites
List what developers need installed (runtime, tools, etc.) based on the project's language and build system.

## Installation
Step-by-step setup with exact commands. Reference the package manager and any build steps visible in the code.

## Quick Start
A concrete walkthrough showing the most basic usage. Include actual code snippets or commands, not abstract descriptions. Reference the main entry point.

## Project Structure
Brief orientation: what the main directories contain and where to look first.

## Next Steps
Point to specific modules or features to explore after the basics.

RULES:
- Every section must help the reader DO something concrete
- Use code blocks with the correct language tag for all commands and code
- Cite sources with [file:line] notation
- Reference actual file paths, function names, and config options from the code
- Keep it concise \u2014 developers want to get started, not read an essay`;
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
  const depCount = manifest.dependencyGraph.edges.filter((e) => e.to === module.filePath).length;
  const usedBy = manifest.dependencyGraph.edges.filter((e) => e.to === module.filePath).map((e) => e.from).slice(0, 5);
  const prompt = `You are an expert technical writer documenting a specific module.

FILE: ${module.filePath}
LANGUAGE: ${module.language}
IMPORTED BY: ${depCount} modules${usedBy.length > 0 ? ` (${usedBy.join(", ")})` : ""}

EXPORTED SYMBOLS:
${symbolList || "(none)"}

RELATED SOURCE CODE:
${contextText}

Write a clear, developer-focused module description following this structure:

1. **Purpose** (1-2 sentences): What this module does and why it exists.

2. **How it works**: Explain the key logic, algorithms, or patterns. If there are multiple exported symbols, describe how they relate to each other. Reference specific function/class names.

3. **Usage context**: How other modules use this one. What calls into it and why.

4. **Key implementation details**: Important trade-offs, error handling strategies, or performance considerations that a developer modifying this code should know.

RULES:
- Cite sources with [file:line] notation (e.g., [${module.filePath}:42])
- Be specific \u2014 use actual function/class/type names from the code
- Do NOT include Markdown headings (## or #) \u2014 this is inserted into an existing page
- Keep it concise: 2-4 focused paragraphs, not a wall of text
- Write for developers who need to understand or modify this code`;
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
  const prompt = `You are an expert software architect writing architecture documentation.

PROJECT: ${manifest.projectMeta.name}
MODULES: ${dependencyGraph.nodes.length}
DEPENDENCY EDGES: ${dependencyGraph.edges.length}

MOST CONNECTED MODULES:
${topModules}

SOURCE CODE CONTEXT:
${contextText}

Write detailed architecture documentation following this structure:

1. **System Overview** (1-2 paragraphs): High-level description of the system's purpose and architectural style (layered, microservice, pipeline, etc.).

2. **Component Architecture**: Include a Mermaid diagram showing the major components and their relationships:
\`\`\`mermaid
flowchart TD
    subgraph Layer["Layer Name"]
        A[Component] --> B[Component]
    end
\`\`\`
Use \`flowchart TD\` (top-down), group related components in subgraphs, max 15 nodes. Keep node labels to 3-4 words.

3. **Component Deep Dive**: For each major component, describe:
   - Its responsibility and public interface
   - Key classes/functions it exposes
   - How it communicates with other components

4. **Data Flow**: How a typical request/operation flows through the system. Include a sequence diagram:
\`\`\`mermaid
sequenceDiagram
    participant A as Component
    A->>B: method()
    B-->>A: result
\`\`\`
Use solid arrows (->>)  for calls, dashed arrows (-->>)  for returns. Max 6 participants, 15 messages.

5. **Key Patterns**: Architectural patterns used (dependency injection, plugin registry, event bus, etc.) and why they were chosen.

6. **Module Coupling**: Table of the most connected modules and what they depend on:
| Module | Connections | Role |
|--------|:-----------:|------|

RULES:
- Cite sources with [file:line] notation for every claim
- Reference actual code: class names, function names, file paths
- All Mermaid diagrams must use top-down orientation (\`flowchart TD\`, never LR)
- Do NOT include a title heading \u2014 it will be added by the template`;
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
