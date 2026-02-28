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

import type { AnalysisConfig, SourceConfig, HooksConfig } from "../config/schema.js";
import { executeHooks } from "../utils/hooks.js";
import type {
  AnalysisManifest,
  ModuleInfo,
  DependencyGraph,
  DependencyEdge,
  ProjectMeta,
  AnalysisStats,
  SymbolKind,
} from "./types.js";
import type { SummaryCacheEntry } from "./ai-summarizer.js";
import { detectLanguage, getSupportedExtensions, type LanguageId } from "./language-detect.js";
import { getParser, type ParserResult } from "./parsers/index.js";
import { discoverFiles } from "./file-discovery.js";
import { computeFileHash } from "../utils/hash.js";
import { log } from "../utils/logger.js";
import { readFile, stat } from "fs/promises";
import path from "path";
import fg from "fast-glob";
import { detectWorkspaces, type WorkspaceInfo } from "./workspace-resolver.js";

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

  /** Previous AI summary cache for reuse */
  previousSummaryCache?: SummaryCacheEntry[];

  /** AI summarization progress callback */
  onAIProgress?: (current: number, total: number, message: string) => void;

  /** Hooks configuration for pre/post analyze */
  hooks?: HooksConfig;
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
    previousSummaryCache,
    onAIProgress,
    hooks,
  } = options;

  // ── Pre-analyze hooks ───────────────────────────────────────────────────
  await executeHooks("pre_analyze", hooks, { cwd: repoRoot });

  // ── Step 1: File Discovery ──────────────────────────────────────────────
  const files = targetFiles ?? (await discoverFiles(repoRoot, source));

  // ── Step 1b: Workspace detection (monorepo) ───────────────────────────
  let workspaceInfo: WorkspaceInfo | undefined;
  if (analysis.monorepo !== false) {
    try {
      workspaceInfo = await detectWorkspaces(repoRoot);
      if (workspaceInfo.type !== "none") {
        log("info", `Detected ${workspaceInfo.type} workspace with ${workspaceInfo.packages.size} packages`);
      }
    } catch {
      // Workspace detection failure is non-fatal
    }
  }

  // ── Guard: No files found ───────────────────────────────────────────────
  if (files.length === 0) {
    log("warn", "No source files found matching include patterns. Check your docwalk.config.yml include/exclude settings.");
    log("info", `Supported extensions: ${getSupportedExtensions().join(", ")}`);

    // List top files by extension in the repo for diagnostic help
    try {
      const allFiles = await fg("**/*", {
        cwd: repoRoot,
        ignore: [".git/**", "node_modules/**"],
        dot: false,
        onlyFiles: true,
        deep: 3,
      });
      const extCounts: Record<string, number> = {};
      for (const f of allFiles) {
        const ext = path.extname(f) || "(no extension)";
        extCounts[ext] = (extCounts[ext] || 0) + 1;
      }
      const topExts = Object.entries(extCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ext, count]) => `${ext} (${count})`)
        .join(", ");
      log("info", `Detected files in repo: ${topExts}`);
    } catch {
      // Ignore diagnostic errors
    }
  }

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
        log("debug", `Skipped ${filePath}: exceeds ${analysis.max_file_size} byte limit (${fileStat.size} bytes)`);
        skippedFiles++;
        continue;
      }

      // Read file content
      const content = await readFile(absolutePath, "utf-8");

      // Detect language
      const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
      const language = detectLanguage(filePath);
      if (!language) {
        log("debug", `Skipped ${filePath}: unrecognized language for extension ${ext}`);
        skippedFiles++;
        continue;
      }

      // Get the appropriate parser
      const parser = getParser(language);
      if (!parser) {
        log("debug", `Skipped ${filePath}: no parser for ${language}`);
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
      const errMsg = error instanceof Error ? error.message : String(error);
      log("debug", `Skipped ${filePath}: parse error — ${errMsg}`);
      skippedFiles++;
    }
  }

  // ── Guard: All files skipped ────────────────────────────────────────────
  if (modules.length === 0 && files.length > 0) {
    log("warn", `Found ${files.length} files but all were skipped during parsing. Run with -v to see skip reasons.`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  log("info", `Analyzed ${modules.length} files, skipped ${skippedFiles} (run with -v for details)`);

  // ── Step 5: Merge with previous manifest (incremental) ─────────────────
  const allModules = mergeModules(modules, previousManifest, targetFiles);

  // ── Step 6: Cross-file dependency resolution ───────────────────────────
  const dependencyGraph = buildDependencyGraph(allModules, workspaceInfo);

  // ── Step 7: Optional AI summarization ─────────────────────────────────
  let finalModules = allModules;
  let summaryCache: SummaryCacheEntry[] = previousSummaryCache || [];

  if (analysis.ai_summaries && analysis.ai_provider) {
    const { summarizeModules } = await import("./ai-summarizer.js");
    const result = await summarizeModules({
      providerConfig: analysis.ai_provider,
      modules: allModules,
      readFile: async (filePath) => {
        const absolutePath = path.resolve(repoRoot, filePath);
        return readFile(absolutePath, "utf-8");
      },
      previousCache: previousSummaryCache,
      onProgress: onAIProgress,
    });

    finalModules = result.modules;
    summaryCache = result.cache;
  }

  // ── Step 8: Compute project metadata and stats ─────────────────────────
  log("info", "Building dependency graph and computing stats...");
  const projectMeta = computeProjectMeta(finalModules, repoRoot, source);
  const stats = computeStats(finalModules, skippedFiles, startTime);

  // ── Step 9: Static code insights ─────────────────────────────────────
  log("info", "Running static code analysis...");
  let insights: import("./types.js").Insight[] | undefined;
  try {
    const { runStaticInsights } = await import("./insights.js");
    const tempManifest = {
      modules: finalModules,
      dependencyGraph,
      projectMeta,
    } as import("./types.js").AnalysisManifest;
    insights = runStaticInsights(tempManifest);
    if (insights?.length) {
      log("info", `Found ${insights.length} code insights`);
    }
  } catch {
    // Insights module not available — skip
  }

  // ── Step 9b: AI-enhanced insights ──────────────────────────────────
  if (insights?.length && analysis.insights_ai && analysis.ai_provider) {
    try {
      const { createProvider } = await import("./providers/index.js");
      const { enhanceInsightsWithAI } = await import("./ai-insights.js");
      const provider = createProvider(analysis.ai_provider);
      if (provider) {
        insights = await enhanceInsightsWithAI({
          insights,
          aiProvider: provider,
          readFile: async (filePath) => {
            const absolutePath = path.resolve(repoRoot, filePath);
            return readFile(absolutePath, "utf-8");
          },
          onProgress: onAIProgress
            ? (current, total, message) => onAIProgress(current, total, message)
            : undefined,
        });
      }
    } catch {
      // AI insights enhancement is non-fatal
    }
  }

  const manifest: AnalysisManifest = {
    docwalkVersion: "0.1.0",
    repo: source.repo,
    branch: source.branch,
    commitSha,
    analyzedAt: new Date().toISOString(),
    modules: finalModules,
    dependencyGraph,
    projectMeta,
    stats,
    summaryCache,
    insights,
  };

  // ── Post-analyze hooks ──────────────────────────────────────────────────
  await executeHooks("post_analyze", hooks, { cwd: repoRoot });

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
function buildDependencyGraph(modules: ModuleInfo[], workspaceInfo?: WorkspaceInfo): DependencyGraph {
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
        nodes,
        workspaceInfo
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
 * Resolve an import path to a file in the module list.
 * Resolution order: relative imports → workspace packages → return undefined (external).
 */
function resolveImportSource(
  source: string,
  fromFile: string,
  knownFiles: string[],
  workspaceInfo?: WorkspaceInfo
): string | undefined {
  // 1. Relative imports (existing behavior)
  if (source.startsWith(".") || source.startsWith("@/")) {
    const dir = path.dirname(fromFile);
    let resolved = source.startsWith("@/")
      ? source.replace("@/", "src/")
      : path.join(dir, source);

    // Strip .js/.mjs/.cjs extension for TS → JS extension mapping
    const strippedExt = resolved.replace(/\.(m|c)?js$/, "");

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

  // 2. Workspace package resolution (new)
  if (workspaceInfo && workspaceInfo.packages.size > 0) {
    // Check if the import matches a workspace package name
    // e.g., "@org/utils" or "@org/utils/deep-import"
    for (const [pkgName, pkgDir] of workspaceInfo.packages) {
      if (source === pkgName || source.startsWith(`${pkgName}/`)) {
        // Resolve to the package's entry point or subpath
        const subpath = source === pkgName
          ? ""
          : source.slice(pkgName.length + 1);

        const basePath = subpath
          ? `${pkgDir}/src/${subpath}`
          : pkgDir;

        // Try entry points within the workspace package
        const candidates = subpath
          ? [
              `${basePath}.ts`,
              `${basePath}.tsx`,
              `${basePath}.js`,
              `${basePath}.jsx`,
              `${basePath}/index.ts`,
              `${basePath}/index.tsx`,
              `${basePath}/index.js`,
              `${basePath}/index.jsx`,
            ]
          : [
              `${pkgDir}/src/index.ts`,
              `${pkgDir}/src/index.tsx`,
              `${pkgDir}/src/index.js`,
              `${pkgDir}/src/index.jsx`,
              `${pkgDir}/index.ts`,
              `${pkgDir}/index.tsx`,
              `${pkgDir}/index.js`,
              `${pkgDir}/index.jsx`,
              `${pkgDir}/lib/index.ts`,
              `${pkgDir}/lib/index.js`,
            ];

        const match = knownFiles.find((f) =>
          candidates.some((c) => path.normalize(f) === path.normalize(c))
        );
        if (match) return match;
      }
    }
  }

  // 3. External package — skip
  return undefined;
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

  const rawName = source.repo.split("/").pop() || source.repo;
  // If repo is "." (local), resolve to the directory basename
  const name = rawName === "." ? path.basename(repoRoot) : rawName;

  // Try to find a README and extract its summary for use as project description
  let readmeDescription: string | undefined;
  const readmeMod = modules.find(
    (m) => path.basename(m.filePath).toLowerCase() === "readme.md"
  );
  if (readmeMod?.moduleDoc?.summary) {
    readmeDescription = readmeMod.moduleDoc.summary;
  }

  return {
    name,
    readmeDescription,
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
