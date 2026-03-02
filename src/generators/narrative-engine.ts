/**
 * AI Narrative Engine
 *
 * Orchestrates prompt building, LLM calls, citation extraction,
 * and diagram suggestions for narrative documentation pages.
 * When AI is enabled, generates LLM-written conceptual prose
 * instead of template strings.
 */

import path from "path";
import type { AIProvider } from "../analysis/providers/base.js";
import type { AnalysisManifest, ModuleInfo, Citation, DiagramSuggestion } from "../analysis/types.js";
import { buildContext, type ContextChunk } from "../analysis/context-builder.js";
import { estimateTokens } from "./utils.js";
import { extractAllMermaidBlocks } from "./diagrams.js";
import { buildPagePrompt, buildPageSystemPrompt } from "./prompt-builder.js";
import { validateNarrativeProse } from "./validators.js";

export interface NarrativeResult {
  /** LLM-generated prose content */
  prose: string;
  /** Source citations extracted from the prose */
  citations: Citation[];
  /** Suggested diagrams the LLM identified */
  suggestedDiagrams: DiagramSuggestion[];
}

export interface NarrativeOptions {
  /** The AI provider to use */
  provider: AIProvider;
  /** Full analysis manifest */
  manifest: AnalysisManifest;
  /** Function to read file contents */
  readFile: (filePath: string) => Promise<string>;
  /** Maximum token budget for context assembly */
  contextBudget?: number;
}

/**
 * Generate a narrative overview for the entire project.
 */
export async function generateOverviewNarrative(
  options: NarrativeOptions
): Promise<NarrativeResult> {
  const { provider, manifest, readFile, contextBudget = 8000 } = options;

  const contextChunks = await buildContext({
    tokenBudget: contextBudget,
    manifest,
    readFile,
  });

  const moduleList = manifest.modules
    .map((m) => `- ${m.filePath} (${m.language}, ${m.symbols.length} symbols)`)
    .slice(0, 30)
    .join("\n");

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

4. **Data Flow**: How data moves through the system — from input to processing to output. Reference specific functions and types.

5. **Key Design Decisions**: Trade-offs made, patterns used (e.g., provider pattern, plugin architecture), and why.

Do NOT include a title heading (# Overview) — it will be added by the template.`;

  const prompt = buildPagePrompt({
    title: "Overview",
    projectName: manifest.projectMeta.name,
    contextChunks,
    pageInstructions,
    sourceFiles: contextChunks.map((c) => c.filePath),
    repoUrl: manifest.projectMeta.repository,
  });

  let prose = await provider.generate(prompt, {
    maxTokens: 2048,
    temperature: 0.3,
    systemPrompt: buildPageSystemPrompt(),
  });

  prose = ensureProvenanceBlock(prose, contextChunks, manifest.projectMeta.name, "Overview", manifest.projectMeta.repository);
  prose = validateNarrativeProse(prose, "overview").prose;

  const rawCitations = extractCitations(prose);
  const validated = validateCitations(prose, rawCitations, manifest);
  prose = validated.prose;
  const suggestedDiagrams = extractDiagramSuggestions(prose);

  return { prose, citations: validated.citations, suggestedDiagrams };
}

/**
 * Generate a narrative getting-started guide.
 */
export async function generateGettingStartedNarrative(
  options: NarrativeOptions
): Promise<NarrativeResult> {
  const { provider, manifest, readFile, contextBudget = 6000 } = options;

  // Focus context on entry points, config files, and project setup files
  const relevantPatterns = [
    "index.", "main.", "app.",
    "readme", "README",
    "Dockerfile", "docker-compose",
    "package.json", "pyproject.toml", "go.mod", "Cargo.toml",
    "Makefile", "setup.py", "setup.cfg",
  ];

  const entryModules = manifest.modules.filter(
    (m) => relevantPatterns.some((pattern) => m.filePath.toLowerCase().includes(pattern.toLowerCase()))
  );

  const contextChunks: ContextChunk[] = [];
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
          relevanceScore: 1.0,
          kind: "full-file",
        });
        usedTokens += tokens;
      }
    } catch {
      // skip
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
    projectMeta.readmeDescription ? `README SUMMARY: ${projectMeta.readmeDescription}` : null,
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
Keep it concise — developers want to get started, not read an essay.`;

  const prompt = buildPagePrompt({
    title: "Getting Started",
    projectName: projectMeta.name,
    contextChunks,
    pageInstructions,
    sourceFiles: contextChunks.map((c) => c.filePath),
    repoUrl: projectMeta.repository,
  });

  let prose = await provider.generate(prompt, {
    maxTokens: 2048,
    temperature: 0.3,
    systemPrompt: buildPageSystemPrompt(),
  });

  prose = ensureProvenanceBlock(prose, contextChunks, projectMeta.name, "Getting Started", projectMeta.repository);
  prose = validateNarrativeProse(prose, "getting-started").prose;

  const rawCitations = extractCitations(prose);
  const validated = validateCitations(prose, rawCitations, manifest);
  prose = validated.prose;

  return { prose, citations: validated.citations, suggestedDiagrams: [] };
}

/**
 * Generate a narrative description for a specific module.
 */
export async function generateModuleNarrative(
  module: ModuleInfo,
  options: NarrativeOptions
): Promise<NarrativeResult> {
  const { provider, manifest, readFile, contextBudget = 6000 } = options;

  const contextChunks = await buildContext({
    targetModule: module,
    tokenBudget: contextBudget,
    manifest,
    readFile,
  });

  const symbolList = module.symbols
    .filter((s) => s.exported)
    .map((s) => `- ${s.kind} ${s.name}${s.signature ? `: ${s.signature}` : ""}`)
    .join("\n");

  const depCount = manifest.dependencyGraph.edges.filter((e) => e.to === module.filePath).length;
  const usedBy = manifest.dependencyGraph.edges
    .filter((e) => e.to === module.filePath)
    .map((e) => e.from)
    .slice(0, 5);

  const imports = module.imports.map((imp) => imp.source).slice(0, 10);
  const hasManyDeps = imports.length >= 3 || depCount >= 3;

  const pageInstructions = `FILE: ${module.filePath}
LANGUAGE: ${module.language}
IMPORTS: ${imports.join(", ") || "(none)"}
IMPORTED BY: ${depCount} modules${usedBy.length > 0 ? ` (${usedBy.join(", ")})` : ""}

EXPORTED SYMBOLS:
${symbolList || "(none)"}

Write a clear, developer-focused module description following this structure:

1. **Architectural framing** (first sentence): Start by stating this module's role in the system architecture — e.g., "Acts as the bridge between X and Y" or "Serves as the single entry point for Z".

2. **How it works**: Explain the key logic, algorithms, or patterns. If there are multiple exported symbols, describe how they relate to each other. Reference specific function/class names.

3. **Usage context**: How other modules use this one. What calls into it and why. Include a brief code example showing typical usage (2-3 lines, using actual exported functions/classes).

4. **Key implementation details**: Important trade-offs, error handling strategies, or performance considerations that a developer modifying this code should know.
${hasManyDeps ? `
5. **Dependency diagram**: Include a small Mermaid diagram showing this module's key relationships.
Keep to 5-8 nodes max.` : ""}

Do NOT include Markdown headings (## or #) — this is inserted into an existing page.
NEVER say "This module provides..." or "This file contains..." — state the architectural role directly.
Write 3-5 focused paragraphs with code examples and citations.
Write for developers who need to understand or modify this code.`;

  const prompt = buildPagePrompt({
    title: module.filePath,
    projectName: manifest.projectMeta.name,
    contextChunks,
    pageInstructions,
    sourceFiles: contextChunks.map((c) => c.filePath),
    repoUrl: manifest.projectMeta.repository,
  });

  let prose = await provider.generate(prompt, {
    maxTokens: 1536,
    temperature: 0.3,
    systemPrompt: buildPageSystemPrompt(),
  });

  prose = ensureProvenanceBlock(prose, contextChunks, manifest.projectMeta.name, module.filePath, manifest.projectMeta.repository);
  prose = validateNarrativeProse(prose, "module", { expectNoH1: true }).prose;

  const rawCitations = extractCitations(prose);
  const validated = validateCitations(prose, rawCitations, manifest);
  prose = validated.prose;
  const suggestedDiagrams = extractDiagramSuggestions(prose);

  return { prose, citations: validated.citations, suggestedDiagrams };
}

/**
 * Generate narrative content for architecture page.
 */
export async function generateArchitectureNarrative(
  options: NarrativeOptions
): Promise<NarrativeResult> {
  const { provider, manifest, readFile, contextBudget = 8000 } = options;

  const contextChunks = await buildContext({
    topic: "architecture core engine",
    tokenBudget: contextBudget,
    manifest,
    readFile,
  });

  // Build a summary of the dependency graph
  const { dependencyGraph } = manifest;
  const connectionCounts = new Map<string, number>();
  for (const edge of dependencyGraph.edges) {
    connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
    connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
  }
  const topModules = [...connectionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([file, count]) => `- ${file} (${count} connections)`)
    .join("\n");

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

Do NOT include a title heading — it will be added by the template.`;

  const prompt = buildPagePrompt({
    title: "Architecture",
    projectName: manifest.projectMeta.name,
    contextChunks,
    pageInstructions,
    sourceFiles: contextChunks.map((c) => c.filePath),
    repoUrl: manifest.projectMeta.repository,
  });

  let prose = await provider.generate(prompt, {
    maxTokens: 2048,
    temperature: 0.3,
    systemPrompt: buildPageSystemPrompt(),
  });

  prose = ensureProvenanceBlock(prose, contextChunks, manifest.projectMeta.name, "Architecture", manifest.projectMeta.repository);
  prose = validateNarrativeProse(prose, "architecture").prose;

  const rawCitations = extractCitations(prose);
  const validated = validateCitations(prose, rawCitations, manifest);
  prose = validated.prose;
  const suggestedDiagrams = extractDiagramSuggestions(prose);

  return { prose, citations: validated.citations, suggestedDiagrams };
}

// ─── Validation Helpers ─────────────────────────────────────────────────────

/**
 * Validate extracted citations against the manifest.
 * Drops citations whose file path doesn't exist in the manifest or
 * whose line number exceeds the module's line count.
 * Returns the cleaned prose (invalid citation markers replaced with
 * just the filename as inline code) and the valid citation list.
 */
export function validateCitations(
  prose: string,
  citations: Citation[],
  manifest: AnalysisManifest
): { prose: string; citations: Citation[] } {
  const modulePaths = new Set(manifest.modules.map((m) => m.filePath));
  const moduleLineCount = new Map(manifest.modules.map((m) => [m.filePath, m.lineCount]));

  const valid: Citation[] = [];
  let cleaned = prose;
  let droppedCount = 0;

  for (const citation of citations) {
    const lineCount = moduleLineCount.get(citation.filePath);
    if (modulePaths.has(citation.filePath) && lineCount !== undefined && citation.line >= 1 && citation.line <= lineCount) {
      valid.push(citation);
    } else {
      // Replace the raw [file:line] text with just the filename as inline code
      cleaned = cleaned.replaceAll(citation.text, `\`${citation.filePath}\``);
      droppedCount++;
    }
  }

  return { prose: cleaned, citations: valid };
}

/**
 * Ensure the prose contains a provenance `<details>` block.
 * If the LLM omitted it, synthesize one from the context chunks.
 */
export function ensureProvenanceBlock(
  prose: string,
  contextChunks: ContextChunk[],
  projectName: string,
  title: string,
  repoUrl?: string,
  branch = "main"
): string {
  if (prose.includes("<details>")) return prose;

  const sourceFiles = contextChunks.map((c) => c.filePath);
  const fileList = sourceFiles
    .map((f) => {
      if (repoUrl) {
        const cleanUrl = repoUrl.replace(/\/$/, "");
        return `- [\`${f}\`](${cleanUrl}/blob/${branch}/${f})`;
      }
      return `- \`${f}\``;
    })
    .join("\n");

  const block = [
    "<details>",
    `<summary>Sources for "${title}" in ${projectName}</summary>`,
    "",
    fileList,
    "",
    "</details>",
    "",
  ].join("\n");

  return block + prose;
}

/**
 * Levenshtein edit distance between two strings.
 * Optimized: bails out early when distance exceeds maxDist.
 */
function levenshtein(a: string, b: string, maxDist = 2): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, curr[j]);
    }
    if (rowMin > maxDist) return maxDist + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Built-in type names that should not be corrected */
const BUILTIN_TYPES = new Set([
  "Promise", "Map", "Set", "Array", "Record", "Partial", "Error", "Buffer",
  "String", "Number", "Boolean", "Object", "Function", "Symbol", "RegExp",
  "Date", "Math", "JSON", "Uint8Array", "Int32Array", "Float64Array",
  "ArrayBuffer", "SharedArrayBuffer", "DataView", "WeakMap", "WeakSet",
  "Proxy", "Reflect", "Intl", "Iterator", "Generator", "AsyncGenerator",
  "ReadableStream", "WritableStream", "TransformStream", "Response", "Request",
  "Headers", "URL", "URLSearchParams", "FormData", "Blob", "File",
  "Omit", "Pick", "Required", "Readonly", "Exclude", "Extract", "NonNullable",
  "ReturnType", "Parameters", "InstanceType", "ConstructorParameters",
  "Awaited", "Uppercase", "Lowercase", "Capitalize", "Uncapitalize",
]);

/**
 * Validate backtick-quoted PascalCase identifiers in prose against the manifest.
 * Auto-corrects hallucinated names that have a close Levenshtein match (distance 2 or less).
 */
export function validateSymbolReferences(prose: string, manifest: AnalysisManifest): string {
  // Build set of all symbol names from manifest
  const allSymbolNames = new Set<string>();
  for (const mod of manifest.modules) {
    for (const sym of mod.symbols) {
      allSymbolNames.add(sym.name);
    }
  }

  // Index by first letter for fast lookup
  const byFirstLetter = new Map<string, string[]>();
  for (const name of allSymbolNames) {
    const key = name[0];
    if (!byFirstLetter.has(key)) byFirstLetter.set(key, []);
    byFirstLetter.get(key)!.push(name);
  }

  // Find backtick-quoted PascalCase identifiers
  const pattern = /`([A-Z][a-zA-Z0-9_]+)`/g;
  let result = prose;

  // Collect all replacements first to avoid modifying string while iterating
  const replacements: Array<{ from: string; to: string }> = [];
  let match;

  while ((match = pattern.exec(prose)) !== null) {
    const name = match[1];

    // Skip if it's a known symbol or built-in type
    if (allSymbolNames.has(name) || BUILTIN_TYPES.has(name)) continue;

    // Find closest match among candidates with same first letter and similar length
    const candidates = byFirstLetter.get(name[0]) || [];
    let bestMatch: string | undefined;
    let bestDist = 3; // threshold

    for (const candidate of candidates) {
      if (Math.abs(candidate.length - name.length) > 2) continue;
      const dist = levenshtein(name, candidate);
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = candidate;
      }
    }

    if (bestMatch) {
      replacements.push({ from: `\`${name}\``, to: `\`${bestMatch}\`` });
    }
    // If no close match, leave as-is (may be an external type)
  }

  // Apply replacements
  for (const { from, to } of replacements) {
    result = result.replaceAll(from, to);
  }

  return result;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatContextChunks(chunks: ContextChunk[]): string {
  return chunks
    .map((c) => {
      const header = `--- ${c.filePath} (lines ${c.startLine}-${c.endLine}, relevance: ${c.relevanceScore.toFixed(1)}) ---`;
      return `${header}\n${c.content}`;
    })
    .join("\n\n");
}

/**
 * Extract [file:line] citations from LLM-generated prose.
 */
function extractCitations(prose: string): Citation[] {
  const citations: Citation[] = [];
  const regex = /\[([^\]]+?):(\d+)\]/g;
  let match;

  while ((match = regex.exec(prose)) !== null) {
    citations.push({
      text: match[0],
      filePath: match[1],
      line: parseInt(match[2], 10),
    });
  }

  return citations;
}

/**
 * Extract diagram suggestions from LLM prose.
 * Looks for Mermaid code blocks the LLM may have included.
 */
function extractDiagramSuggestions(prose: string): DiagramSuggestion[] {
  const blocks = extractAllMermaidBlocks(prose);
  return blocks.map((code) => {
    let type: DiagramSuggestion["type"] = "flowchart";
    if (code.startsWith("sequenceDiagram")) type = "sequence";
    else if (code.startsWith("classDiagram")) type = "class";
    else if (code.startsWith("graph") || code.startsWith("flowchart")) type = "flowchart";

    return {
      type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Diagram`,
      mermaidCode: code,
    };
  });
}

/**
 * Render citations as markdown links.
 * Converts [file:line] references to GitHub blob URLs or local module page links.
 */
export function renderCitations(
  prose: string,
  citations: Citation[],
  repoUrl?: string,
  branch?: string,
  currentPagePath?: string,
  validPagePaths?: Set<string>
): string {
  let result = prose;

  // Deduplicate citations by text to avoid replacing already-replaced content
  const seen = new Set<string>();
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

      // If we have a valid page set and the target isn't in it, render as inline code
      if (validPagePaths && !validPagePaths.has(targetPage)) {
        result = result.replaceAll(
          citation.text,
          `\`${citation.filePath}:${citation.line}\``
        );
      } else {
        let linkTarget: string;
        if (currentPagePath) {
          linkTarget = path.posix.relative(
            path.posix.dirname(currentPagePath),
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
