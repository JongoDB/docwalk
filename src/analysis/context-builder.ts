/**
 * Smart Context Builder
 *
 * Assembles ranked code chunks from the dependency graph for LLM calls.
 * Provides most of RAG's benefits without embedding/vector dependencies.
 *
 * Relevance scoring uses the existing dependency graph:
 * - Direct dependency: 1.0
 * - 1-hop transitive: 0.6
 * - Same directory: 0.4
 * - Same logical section: 0.3
 * - README/docs: 0.2
 */

import path from "path";
import type { AnalysisManifest, ModuleInfo } from "./types.js";
import { LOGICAL_SECTIONS, estimateTokens } from "../generators/utils.js";

export interface ContextChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  relevanceScore: number;
  kind: "full-file" | "symbol-def" | "import-chain" | "readme-section";
}

export interface BuildContextOptions {
  /** Target module to build context around */
  targetModule?: ModuleInfo;
  /** Topic string (used when no specific module target) */
  topic?: string;
  /** Maximum token budget (estimated as content.length / 4) */
  tokenBudget: number;
  /** The full analysis manifest */
  manifest: AnalysisManifest;
  /** Function to read file contents */
  readFile: (filePath: string) => Promise<string>;
}

function detectSection(filePath: string): string {
  const parts = filePath.toLowerCase().split("/");
  for (const [section, keywords] of Object.entries(LOGICAL_SECTIONS)) {
    for (const part of parts) {
      if (keywords.includes(part)) return section;
    }
  }
  return "";
}

/**
 * Build a ranked set of context chunks for an LLM call,
 * fitting within a token budget.
 */
export async function buildContext(options: BuildContextOptions): Promise<ContextChunk[]> {
  const { targetModule, topic, tokenBudget, manifest, readFile } = options;
  const { dependencyGraph, modules } = manifest;

  const scored: Array<{ module: ModuleInfo; score: number }> = [];

  if (targetModule) {
    const targetPath = targetModule.filePath;
    const targetDir = path.dirname(targetPath);
    const targetSection = detectSection(targetPath);

    // Score every other module by relevance to the target
    const directDeps = new Set<string>();
    const directDependents = new Set<string>();

    for (const edge of dependencyGraph.edges) {
      if (edge.from === targetPath) directDeps.add(edge.to);
      if (edge.to === targetPath) directDependents.add(edge.from);
    }

    // 1-hop transitive dependencies
    const transitiveSet = new Set<string>();
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

      // Direct dependency: 1.0
      if (directDeps.has(mod.filePath) || directDependents.has(mod.filePath)) {
        score = 1.0;
      }
      // 1-hop transitive: 0.6
      else if (transitiveSet.has(mod.filePath)) {
        score = 0.6;
      }
      // Same directory: 0.4
      else if (path.dirname(mod.filePath) === targetDir) {
        score = 0.4;
      }
      // Same logical section: 0.3
      else if (targetSection && detectSection(mod.filePath) === targetSection) {
        score = 0.3;
      }
      // README/docs: 0.2
      else if (mod.filePath.toLowerCase().includes("readme") || mod.filePath.toLowerCase().includes("doc")) {
        score = 0.2;
      }

      if (score > 0) {
        scored.push({ module: mod, score });
      }
    }
  } else if (topic) {
    // Score by topic keyword match in file path and symbol names
    const topicLower = topic.toLowerCase();
    const topicWords = topicLower.split(/\s+/);

    for (const mod of modules) {
      let score = 0;
      const pathLower = mod.filePath.toLowerCase();

      // Check file path for topic keywords
      for (const word of topicWords) {
        if (pathLower.includes(word)) {
          score = Math.max(score, 0.8);
        }
      }

      // Check symbol names
      for (const sym of mod.symbols) {
        const nameLower = sym.name.toLowerCase();
        for (const word of topicWords) {
          if (nameLower.includes(word)) {
            score = Math.max(score, 0.7);
          }
        }
      }

      // README/docs always relevant for topic-based context
      if (pathLower.includes("readme")) {
        score = Math.max(score, 0.5);
      }

      if (score > 0) {
        scored.push({ module: mod, score });
      }
    }
  } else {
    // No target or topic — use most-connected modules
    const connectionCounts = new Map<string, number>();
    for (const edge of dependencyGraph.edges) {
      connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
      connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
    }

    for (const mod of modules) {
      const connections = connectionCounts.get(mod.filePath) ?? 0;
      const score = Math.min(connections / 10, 1.0);
      if (score > 0) {
        scored.push({ module: mod, score });
      }
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Build chunks within token budget
  const chunks: ContextChunk[] = [];
  let usedTokens = 0;

  // Always include the target module first
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
          relevanceScore: 1.0,
          kind: "full-file",
        });
        usedTokens += tokens;
      } else {
        // Truncate to fit within 40% of budget
        const lines = content.split("\n");
        const maxLines = Math.floor((tokenBudget * 0.4) / (estimateTokens(content) / lines.length));
        const truncated = lines.slice(0, maxLines).join("\n");
        chunks.push({
          filePath: targetModule.filePath,
          startLine: 1,
          endLine: maxLines,
          content: truncated,
          relevanceScore: 1.0,
          kind: "full-file",
        });
        usedTokens += estimateTokens(truncated);
      }
    } catch {
      // File read failure — continue without it
    }
  }

  // Add ranked context chunks
  for (const { module: mod, score } of scored) {
    if (usedTokens >= tokenBudget) break;

    try {
      const content = await readFile(mod.filePath);
      const tokens = estimateTokens(content);
      const remaining = tokenBudget - usedTokens;

      if (tokens <= remaining) {
        // Include full file
        chunks.push({
          filePath: mod.filePath,
          startLine: 1,
          endLine: content.split("\n").length,
          content,
          relevanceScore: score,
          kind: "full-file",
        });
        usedTokens += tokens;
      } else if (remaining > 100) {
        // Include truncated version
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
            kind: "full-file",
          });
          usedTokens += estimateTokens(truncated);
        }
      }
    } catch {
      // File read failure — skip
    }
  }

  return chunks;
}
