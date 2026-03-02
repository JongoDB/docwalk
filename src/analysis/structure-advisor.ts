/**
 * Structure Advisor
 *
 * AI-driven page structure suggestions. Analyzes the repo manifest
 * and suggests which pages to generate and how to organize navigation.
 * Falls back to the fixed page list when AI is unavailable.
 *
 * When an AIProvider is available, sends the file tree, README, and
 * module summaries to the LLM and parses an XML wiki structure back
 * — similar to DeepWiki's approach where the model decides what pages
 * to create, which files belong to each page, importance levels, and
 * cross-page relationships.
 */

import type { AIProvider } from "./providers/base.js";
import type { AnalysisManifest } from "./types.js";
import { detectLogicalSection, LOGICAL_SECTIONS } from "../generators/utils.js";

export interface PageSuggestion {
  /** Unique page identifier */
  id: string;
  /** Human-readable title */
  title: string;
  /** Description of what this page should cover */
  description: string;
  /** Navigation group */
  navGroup: string;
  /** Navigation order */
  navOrder: number;
  /** Which modules (file paths) this page should cover */
  relatedModules: string[];
  /** Importance level for ordering and display */
  importance: "high" | "medium" | "low";
  /** IDs of related pages for cross-linking */
  relatedPages: string[];
}

export interface SectionSuggestion {
  /** Unique section identifier */
  id: string;
  /** Human-readable section title */
  title: string;
  /** Page IDs belonging to this section */
  pages: string[];
}

export interface StructurePlan {
  /** Suggested conceptual pages beyond the default set */
  conceptPages: PageSuggestion[];
  /** Suggested navigation sections grouping pages */
  sections: SectionSuggestion[];
  /** Whether to use audience separation */
  audienceSplit: boolean;
  /** Suggested navigation groups */
  navGroups: string[];
  /** Whether this is a comprehensive (8-12 page) plan vs compact (4-6) */
  isComprehensive: boolean;
}

// ─── LLM-driven structure analysis ─────────────────────────────────────────

/**
 * Build a flat file tree string from the manifest modules.
 */
function buildFileTree(manifest: AnalysisManifest): string {
  return manifest.modules
    .map((m) => m.filePath)
    .sort()
    .join("\n");
}

/**
 * Find README content from the manifest modules.
 * Looks for any module whose path contains "readme" (case-insensitive)
 * and returns its AI summary or module doc summary.
 */
function findReadmeContent(manifest: AnalysisManifest): string | undefined {
  // Check projectMeta first
  if (manifest.projectMeta.readmeDescription) {
    return manifest.projectMeta.readmeDescription;
  }

  const readmeModule = manifest.modules.find((m) =>
    m.filePath.toLowerCase().includes("readme")
  );
  if (!readmeModule) return undefined;
  return readmeModule.aiSummary || readmeModule.moduleDoc?.summary;
}

/**
 * Build summaries for the top N most-connected modules.
 * Connection count = number of dependency edges involving the module.
 */
function buildModuleSummaries(manifest: AnalysisManifest, topN: number = 20): string {
  const { dependencyGraph, modules } = manifest;

  // Count connections per file path
  const connectionCount = new Map<string, number>();
  for (const edge of dependencyGraph.edges) {
    connectionCount.set(edge.from, (connectionCount.get(edge.from) || 0) + 1);
    connectionCount.set(edge.to, (connectionCount.get(edge.to) || 0) + 1);
  }

  // Sort modules by connection count descending, take topN
  const ranked = modules
    .map((m) => ({ module: m, connections: connectionCount.get(m.filePath) || 0 }))
    .sort((a, b) => b.connections - a.connections)
    .slice(0, topN);

  return ranked
    .map((r) => {
      const summary = r.module.aiSummary || r.module.moduleDoc?.summary || "(no summary)";
      return `- ${r.module.filePath} (${r.connections} connections): ${summary}`;
    })
    .join("\n");
}

/**
 * Build the LLM prompt for wiki structure generation.
 */
function buildStructurePrompt(
  manifest: AnalysisManifest,
  fileTree: string,
  readmeContent: string | undefined,
  moduleSummaries: string,
  comprehensive: boolean
): string {
  const languages = manifest.projectMeta.languages
    .map((l) => `${l.name} (${l.percentage}%)`)
    .join(", ");

  const pageRange = comprehensive ? "8-12" : "4-6";

  return `Analyze this repository and create a wiki structure.

FILE TREE:
${fileTree}

README:
${readmeContent || "No README found"}

PROJECT: ${manifest.projectMeta.name}
LANGUAGES: ${languages}
FILES: ${manifest.stats.totalFiles}

MODULE SUMMARIES (most connected):
${moduleSummaries}

Create a structured wiki with ${pageRange} pages.
Each page should focus on a specific aspect that would benefit from detailed documentation:
- Architecture overviews
- Data flow descriptions
- Component relationships
- Process workflows
- Key subsystems

Return ONLY valid XML with no markdown code blocks:

<wiki_structure>
  <pages>
    <page id="page-1">
      <title>Page Title</title>
      <description>What this page covers</description>
      <importance>high|medium|low</importance>
      <relevant_files>
        <file_path>src/path/to/file.ts</file_path>
      </relevant_files>
      <related_pages>
        <related>page-2</related>
      </related_pages>
    </page>
  </pages>
</wiki_structure>

RULES:
1. Each page must have at least 3 relevant_files from the file tree
2. Pages should cover distinct aspects — no overlap
3. Include at least one architecture/overview page
4. Every important file should be assigned to at least one page
5. Order pages from most important to least`;
}

/**
 * Parse the LLM's XML response into PageSuggestion objects.
 * Uses regex extraction rather than a full XML parser.
 */
function parseStructureXml(xml: string): PageSuggestion[] {
  // Extract the <wiki_structure>...</wiki_structure> block
  const structureMatch = xml.match(/<wiki_structure>([\s\S]*?)<\/wiki_structure>/);
  if (!structureMatch) return [];

  const structureBody = structureMatch[1];

  // Extract each <page> element
  const pageRegex = /<page\s+id="([^"]*)">([\s\S]*?)<\/page>/g;
  const pages: PageSuggestion[] = [];
  let pageMatch: RegExpExecArray | null;
  let index = 0;

  while ((pageMatch = pageRegex.exec(structureBody)) !== null) {
    const id = pageMatch[1];
    const body = pageMatch[2];

    // Extract individual fields
    const title = body.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || id;
    const description = body.match(/<description>([\s\S]*?)<\/description>/)?.[1]?.trim() || "";
    const importance = body.match(/<importance>([\s\S]*?)<\/importance>/)?.[1]?.trim() as
      | "high"
      | "medium"
      | "low"
      | undefined;

    // Extract file paths
    const filePaths: string[] = [];
    const filePathRegex = /<file_path>([\s\S]*?)<\/file_path>/g;
    let fpMatch: RegExpExecArray | null;
    while ((fpMatch = filePathRegex.exec(body)) !== null) {
      filePaths.push(fpMatch[1].trim());
    }

    // Extract related page IDs
    const relatedPages: string[] = [];
    const relatedRegex = /<related>([\s\S]*?)<\/related>/g;
    let relMatch: RegExpExecArray | null;
    while ((relMatch = relatedRegex.exec(body)) !== null) {
      relatedPages.push(relMatch[1].trim());
    }

    pages.push({
      id,
      title,
      description,
      navGroup: "Concepts",
      navOrder: 20 + index,
      relatedModules: filePaths,
      importance: importance && ["high", "medium", "low"].includes(importance) ? importance : "medium",
      relatedPages,
    });

    index++;
  }

  return pages;
}

// ─── Static fallback (no AI provider) ──────────────────────────────────────

/**
 * Build a structure plan using only static analysis when no AI is available.
 */
function buildStaticPlan(manifest: AnalysisManifest): StructurePlan {
  return {
    conceptPages: [],
    sections: [],
    audienceSplit: false,
    navGroups: [],
    isComprehensive: false,
  };
}

// ─── Main entry point ──────────────────────────────────────────────────────

/**
 * Analyze the manifest and suggest a page structure.
 *
 * When an AIProvider is supplied, sends the file tree, README, and
 * top module summaries to the LLM, which returns an XML wiki structure.
 *
 * When no provider is available (or on LLM/parse failure), falls back
 * to an empty plan so the default page set is used.
 */
export async function analyzeStructure(
  manifest: AnalysisManifest,
  provider?: AIProvider,
  comprehensive?: boolean
): Promise<StructurePlan> {
  if (!provider) {
    return buildStaticPlan(manifest);
  }

  try {
    // 1. Build context for the LLM
    const fileTree = buildFileTree(manifest);
    const readmeContent = findReadmeContent(manifest);
    const moduleSummaries = buildModuleSummaries(manifest, 20);
    const isComprehensive = comprehensive ?? false;

    // 2. Build and send prompt
    const prompt = buildStructurePrompt(
      manifest,
      fileTree,
      readmeContent,
      moduleSummaries,
      isComprehensive
    );

    const response = await provider.generate(prompt, {
      maxTokens: 2048,
      temperature: 0.3,
      systemPrompt:
        "You are a documentation architect. Analyze codebases and return wiki structures as valid XML. Return ONLY XML — no explanation, no markdown code blocks.",
    });

    // 3. Parse the XML response
    const conceptPages = parseStructureXml(response);

    // If parsing produced no pages, fall back to static plan
    if (conceptPages.length === 0) {
      return buildStaticPlan(manifest);
    }

    // 4. Detect audience split (CLI/commands → split into user vs developer docs)
    const audienceSplit = manifest.modules.some(
      (m) => m.filePath.includes("cli/") || m.filePath.includes("commands/")
    );

    // 5. Build sections from navGroups
    const navGroups = [...new Set(conceptPages.map((p) => p.navGroup))];

    const sections: SectionSuggestion[] = navGroups.map((group, i) => ({
      id: `section-${i + 1}`,
      title: group,
      pages: conceptPages.filter((p) => p.navGroup === group).map((p) => p.id),
    }));

    return {
      conceptPages,
      sections,
      audienceSplit,
      navGroups,
      isComprehensive,
    };
  } catch {
    // AI failure — return empty plan so default pages are used
    return buildStaticPlan(manifest);
  }
}
