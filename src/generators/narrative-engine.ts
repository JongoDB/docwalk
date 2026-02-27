/**
 * AI Narrative Engine
 *
 * Orchestrates prompt building, LLM calls, citation extraction,
 * and diagram suggestions for narrative documentation pages.
 * When AI is enabled, generates LLM-written conceptual prose
 * instead of template strings.
 */

import type { AIProvider } from "../analysis/providers/base.js";
import type { AnalysisManifest, ModuleInfo, Citation, DiagramSuggestion } from "../analysis/types.js";
import { buildContext, type ContextChunk } from "../analysis/context-builder.js";
import { estimateTokens } from "./utils.js";
import { extractAllMermaidBlocks } from "./diagrams.js";

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

  const contextText = formatContextChunks(contextChunks);
  const moduleList = manifest.modules
    .map((m) => `- ${m.filePath} (${m.language}, ${m.symbols.length} symbols)`)
    .slice(0, 30)
    .join("\n");

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
5. Be specific — reference actual function/class names from the code
6. Do NOT use marketing language. Be technical and precise.

Write the overview in Markdown format.`;

  const prose = await provider.generate(prompt, {
    maxTokens: 2048,
    temperature: 0.3,
    systemPrompt: "You are a technical documentation writer. Write clear, precise, developer-focused documentation.",
  });

  const citations = extractCitations(prose);
  const suggestedDiagrams = extractDiagramSuggestions(prose);

  return { prose, citations, suggestedDiagrams };
}

/**
 * Generate a narrative getting-started guide.
 */
export async function generateGettingStartedNarrative(
  options: NarrativeOptions
): Promise<NarrativeResult> {
  const { provider, manifest, readFile, contextBudget = 6000 } = options;

  // Focus context on entry points and config files
  const entryModules = manifest.modules.filter(
    (m) => m.filePath.includes("index.") || m.filePath.includes("main.") || m.filePath.includes("app.")
  );

  const contextChunks: ContextChunk[] = [];
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
          relevanceScore: 1.0,
          kind: "full-file",
        });
        usedTokens += tokens;
      }
    } catch {
      // skip
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
5. Keep it actionable — every section should help the reader DO something
6. Write in Markdown format with proper headings

Write the getting-started guide.`;

  const prose = await provider.generate(prompt, {
    maxTokens: 2048,
    temperature: 0.3,
    systemPrompt: "You are a technical documentation writer. Write clear, practical, step-by-step guides.",
  });

  const citations = extractCitations(prose);

  return { prose, citations, suggestedDiagrams: [] };
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

  const contextText = formatContextChunks(contextChunks);

  const symbolList = module.symbols
    .filter((s) => s.exported)
    .map((s) => `- ${s.kind} ${s.name}${s.signature ? `: ${s.signature}` : ""}`)
    .join("\n");

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

Write the module description in Markdown format. Do NOT include headings — this will be inserted into an existing page structure.`;

  const prose = await provider.generate(prompt, {
    maxTokens: 1024,
    temperature: 0.3,
    systemPrompt: "You are a technical documentation writer. Be precise and reference specific code.",
  });

  const citations = extractCitations(prose);
  const suggestedDiagrams = extractDiagramSuggestions(prose);

  return { prose, citations, suggestedDiagrams };
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

  const contextText = formatContextChunks(contextChunks);

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
    systemPrompt: "You are a software architect documenting a system. Be thorough and precise.",
  });

  const citations = extractCitations(prose);
  const suggestedDiagrams = extractDiagramSuggestions(prose);

  return { prose, citations, suggestedDiagrams };
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
  branch?: string
): string {
  let result = prose;

  // Deduplicate citations by text to avoid replacing already-replaced content
  const seen = new Set<string>();
  for (const citation of citations) {
    if (seen.has(citation.text)) continue;
    seen.add(citation.text);

    const linkTarget = repoUrl
      ? `https://github.com/${repoUrl}/blob/${branch || "main"}/${citation.filePath}#L${citation.line}`
      : `api/${citation.filePath.replace(/\.[^.]+$/, "")}.md`;

    result = result.replaceAll(
      citation.text,
      `[${citation.filePath}:${citation.line}](${linkTarget})`
    );
  }

  return result;
}
