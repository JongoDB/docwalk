/**
 * DocWalk Analysis Engine
 *
 * Orchestrates the multi-pass analysis pipeline:
 * 1. File discovery (glob matching)
 * 2. Language detection
 * 3. AST parsing via tree-sitter
 * 4. Symbol extraction
 * 5. Cross-file dependency resolution
 * 6. Optional AI summarization
 * 7. Manifest generation
 */

import type { AnalysisConfig, SourceConfig } from "../config/schema.js";
import type {
  AnalysisManifest,
  ModuleInfo,
  DependencyGraph,
  DependencyEdge,
  ProjectMeta,
  AnalysisStats,
  SymbolKind,
} from "./types.js";
import { detectLanguage, type LanguageId } from "./language-detect.js";
import { getParser, type ParserResult } from "./parsers/index.js";
import { discoverFiles } from "./file-discovery.js";
import { computeFileHash } from "../utils/hash.js";
import { readFile, stat } from "fs/promises";
import path from "path";

export interface AnalysisOptions {
  source: SourceConfig;
  analysis: AnalysisConfig;
  repoRoot: string;
  commitSha: string;

  /** If provided, only analyze these files (for incremental sync) */
  targetFiles?: string[];

  /** Previous manifest for incremental merge */
  previousManifest?: AnalysisManifest;

  /** Progress callback */
  onProgress?: (current: number, total: number, file: string) => void;
}

export async function analyzeCodebase(
  options: AnalysisOptions
): Promise<AnalysisManifest> {
  const startTime = Date.now();
  const {
    source,
    analysis,
    repoRoot,
    commitSha,
    targetFiles,
    previousManifest,
    onProgress,
  } = options;

  // ── Step 1: File Discovery ──────────────────────────────────────────────
  const files = targetFiles ?? (await discoverFiles(repoRoot, source));

  // ── Step 2-4: Parse and Extract per file ────────────────────────────────
  const modules: ModuleInfo[] = [];
  let skippedFiles = 0;

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const absolutePath = path.resolve(repoRoot, filePath);

    onProgress?.(i + 1, files.length, filePath);

    try {
      // Check file size limit
      const fileStat = await stat(absolutePath);
      if (fileStat.size > analysis.max_file_size) {
        skippedFiles++;
        continue;
      }

      // Read file content
      const content = await readFile(absolutePath, "utf-8");

      // Detect language
      const language = detectLanguage(filePath);
      if (!language) {
        skippedFiles++;
        continue;
      }

      // Get the appropriate parser
      const parser = getParser(language);
      if (!parser) {
        skippedFiles++;
        continue;
      }

      // Parse and extract symbols
      const parseResult: ParserResult = await parser.parse(content, filePath);

      // Build module info
      const moduleInfo: ModuleInfo = {
        filePath,
        language,
        symbols: parseResult.symbols,
        imports: parseResult.imports,
        exports: parseResult.exports,
        moduleDoc: parseResult.moduleDoc,
        fileSize: fileStat.size,
        lineCount: content.split("\n").length,
        contentHash: computeFileHash(content),
        analyzedAt: new Date().toISOString(),
      };

      modules.push(moduleInfo);
    } catch (error) {
      // Log but don't fail — skip unparseable files
      skippedFiles++;
    }
  }

  // ── Step 5: Merge with previous manifest (incremental) ─────────────────
  const allModules = mergeModules(modules, previousManifest, targetFiles);

  // ── Step 6: Cross-file dependency resolution ───────────────────────────
  const dependencyGraph = buildDependencyGraph(allModules);

  // ── Step 7: Compute project metadata and stats ─────────────────────────
  const projectMeta = computeProjectMeta(allModules, repoRoot, source);
  const stats = computeStats(allModules, skippedFiles, startTime);

  const manifest: AnalysisManifest = {
    docwalkVersion: "0.1.0",
    repo: source.repo,
    branch: source.branch,
    commitSha,
    analyzedAt: new Date().toISOString(),
    modules: allModules,
    dependencyGraph,
    projectMeta,
    stats,
  };

  return manifest;
}

/**
 * For incremental sync: merge newly analyzed modules with the
 * previous manifest, replacing only the re-analyzed files.
 */
function mergeModules(
  newModules: ModuleInfo[],
  previousManifest?: AnalysisManifest,
  targetFiles?: string[]
): ModuleInfo[] {
  if (!previousManifest || !targetFiles) {
    return newModules;
  }

  // Start with previous modules, excluding any that were re-analyzed or deleted
  const newFilePaths = new Set(newModules.map((m) => m.filePath));
  const targetSet = new Set(targetFiles);

  const preserved = previousManifest.modules.filter(
    (m) => !targetSet.has(m.filePath)
  );

  return [...preserved, ...newModules];
}

/**
 * Build cross-file dependency graph from import/export analysis.
 */
function buildDependencyGraph(modules: ModuleInfo[]): DependencyGraph {
  const nodes = modules.map((m) => m.filePath);
  const edges: DependencyEdge[] = [];

  // Map of export names to file paths for resolution
  const exportMap = new Map<string, string>();
  for (const mod of modules) {
    for (const exp of mod.exports) {
      exportMap.set(`${mod.filePath}:${exp.name}`, mod.filePath);
    }
  }

  for (const mod of modules) {
    for (const imp of mod.imports) {
      // Resolve the import source to a file in our module list
      const resolvedTarget = resolveImportSource(
        imp.source,
        mod.filePath,
        nodes
      );
      if (resolvedTarget) {
        edges.push({
          from: mod.filePath,
          to: resolvedTarget,
          imports: imp.specifiers.map((s) => s.name),
          isTypeOnly: imp.isTypeOnly,
        });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Resolve a relative import path to a file in the module list.
 * Handles common patterns: ./foo, ../bar, @/utils, etc.
 */
function resolveImportSource(
  source: string,
  fromFile: string,
  knownFiles: string[]
): string | undefined {
  if (!source.startsWith(".") && !source.startsWith("@/")) {
    return undefined; // external package — skip
  }

  const dir = path.dirname(fromFile);
  let resolved = source.startsWith("@/")
    ? source.replace("@/", "src/")
    : path.join(dir, source);

  // Strip .js/.mjs/.cjs extension for TS → JS extension mapping
  const strippedExt = resolved.replace(/\.(m|c)?js$/, "");

  // Try common extensions
  const candidates = [
    resolved,
    strippedExt,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`,
    `${resolved}.jsx`,
    `${strippedExt}.ts`,
    `${strippedExt}.tsx`,
    `${strippedExt}.js`,
    `${strippedExt}.jsx`,
    `${resolved}/index.ts`,
    `${resolved}/index.tsx`,
    `${resolved}/index.js`,
    `${resolved}/index.jsx`,
    `${strippedExt}/index.ts`,
    `${strippedExt}/index.tsx`,
    `${strippedExt}/index.js`,
    `${strippedExt}/index.jsx`,
  ].map((c) => path.normalize(c));

  return knownFiles.find((f) => candidates.includes(path.normalize(f)));
}

function computeProjectMeta(
  modules: ModuleInfo[],
  repoRoot: string,
  source: SourceConfig
): ProjectMeta {
  const langCounts: Record<string, number> = {};
  for (const mod of modules) {
    langCounts[mod.language] = (langCounts[mod.language] || 0) + 1;
  }

  const totalFiles = modules.length;
  const languages = Object.entries(langCounts)
    .map(([name, fileCount]) => ({
      name,
      fileCount,
      percentage: Math.round((fileCount / totalFiles) * 100),
    }))
    .sort((a, b) => b.fileCount - a.fileCount);

  const entryPoints = modules
    .filter(
      (m) =>
        m.filePath.includes("index.") ||
        m.filePath.includes("main.") ||
        m.filePath.includes("app.")
    )
    .map((m) => m.filePath);

  return {
    name: source.repo.split("/").pop() || source.repo,
    languages,
    entryPoints,
    repository: source.repo,
  };
}

function computeStats(
  modules: ModuleInfo[],
  skippedFiles: number,
  startTime: number
): AnalysisStats {
  const byLanguage: Record<
    string,
    { files: number; symbols: number; lines: number }
  > = {};
  const byKind: Record<string, number> = {};
  let totalSymbols = 0;
  let totalLines = 0;

  for (const mod of modules) {
    // By language
    if (!byLanguage[mod.language]) {
      byLanguage[mod.language] = { files: 0, symbols: 0, lines: 0 };
    }
    byLanguage[mod.language].files++;
    byLanguage[mod.language].symbols += mod.symbols.length;
    byLanguage[mod.language].lines += mod.lineCount;

    // By kind
    for (const sym of mod.symbols) {
      byKind[sym.kind] = (byKind[sym.kind] || 0) + 1;
      totalSymbols++;
    }

    totalLines += mod.lineCount;
  }

  return {
    totalFiles: modules.length,
    totalSymbols,
    totalLines,
    byLanguage,
    byKind: byKind as Record<SymbolKind, number>,
    analysisTime: Date.now() - startTime,
    skippedFiles,
  };
}
