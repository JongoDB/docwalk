import {
  LOGICAL_SECTIONS,
  estimateTokens
} from "./chunk-VTREF62W.js";

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
function bestChunkBySymbolDensity(content, symbolNames, maxTokens) {
  const lines = content.split("\n");
  const tokensPerLine = Math.max(1, estimateTokens(content) / lines.length);
  const maxLines = Math.floor(maxTokens / tokensPerLine);
  if (maxLines >= lines.length) return content;
  if (maxLines <= 0) return "";
  const chunkLines = maxLines;
  const overlap = Math.min(Math.floor(chunkLines * 0.3), 25);
  const step = Math.max(1, chunkLines - overlap);
  const chunks = [];
  for (let start = 0; start < lines.length; start += step) {
    const end = Math.min(start + chunkLines, lines.length);
    const text = lines.slice(start, end).join("\n");
    chunks.push({ text, startLine: start });
    if (end >= lines.length) break;
  }
  if (chunks.length <= 1) {
    return lines.slice(0, maxLines).join("\n");
  }
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].text;
    let score = 0;
    for (const sym of symbolNames) {
      let pos = 0;
      while ((pos = chunk.indexOf(sym, pos)) !== -1) {
        score++;
        pos += sym.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  const selected = chunks[bestIdx].text;
  if (estimateTokens(selected) <= maxTokens) return selected;
  const selectedLines = selected.split("\n");
  while (selectedLines.length > 1 && estimateTokens(selectedLines.join("\n")) > maxTokens) {
    selectedLines.pop();
  }
  return selectedLines.join("\n");
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
        const maxBudget = Math.floor(tokenBudget * 0.4);
        const symbolNames = targetModule.symbols.map((s) => s.name);
        const bestChunk = bestChunkBySymbolDensity(content, symbolNames, maxBudget);
        const bestLines = bestChunk.split("\n");
        chunks.push({
          filePath: targetModule.filePath,
          startLine: 1,
          endLine: bestLines.length,
          content: bestChunk,
          relevanceScore: 1,
          kind: "full-file"
        });
        usedTokens += estimateTokens(bestChunk);
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
        const symbolNames = mod.symbols.map((s) => s.name);
        const bestChunk = bestChunkBySymbolDensity(content, symbolNames, remaining);
        const chunkTokens = estimateTokens(bestChunk);
        if (chunkTokens > 20) {
          const bestLines = bestChunk.split("\n");
          chunks.push({
            filePath: mod.filePath,
            startLine: 1,
            endLine: bestLines.length,
            content: bestChunk,
            relevanceScore: score,
            kind: "full-file"
          });
          usedTokens += chunkTokens;
        }
      }
    } catch {
    }
  }
  return chunks;
}

// src/generators/prompt-builder.ts
function buildPageSystemPrompt() {
  return [
    "You are an expert technical writer and software architect.",
    "You produce clear, accurate, developer-focused documentation grounded exclusively in the source code provided to you.",
    "You never invent information, speculate about behaviour, or use knowledge outside the supplied context.",
    "Your writing is precise, concise, and free of marketing language."
  ].join(" ");
}
function buildPagePrompt(options) {
  const {
    title,
    projectName,
    contextChunks,
    pageInstructions,
    sourceFiles,
    repoUrl,
    branch = "main"
  } = options;
  const sections = [];
  sections.push(formatSourceContext(contextChunks));
  sections.push(formatProvenanceInstruction(sourceFiles, projectName, title, repoUrl, branch));
  sections.push(formatPageInstructions(title, projectName, pageInstructions));
  sections.push(MERMAID_RULES);
  sections.push(CITATION_RULES);
  sections.push(FORMATTING_RULES);
  return sections.join("\n\n");
}
function formatSourceContext(chunks) {
  if (chunks.length === 0) {
    return "## Source Code Context\n\nNo source code context was provided.";
  }
  const formatted = chunks.map((chunk) => {
    const header = `### ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine})`;
    return `${header}
\`\`\`
${chunk.content}
\`\`\``;
  });
  return `## Source Code Context

Below is the source code you MUST base your documentation on.

${formatted.join("\n\n")}`;
}
function formatProvenanceInstruction(sourceFiles, projectName, title, repoUrl, branch = "main") {
  const fileList = sourceFiles.map((f) => {
    if (repoUrl) {
      const cleanUrl = repoUrl.replace(/\/$/, "");
      return `- [\`${f}\`](${cleanUrl}/blob/${branch}/${f})`;
    }
    return `- \`${f}\``;
  }).join("\n");
  return [
    "## CRITICAL STARTING INSTRUCTION",
    "",
    "Your page MUST begin with the following provenance block before ANY other content:",
    "",
    "```markdown",
    "<details>",
    `<summary>Sources for "${title}" in ${projectName}</summary>`,
    "",
    fileList,
    "",
    "</details>",
    "```",
    "",
    "Do NOT omit or reformat this block. It must appear verbatim as the first element of your output."
  ].join("\n");
}
function formatPageInstructions(title, projectName, pageInstructions) {
  return [
    "## Page Instructions",
    "",
    `Write a documentation page titled **"${title}"** for the project **${projectName}**.`,
    "",
    pageInstructions
  ].join("\n");
}
var MERMAID_RULES = `## MERMAID DIAGRAM RULES

When including diagrams, follow these rules exactly. Broken Mermaid cannot be retried in a static site.

1. Use \`\`\`mermaid code blocks for all diagrams.
2. Always use \`flowchart TD\` (top-down). Never use \`flowchart LR\`.
3. Maximum 15 nodes per diagram. Keep labels to 3-4 words.
4. Do NOT use special characters in node labels: no parentheses, brackets, quotes, colons, or semicolons inside the label text itself.
5. Do NOT use HTML tags in labels.
6. Wrap labels in double quotes if they contain spaces: \`A["My Label"]\`.
7. Use simple arrow syntax: \`A --> B\`.
8. For labeled edges: \`A -->|"label"| B\`.
9. For subgraphs: \`subgraph Name["Display Name"] ... end\`.
10. Every node referenced in an arrow MUST be defined.
11. For sequence diagrams: use \`sequenceDiagram\`, max 6 participants, max 15 messages.
12. Solid arrows (\`->>\`) for calls, dashed arrows (\`-->>\`) for returns.
13. If a diagram would exceed these limits, split it into multiple smaller diagrams with explanatory text between them.`;
var CITATION_RULES = `## SOURCE CITATION RULES

1. For EVERY piece of significant information, cite the source file and line numbers.
2. Place citations at the end of the paragraph or directly under diagrams and tables.
3. Format for a line range: \`Sources: [filename.ext:start_line-end_line]()\`
4. Format for a single line: \`Sources: [filename.ext:line_number]()\`
5. Multiple sources: \`Sources: [file1.ext:1-10](), [file2.ext:5]()\`
6. ALL information MUST be derived SOLELY from the provided source files.
7. Do NOT infer, invent, or use external knowledge beyond what the source code shows.`;
var FORMATTING_RULES = `## FORMATTING RULES

1. Use standard Markdown headings (\`##\`, \`###\`). Do not use \`#\` (h1) -- the page title is set by MkDocs.
2. Use fenced code blocks with language identifiers for all code snippets.
3. Use tables for structured comparisons or parameter descriptions.
4. Use admonition syntax (\`!!! note\`, \`!!! warning\`, \`!!! tip\`) for callouts.
5. Do NOT start paragraphs with "This module provides..." or similar filler phrases.
6. Do NOT use marketing language, superlatives, or promotional tone.
7. Write in second person ("you") when addressing the reader.
8. Keep paragraphs short -- 2-4 sentences maximum.
9. Prefer concrete examples over abstract descriptions.`;

// src/generators/narrative-engine.ts
import path2 from "path";

// src/generators/diagrams.ts
var MERMAID_BLOCK_REGEX = /```(?:mermaid)?\n?([\s\S]*?)```/;
function validateMermaid(code) {
  const errors = [];
  let fixed = code;
  const firstLine = code.trim().split("\n")[0].trim();
  const validTypes = ["flowchart", "graph", "sequenceDiagram", "classDiagram", "stateDiagram", "erDiagram", "gantt", "pie", "mindmap", "timeline"];
  if (!validTypes.some((t) => firstLine.startsWith(t))) {
    errors.push(`Invalid diagram type: ${firstLine}`);
  }
  const subgraphCount = (code.match(/\bsubgraph\b/g) || []).length;
  const endCount = (code.match(/^\s*end\s*$/gm) || []).length;
  if (subgraphCount > endCount) {
    errors.push(`Unbalanced subgraphs: ${subgraphCount} subgraph vs ${endCount} end`);
    for (let i = 0; i < subgraphCount - endCount; i++) {
      fixed += "\n    end";
    }
  }
  const unquotedLabelRegex = /([A-Za-z0-9_]+)\[([^\]"]+)\]/g;
  let match;
  const fixedParts = [];
  while ((match = unquotedLabelRegex.exec(code)) !== null) {
    const label = match[2];
    if (/[(){}:;'<>]/.test(label)) {
      errors.push(`Special characters in unquoted label: "${label}"`);
      fixedParts.push({
        original: match[0],
        replacement: `${match[1]}["${label.replace(/"/g, "'")}"]`
      });
    }
  }
  for (const { original, replacement } of fixedParts) {
    fixed = fixed.replace(original, replacement);
  }
  if (/flowchart\s+LR/i.test(code)) {
    errors.push("Using LR orientation instead of TD");
    fixed = fixed.replace(/flowchart\s+LR/gi, "flowchart TD");
  }
  if (firstLine.startsWith("flowchart") || firstLine.startsWith("graph")) {
    const nodeDefinitions = code.match(/[A-Za-z0-9_]+[\[({]/g) || [];
    const uniqueNodes = new Set(nodeDefinitions.map((n) => n.replace(/[\[({]$/, "")));
    if (uniqueNodes.size > 20) {
      errors.push(`Too many nodes (${uniqueNodes.size}), may render poorly`);
    }
  }
  return { valid: errors.length === 0, errors, fixed };
}
function extractAllMermaidBlocks(text) {
  const blocks = [];
  const globalRegex = new RegExp(MERMAID_BLOCK_REGEX.source, "g");
  let match;
  while ((match = globalRegex.exec(text)) !== null) {
    const code = match[1].trim();
    const { fixed } = validateMermaid(code);
    blocks.push(fixed);
  }
  return blocks;
}

// src/generators/validators.ts
var TEMPLATE_ARTIFACT_PATTERNS = [
  /^.*YOUR_.*$/gm,
  /^.*TODO:.*$/gm,
  /^.*PLACEHOLDER.*$/gm,
  /^.*\[INSERT.*$/gm,
  /^.*\{\{.*\}\}.*$/gm
];
var MIN_LENGTH = {
  overview: 200,
  architecture: 200,
  module: 100,
  "getting-started": 200,
  concept: 100
};
function validateNarrativeProse(prose, kind, options) {
  const warnings = [];
  let cleaned = prose;
  for (const pattern of TEMPLATE_ARTIFACT_PATTERNS) {
    const before = cleaned;
    cleaned = cleaned.replace(pattern, "");
    if (cleaned !== before) {
      warnings.push(`Stripped template artifact matching ${pattern.source}`);
    }
  }
  if (options?.expectNoH1) {
    const h1Pattern = /^# .+$/gm;
    const before = cleaned;
    cleaned = cleaned.replace(h1Pattern, "");
    if (cleaned !== before) {
      warnings.push("Stripped H1 heading from narrative prose");
    }
  }
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
  const minLength = MIN_LENGTH[kind] ?? 100;
  const valid = cleaned.length >= minLength;
  if (!valid) {
    warnings.push(`Prose too short: ${cleaned.length} chars (minimum ${minLength} for ${kind})`);
  }
  return { valid, warnings, prose: cleaned };
}

// src/generators/narrative-engine.ts
async function generateOverviewNarrative(options) {
  const { provider, manifest, readFile, contextBudget = 8e3 } = options;
  const contextChunks = await buildContext({
    tokenBudget: contextBudget,
    manifest,
    readFile
  });
  const moduleList = manifest.modules.map((m) => `- ${m.filePath} (${m.language}, ${m.symbols.length} symbols)`).slice(0, 30).join("\n");
  const pageInstructions = `PROJECT: ${manifest.projectMeta.name}
LANGUAGES: ${manifest.projectMeta.languages.map((l) => `${l.name} (${l.percentage}%)`).join(", ")}
TOTAL FILES: ${manifest.stats.totalFiles}
TOTAL SYMBOLS: ${manifest.stats.totalSymbols}

KEY MODULES:
${moduleList}

Write a comprehensive technical overview following this structure:

1. **Introduction** (1-2 paragraphs): What the project does, who it's for, and the core problem it solves. Reference the main entry point and key modules.

2. **Architecture Overview**: Describe the major layers/components and how they interact. Include a Mermaid diagram showing the high-level architecture.

3. **Core Components**: For each major component/layer, explain its purpose and key design decisions. Use tables to summarize modules:
| Module | Purpose |
|--------|---------|

4. **Data Flow**: How data moves through the system \u2014 from input to processing to output. Reference specific functions and types.

5. **Key Design Decisions**: Trade-offs made, patterns used (e.g., provider pattern, plugin architecture), and why.

Do NOT include a title heading (# Overview) \u2014 it will be added by the template.`;
  const prompt = buildPagePrompt({
    title: "Overview",
    projectName: manifest.projectMeta.name,
    contextChunks,
    pageInstructions,
    sourceFiles: contextChunks.map((c) => c.filePath),
    repoUrl: manifest.projectMeta.repository
  });
  let prose = await provider.generate(prompt, {
    maxTokens: 2048,
    temperature: 0.3,
    systemPrompt: buildPageSystemPrompt()
  });
  prose = ensureProvenanceBlock(prose, contextChunks, manifest.projectMeta.name, "Overview", manifest.projectMeta.repository);
  prose = validateNarrativeProse(prose, "overview").prose;
  const rawCitations = extractCitations(prose);
  const validated = validateCitations(prose, rawCitations, manifest);
  prose = validated.prose;
  const suggestedDiagrams = extractDiagramSuggestions(prose);
  return { prose, citations: validated.citations, suggestedDiagrams };
}
async function generateGettingStartedNarrative(options) {
  const { provider, manifest, readFile, contextBudget = 6e3 } = options;
  const relevantPatterns = [
    "index.",
    "main.",
    "app.",
    "readme",
    "README",
    "Dockerfile",
    "docker-compose",
    "package.json",
    "pyproject.toml",
    "go.mod",
    "Cargo.toml",
    "Makefile",
    "setup.py",
    "setup.cfg"
  ];
  const entryModules = manifest.modules.filter(
    (m) => relevantPatterns.some((pattern) => m.filePath.toLowerCase().includes(pattern.toLowerCase()))
  );
  const contextChunks = [];
  let usedTokens = 0;
  for (const mod of entryModules.slice(0, 8)) {
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
  const projectMeta = manifest.projectMeta;
  const projectContext = [
    `PROJECT: ${projectMeta.name}`,
    `LANGUAGES: ${projectMeta.languages.map((l) => l.name).join(", ")}`,
    `PACKAGE MANAGER: ${projectMeta.packageManager || "unknown"}`,
    `ENTRY POINTS: ${projectMeta.entryPoints.join(", ")}`,
    projectMeta.projectType ? `PROJECT TYPE: ${projectMeta.projectType}` : null,
    projectMeta.framework ? `FRAMEWORK: ${projectMeta.framework}` : null,
    projectMeta.description ? `DESCRIPTION: ${projectMeta.description}` : null,
    projectMeta.readmeDescription ? `README SUMMARY: ${projectMeta.readmeDescription}` : null
  ].filter(Boolean).join("\n");
  const pageInstructions = `${projectContext}

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

Every section must help the reader DO something concrete.
Keep it concise \u2014 developers want to get started, not read an essay.`;
  const prompt = buildPagePrompt({
    title: "Getting Started",
    projectName: projectMeta.name,
    contextChunks,
    pageInstructions,
    sourceFiles: contextChunks.map((c) => c.filePath),
    repoUrl: projectMeta.repository
  });
  let prose = await provider.generate(prompt, {
    maxTokens: 2048,
    temperature: 0.3,
    systemPrompt: buildPageSystemPrompt()
  });
  prose = ensureProvenanceBlock(prose, contextChunks, projectMeta.name, "Getting Started", projectMeta.repository);
  prose = validateNarrativeProse(prose, "getting-started").prose;
  const rawCitations = extractCitations(prose);
  const validated = validateCitations(prose, rawCitations, manifest);
  prose = validated.prose;
  return { prose, citations: validated.citations, suggestedDiagrams: [] };
}
async function generateModuleNarrative(module, options) {
  const { provider, manifest, readFile, contextBudget = 6e3 } = options;
  const contextChunks = await buildContext({
    targetModule: module,
    tokenBudget: contextBudget,
    manifest,
    readFile
  });
  const symbolList = module.symbols.filter((s) => s.exported).map((s) => `- ${s.kind} ${s.name}${s.signature ? `: ${s.signature}` : ""}`).join("\n");
  const depCount = manifest.dependencyGraph.edges.filter((e) => e.to === module.filePath).length;
  const usedBy = manifest.dependencyGraph.edges.filter((e) => e.to === module.filePath).map((e) => e.from).slice(0, 5);
  const imports = module.imports.map((imp) => imp.source).slice(0, 10);
  const hasManyDeps = imports.length >= 3 || depCount >= 3;
  const pageInstructions = `FILE: ${module.filePath}
LANGUAGE: ${module.language}
IMPORTS: ${imports.join(", ") || "(none)"}
IMPORTED BY: ${depCount} modules${usedBy.length > 0 ? ` (${usedBy.join(", ")})` : ""}

EXPORTED SYMBOLS:
${symbolList || "(none)"}

Write a clear, developer-focused module description following this structure:

1. **Architectural framing** (first sentence): Start by stating this module's role in the system architecture \u2014 e.g., "Acts as the bridge between X and Y" or "Serves as the single entry point for Z".

2. **How it works**: Explain the key logic, algorithms, or patterns. If there are multiple exported symbols, describe how they relate to each other. Reference specific function/class names.

3. **Usage context**: How other modules use this one. What calls into it and why. Include a brief code example showing typical usage (2-3 lines, using actual exported functions/classes).

4. **Key implementation details**: Important trade-offs, error handling strategies, or performance considerations that a developer modifying this code should know.
${hasManyDeps ? `
5. **Dependency diagram**: Include a small Mermaid diagram showing this module's key relationships.
Keep to 5-8 nodes max.` : ""}

Do NOT include Markdown headings (## or #) \u2014 this is inserted into an existing page.
NEVER say "This module provides..." or "This file contains..." \u2014 state the architectural role directly.
Write 3-5 focused paragraphs with code examples and citations.
Write for developers who need to understand or modify this code.`;
  const prompt = buildPagePrompt({
    title: module.filePath,
    projectName: manifest.projectMeta.name,
    contextChunks,
    pageInstructions,
    sourceFiles: contextChunks.map((c) => c.filePath),
    repoUrl: manifest.projectMeta.repository
  });
  let prose = await provider.generate(prompt, {
    maxTokens: 1536,
    temperature: 0.3,
    systemPrompt: buildPageSystemPrompt()
  });
  prose = ensureProvenanceBlock(prose, contextChunks, manifest.projectMeta.name, module.filePath, manifest.projectMeta.repository);
  prose = validateNarrativeProse(prose, "module", { expectNoH1: true }).prose;
  const rawCitations = extractCitations(prose);
  const validated = validateCitations(prose, rawCitations, manifest);
  prose = validated.prose;
  const suggestedDiagrams = extractDiagramSuggestions(prose);
  return { prose, citations: validated.citations, suggestedDiagrams };
}
async function generateArchitectureNarrative(options) {
  const { provider, manifest, readFile, contextBudget = 8e3 } = options;
  const contextChunks = await buildContext({
    topic: "architecture core engine",
    tokenBudget: contextBudget,
    manifest,
    readFile
  });
  const { dependencyGraph } = manifest;
  const connectionCounts = /* @__PURE__ */ new Map();
  for (const edge of dependencyGraph.edges) {
    connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
    connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
  }
  const topModules = [...connectionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([file, count]) => `- ${file} (${count} connections)`).join("\n");
  const pageInstructions = `PROJECT: ${manifest.projectMeta.name}
MODULES: ${dependencyGraph.nodes.length}
DEPENDENCY EDGES: ${dependencyGraph.edges.length}

MOST CONNECTED MODULES:
${topModules}

Write detailed architecture documentation following this structure:

1. **System Overview** (1-2 paragraphs): High-level description of the system's purpose and architectural style (layered, microservice, pipeline, etc.).

2. **Component Architecture**: Include a Mermaid diagram showing the major components and their relationships. Group related components in subgraphs.

3. **Component Deep Dive**: For each major component, describe:
   - Its responsibility and public interface
   - Key classes/functions it exposes
   - How it communicates with other components

4. **Data Flow**: How a typical request/operation flows through the system. Include a sequence diagram.

5. **Key Patterns**: Architectural patterns used (dependency injection, plugin registry, event bus, etc.) and why they were chosen.

6. **Module Coupling**: Table of the most connected modules and what they depend on:
| Module | Connections | Role |
|--------|:-----------:|------|

Do NOT include a title heading \u2014 it will be added by the template.`;
  const prompt = buildPagePrompt({
    title: "Architecture",
    projectName: manifest.projectMeta.name,
    contextChunks,
    pageInstructions,
    sourceFiles: contextChunks.map((c) => c.filePath),
    repoUrl: manifest.projectMeta.repository
  });
  let prose = await provider.generate(prompt, {
    maxTokens: 2048,
    temperature: 0.3,
    systemPrompt: buildPageSystemPrompt()
  });
  prose = ensureProvenanceBlock(prose, contextChunks, manifest.projectMeta.name, "Architecture", manifest.projectMeta.repository);
  prose = validateNarrativeProse(prose, "architecture").prose;
  const rawCitations = extractCitations(prose);
  const validated = validateCitations(prose, rawCitations, manifest);
  prose = validated.prose;
  const suggestedDiagrams = extractDiagramSuggestions(prose);
  return { prose, citations: validated.citations, suggestedDiagrams };
}
function validateCitations(prose, citations, manifest) {
  const modulePaths = new Set(manifest.modules.map((m) => m.filePath));
  const moduleLineCount = new Map(manifest.modules.map((m) => [m.filePath, m.lineCount]));
  const valid = [];
  let cleaned = prose;
  let droppedCount = 0;
  for (const citation of citations) {
    const lineCount = moduleLineCount.get(citation.filePath);
    if (modulePaths.has(citation.filePath) && lineCount !== void 0 && citation.line >= 1 && citation.line <= lineCount) {
      valid.push(citation);
    } else {
      cleaned = cleaned.replaceAll(citation.text, `\`${citation.filePath}\``);
      droppedCount++;
    }
  }
  return { prose: cleaned, citations: valid };
}
function ensureProvenanceBlock(prose, contextChunks, projectName, title, repoUrl, branch = "main") {
  if (prose.includes("<details>")) return prose;
  const sourceFiles = contextChunks.map((c) => c.filePath);
  const fileList = sourceFiles.map((f) => {
    if (repoUrl) {
      const cleanUrl = repoUrl.replace(/\/$/, "");
      return `- [\`${f}\`](${cleanUrl}/blob/${branch}/${f})`;
    }
    return `- \`${f}\``;
  }).join("\n");
  const block = [
    "<details>",
    `<summary>Sources for "${title}" in ${projectName}</summary>`,
    "",
    fileList,
    "",
    "</details>",
    ""
  ].join("\n");
  return block + prose;
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
function renderCitations(prose, citations, repoUrl, branch, currentPagePath, validPagePaths) {
  let result = prose;
  const seen = /* @__PURE__ */ new Set();
  for (const citation of citations) {
    if (seen.has(citation.text)) continue;
    seen.add(citation.text);
    if (repoUrl) {
      const linkTarget = `https://github.com/${repoUrl}/blob/${branch || "main"}/${citation.filePath}#L${citation.line}`;
      result = result.replaceAll(
        citation.text,
        `[${citation.filePath}:${citation.line}](${linkTarget})`
      );
    } else {
      const targetPage = `api/${citation.filePath.replace(/\.[^.]+$/, "")}.md`;
      if (validPagePaths && !validPagePaths.has(targetPage)) {
        result = result.replaceAll(
          citation.text,
          `\`${citation.filePath}:${citation.line}\``
        );
      } else {
        let linkTarget;
        if (currentPagePath) {
          linkTarget = path2.posix.relative(
            path2.posix.dirname(currentPagePath),
            targetPage
          );
        } else {
          linkTarget = targetPage;
        }
        result = result.replaceAll(
          citation.text,
          `[${citation.filePath}:${citation.line}](${linkTarget})`
        );
      }
    }
  }
  return result;
}

export {
  buildContext,
  buildPageSystemPrompt,
  buildPagePrompt,
  generateOverviewNarrative,
  generateGettingStartedNarrative,
  generateModuleNarrative,
  generateArchitectureNarrative,
  renderCitations
};
