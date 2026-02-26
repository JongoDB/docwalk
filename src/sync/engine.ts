/**
 * DocWalk Sync Engine
 *
 * Implements the git-diff based incremental sync strategy.
 * Compares current HEAD against the last indexed commit SHA,
 * identifies changed files, runs targeted re-analysis, and
 * triggers incremental doc rebuild + deploy.
 *
 * Hardened to handle: corrupt state files, force pushes where the
 * previous commit no longer exists, file renames, recursive impact
 * analysis, and manual commit range diffing via --since.
 */

import simpleGit, { type SimpleGit } from "simple-git";
import { readFile, writeFile, mkdir, access } from "fs/promises";
import path from "path";
import type { SyncConfig, SourceConfig, AnalysisConfig } from "../config/schema.js";
import type {
  FileDiff,
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
  /** Override the starting commit for diffing (--since flag). */
  since?: string;
  onProgress?: (message: string) => void;
}

/**
 * Run an incremental sync: diff -> re-analyze -> rebuild -> deploy.
 *
 * @param options - Sync configuration and callbacks
 * @returns Result with diff stats, pages affected, and timing
 */
export async function runSync(options: SyncOptions): Promise<SyncResult> {
  const { repoRoot, source, analysis, sync, dryRun, since, onProgress } = options;
  const startTime = Date.now();

  const git: SimpleGit = simpleGit(repoRoot);

  // ── 1. Get current HEAD commit ──────────────────────────────────────────
  const currentCommit = (await git.revparse(["HEAD"])).trim();
  onProgress?.(`Current commit: ${currentCommit.slice(0, 8)}`);

  // ── 2. Load previous sync state (with corruption handling) ──────────────
  const statePath = path.resolve(repoRoot, sync.state_file);
  const manifestPath = path.resolve(repoRoot, ".docwalk/manifest.json");
  const previousState = await loadSyncState(statePath);

  // If --since is provided, override the starting commit
  const fromCommit = since ?? previousState?.lastCommitSha;

  // Determine if we need a full re-analysis
  const needsFullAnalysis = !fromCommit || (previousState && !(await isManifestValid(previousState.manifestPath)));

  if (needsFullAnalysis) {
    const reason = !fromCommit
      ? "No previous sync state found"
      : "Manifest file is missing or corrupt";
    onProgress?.(`${reason} — performing full analysis`);

    return performFullAnalysis({
      source,
      analysis,
      repoRoot,
      currentCommit,
      statePath,
      manifestPath,
      startTime,
      onProgress,
    });
  }

  // ── 3. Verify the from-commit exists in history ─────────────────────────
  const fromCommitValid = await isCommitReachable(git, fromCommit!);
  if (!fromCommitValid) {
    onProgress?.(
      `Previous commit ${fromCommit!.slice(0, 8)} not found in history (force push or rebase?) — falling back to full analysis`
    );
    return performFullAnalysis({
      source,
      analysis,
      repoRoot,
      currentCommit,
      statePath,
      manifestPath,
      startTime,
      onProgress,
    });
  }

  // ── 4. Compute git diff ────────────────────────────────────────────────
  onProgress?.(
    `Diffing ${fromCommit!.slice(0, 8)}..${currentCommit.slice(0, 8)}`
  );

  const diffs = await computeDiff(git, fromCommit!, currentCommit);

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
      previousCommit: fromCommit!,
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
      previousCommit: fromCommit!,
      currentCommit,
    };
  }

  // ── 5. Load previous manifest ──────────────────────────────────────────
  const prevManifestPath = previousState?.manifestPath ?? manifestPath;
  const previousManifest = await loadManifest(prevManifestPath);

  // ── 6. Handle file renames — carry forward analysis state ──────────────
  const renamedFiles = diffs.filter((d) => d.status === "renamed");
  if (previousManifest && renamedFiles.length > 0) {
    for (const rename of renamedFiles) {
      if (!rename.oldPath) continue;

      // Find the old module and update its path in the manifest
      const oldModule = previousManifest.modules.find(
        (m) => m.filePath === rename.oldPath
      );
      if (oldModule) {
        oldModule.filePath = rename.path;

        // Update dependency graph edges
        for (const edge of previousManifest.dependencyGraph.edges) {
          if (edge.from === rename.oldPath) edge.from = rename.path;
          if (edge.to === rename.oldPath) edge.to = rename.path;
        }

        // Update dependency graph nodes
        const nodeIdx = previousManifest.dependencyGraph.nodes.indexOf(
          rename.oldPath
        );
        if (nodeIdx >= 0) {
          previousManifest.dependencyGraph.nodes[nodeIdx] = rename.path;
        }
      }
    }
  }

  // ── 7. Determine files to re-analyze ───────────────────────────────────
  const filesToAnalyze = diffs
    .filter((d) => d.status !== "deleted")
    .map((d) => d.path);

  const deletedFiles = diffs
    .filter((d) => d.status === "deleted")
    .map((d) => d.path);

  // ── 8. Cross-file impact analysis (recursive) ─────────────────────────
  let impactedModules: string[] = [];
  if (sync.impact_analysis && previousManifest) {
    impactedModules = findImpactedModulesRecursive(
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

  // ── 9. Incremental re-analysis ─────────────────────────────────────────
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

  // ── 10. Save updated state and manifest ────────────────────────────────
  await saveSyncState(statePath, {
    lastCommitSha: currentCommit,
    lastSyncedAt: new Date().toISOString(),
    manifestPath: prevManifestPath,
    totalPages: manifest.modules.length,
  });

  await saveManifest(prevManifestPath, manifest);

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
    previousCommit: fromCommit!,
    currentCommit,
  };
}

// ─── Full Analysis Fallback ─────────────────────────────────────────────────

interface FullAnalysisParams {
  source: SourceConfig;
  analysis: AnalysisConfig;
  repoRoot: string;
  currentCommit: string;
  statePath: string;
  manifestPath: string;
  startTime: number;
  onProgress?: (message: string) => void;
}

async function performFullAnalysis(
  params: FullAnalysisParams
): Promise<SyncResult> {
  const { source, analysis, repoRoot, currentCommit, statePath, manifestPath, startTime, onProgress } = params;

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
    manifestPath,
    totalPages: manifest.modules.length,
  });

  await saveManifest(manifestPath, manifest);

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

// ─── Git Helpers ────────────────────────────────────────────────────────────

/**
 * Check whether a commit SHA exists and is reachable in the current repo.
 * Returns false for missing commits (e.g., after force push or rebase).
 */
async function isCommitReachable(
  git: SimpleGit,
  commitSha: string
): Promise<boolean> {
  try {
    await git.raw(["cat-file", "-t", commitSha]);
    return true;
  } catch {
    return false;
  }
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
    } else if (statusCode.startsWith("C")) {
      // Copy: C100\tsource\tdest
      diffs.push({
        path: parts[2],
        oldPath: parts[1],
        status: "added",
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

// ─── Cross-file Impact Analysis (Recursive) ─────────────────────────────────

/**
 * Find all modules transitively impacted by the changed files.
 *
 * If A imports from B and B changed, A is impacted. If C imports from A,
 * C is also impacted. Continues until no new modules are found.
 */
function findImpactedModulesRecursive(
  diffs: FileDiff[],
  manifest: AnalysisManifest
): string[] {
  const changedPaths = new Set(diffs.map((d) => d.path));
  const impacted = new Set<string>();

  // Build a reverse dependency map: "module" → [modules that import from it]
  const reverseDeps = new Map<string, Set<string>>();
  for (const edge of manifest.dependencyGraph.edges) {
    if (!reverseDeps.has(edge.to)) {
      reverseDeps.set(edge.to, new Set());
    }
    reverseDeps.get(edge.to)!.add(edge.from);
  }

  // BFS from changed files through reverse dependencies
  const queue = [...changedPaths];
  const visited = new Set(changedPaths);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dependents = reverseDeps.get(current);
    if (!dependents) continue;

    for (const dep of dependents) {
      if (!visited.has(dep)) {
        visited.add(dep);
        impacted.add(dep);
        queue.push(dep);
      }
    }
  }

  // Remove the originally changed files from the impacted set
  for (const changed of changedPaths) {
    impacted.delete(changed);
  }

  return [...impacted];
}

// ─── Manifest Validation ────────────────────────────────────────────────────

/**
 * Check if a manifest file exists and contains valid JSON.
 */
async function isManifestValid(manifestPath: string): Promise<boolean> {
  try {
    await access(manifestPath);
    const content = await readFile(manifestPath, "utf-8");
    const parsed = JSON.parse(content);
    // Basic structural check: manifest should have a modules array
    return Array.isArray(parsed?.modules);
  } catch {
    return false;
  }
}

// ─── State Persistence ──────────────────────────────────────────────────────

async function loadSyncState(
  statePath: string
): Promise<SyncState | null> {
  try {
    const content = await readFile(statePath, "utf-8");
    const parsed = JSON.parse(content);
    // Validate that the state has the required fields
    if (
      typeof parsed?.lastCommitSha !== "string" ||
      typeof parsed?.lastSyncedAt !== "string" ||
      typeof parsed?.manifestPath !== "string"
    ) {
      return null;
    }
    return parsed as SyncState;
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
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed?.modules)) return undefined;
    return parsed as AnalysisManifest;
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
