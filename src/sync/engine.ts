/**
 * DocWalk Sync Engine
 *
 * Implements the git-diff based incremental sync strategy.
 * Compares current HEAD against the last indexed commit SHA,
 * identifies changed files, runs targeted re-analysis, and
 * triggers incremental doc rebuild + deploy.
 */

import simpleGit, { type SimpleGit } from "simple-git";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import type { SyncConfig, SourceConfig, AnalysisConfig } from "../config/schema.js";
import type {
  FileDiff,
  DiffStatus,
  SyncState,
  SyncResult,
  AnalysisManifest,
} from "../analysis/types.js";
import { analyzeCodebase } from "../analysis/engine.js";

export interface SyncOptions {
  repoRoot: string;
  source: SourceConfig;
  analysis: AnalysisConfig;
  sync: SyncConfig;
  dryRun?: boolean;
  onProgress?: (message: string) => void;
}

/**
 * Run an incremental sync: diff → re-analyze → rebuild → deploy.
 */
export async function runSync(options: SyncOptions): Promise<SyncResult> {
  const { repoRoot, source, analysis, sync, dryRun, onProgress } = options;
  const startTime = Date.now();

  const git: SimpleGit = simpleGit(repoRoot);

  // ── 1. Get current HEAD commit ──────────────────────────────────────────
  const currentCommit = await git.revparse(["HEAD"]);
  onProgress?.(`Current commit: ${currentCommit.slice(0, 8)}`);

  // ── 2. Load previous sync state ────────────────────────────────────────
  const statePath = path.resolve(repoRoot, sync.state_file);
  const previousState = await loadSyncState(statePath);

  if (!previousState) {
    onProgress?.("No previous sync state found — performing full analysis");
    const manifest = await analyzeCodebase({
      source,
      analysis,
      repoRoot,
      commitSha: currentCommit,
      onProgress: (cur, total, file) =>
        onProgress?.(`Analyzing [${cur}/${total}] ${file}`),
    });

    await saveSyncState(statePath, {
      lastCommitSha: currentCommit,
      lastSyncedAt: new Date().toISOString(),
      manifestPath: path.resolve(repoRoot, ".docwalk/manifest.json"),
      totalPages: manifest.modules.length,
    });

    await saveManifest(
      path.resolve(repoRoot, ".docwalk/manifest.json"),
      manifest
    );

    return {
      diffs: [],
      modulesReanalyzed: manifest.modules.length,
      pagesRebuilt: manifest.modules.length,
      pagesCreated: manifest.modules.length,
      pagesDeleted: 0,
      impactedModules: [],
      duration: Date.now() - startTime,
      previousCommit: "none",
      currentCommit,
    };
  }

  // ── 3. Compute git diff ────────────────────────────────────────────────
  onProgress?.(
    `Diffing ${previousState.lastCommitSha.slice(0, 8)}..${currentCommit.slice(0, 8)}`
  );

  const diffs = await computeDiff(
    git,
    previousState.lastCommitSha,
    currentCommit
  );

  if (diffs.length === 0) {
    onProgress?.("No changes detected — skipping sync");
    return {
      diffs: [],
      modulesReanalyzed: 0,
      pagesRebuilt: 0,
      pagesCreated: 0,
      pagesDeleted: 0,
      impactedModules: [],
      duration: Date.now() - startTime,
      previousCommit: previousState.lastCommitSha,
      currentCommit,
    };
  }

  onProgress?.(`Found ${diffs.length} changed files`);

  if (dryRun) {
    return {
      diffs,
      modulesReanalyzed: 0,
      pagesRebuilt: 0,
      pagesCreated: 0,
      pagesDeleted: 0,
      impactedModules: [],
      duration: Date.now() - startTime,
      previousCommit: previousState.lastCommitSha,
      currentCommit,
    };
  }

  // ── 4. Load previous manifest ──────────────────────────────────────────
  const previousManifest = await loadManifest(previousState.manifestPath);

  // ── 5. Determine files to re-analyze ───────────────────────────────────
  const filesToAnalyze = diffs
    .filter((d) => d.status !== "deleted")
    .map((d) => d.path);

  const deletedFiles = diffs
    .filter((d) => d.status === "deleted")
    .map((d) => d.path);

  // ── 6. Cross-file impact analysis ──────────────────────────────────────
  let impactedModules: string[] = [];
  if (sync.impact_analysis && previousManifest) {
    impactedModules = findImpactedModules(
      diffs,
      previousManifest
    );
    onProgress?.(
      `Impact analysis: ${impactedModules.length} downstream modules affected`
    );

    // Add impacted modules that aren't already in the re-analyze set
    const analyzeSet = new Set(filesToAnalyze);
    for (const impacted of impactedModules) {
      if (!analyzeSet.has(impacted)) {
        filesToAnalyze.push(impacted);
        analyzeSet.add(impacted);
      }
    }
  }

  // ── 7. Incremental re-analysis ─────────────────────────────────────────
  onProgress?.(`Re-analyzing ${filesToAnalyze.length} files...`);

  const manifest = await analyzeCodebase({
    source,
    analysis,
    repoRoot,
    commitSha: currentCommit,
    targetFiles: filesToAnalyze,
    previousManifest,
    onProgress: (cur, total, file) =>
      onProgress?.(`Analyzing [${cur}/${total}] ${file}`),
  });

  // Remove deleted modules from the manifest
  manifest.modules = manifest.modules.filter(
    (m) => !deletedFiles.includes(m.filePath)
  );

  // ── 8. Save updated state and manifest ─────────────────────────────────
  await saveSyncState(statePath, {
    lastCommitSha: currentCommit,
    lastSyncedAt: new Date().toISOString(),
    manifestPath: previousState.manifestPath,
    totalPages: manifest.modules.length,
  });

  await saveManifest(previousState.manifestPath, manifest);

  const pagesCreated = diffs.filter((d) => d.status === "added").length;
  const pagesDeleted = deletedFiles.length;

  return {
    diffs,
    modulesReanalyzed: filesToAnalyze.length,
    pagesRebuilt: filesToAnalyze.length,
    pagesCreated,
    pagesDeleted,
    impactedModules,
    duration: Date.now() - startTime,
    previousCommit: previousState.lastCommitSha,
    currentCommit,
  };
}

// ─── Git Diff Computation ───────────────────────────────────────────────────

async function computeDiff(
  git: SimpleGit,
  fromCommit: string,
  toCommit: string
): Promise<FileDiff[]> {
  const diffResult = await git.diff([
    "--name-status",
    fromCommit,
    toCommit,
  ]);

  const diffs: FileDiff[] = [];

  for (const line of diffResult.split("\n")) {
    if (!line.trim()) continue;

    const parts = line.split("\t");
    const statusCode = parts[0];

    if (statusCode.startsWith("R")) {
      // Rename: R100\told-name\tnew-name
      diffs.push({
        path: parts[2],
        oldPath: parts[1],
        status: "renamed",
      });
    } else if (statusCode === "A") {
      diffs.push({ path: parts[1], status: "added" });
    } else if (statusCode === "M") {
      diffs.push({ path: parts[1], status: "modified" });
    } else if (statusCode === "D") {
      diffs.push({ path: parts[1], status: "deleted" });
    }
  }

  return diffs;
}

// ─── Cross-file Impact Analysis ─────────────────────────────────────────────

/**
 * Find modules that are impacted by the changed files.
 * A module is "impacted" if it imports from a changed file.
 */
function findImpactedModules(
  diffs: FileDiff[],
  manifest: AnalysisManifest
): string[] {
  const changedPaths = new Set(diffs.map((d) => d.path));
  const impacted = new Set<string>();

  for (const edge of manifest.dependencyGraph.edges) {
    if (changedPaths.has(edge.to) && !changedPaths.has(edge.from)) {
      impacted.add(edge.from);
    }
  }

  return [...impacted];
}

// ─── State Persistence ──────────────────────────────────────────────────────

async function loadSyncState(
  statePath: string
): Promise<SyncState | null> {
  try {
    const content = await readFile(statePath, "utf-8");
    return JSON.parse(content) as SyncState;
  } catch {
    return null;
  }
}

async function saveSyncState(
  statePath: string,
  state: SyncState
): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2));
}

async function loadManifest(
  manifestPath: string
): Promise<AnalysisManifest | undefined> {
  try {
    const content = await readFile(manifestPath, "utf-8");
    return JSON.parse(content) as AnalysisManifest;
  } catch {
    return undefined;
  }
}

async function saveManifest(
  manifestPath: string,
  manifest: AnalysisManifest
): Promise<void> {
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}
