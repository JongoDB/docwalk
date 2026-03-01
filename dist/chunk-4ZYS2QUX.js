import {
  analyzeCodebase
} from "./chunk-2EVPGTRU.js";

// src/sync/engine.ts
import simpleGit from "simple-git";
import { readFile, writeFile, mkdir, access } from "fs/promises";
import path from "path";
async function runSync(options) {
  const { repoRoot, source, analysis, sync, dryRun, since, onProgress } = options;
  const startTime = Date.now();
  const git = simpleGit(repoRoot);
  const currentCommit = (await git.revparse(["HEAD"])).trim();
  onProgress?.(`Current commit: ${currentCommit.slice(0, 8)}`);
  const statePath = path.resolve(repoRoot, sync.state_file);
  const manifestPath = path.resolve(repoRoot, ".docwalk/manifest.json");
  const previousState = await loadSyncState(statePath);
  const fromCommit = since ?? previousState?.lastCommitSha;
  const needsFullAnalysis = !fromCommit || previousState && !await isManifestValid(previousState.manifestPath);
  if (needsFullAnalysis) {
    const reason = !fromCommit ? "No previous sync state found" : "Manifest file is missing or corrupt";
    onProgress?.(`${reason} \u2014 performing full analysis`);
    return performFullAnalysis({
      source,
      analysis,
      repoRoot,
      currentCommit,
      statePath,
      manifestPath,
      startTime,
      onProgress
    });
  }
  const fromCommitValid = await isCommitReachable(git, fromCommit);
  if (!fromCommitValid) {
    onProgress?.(
      `Previous commit ${fromCommit.slice(0, 8)} not found in history (force push or rebase?) \u2014 falling back to full analysis`
    );
    return performFullAnalysis({
      source,
      analysis,
      repoRoot,
      currentCommit,
      statePath,
      manifestPath,
      startTime,
      onProgress
    });
  }
  onProgress?.(
    `Diffing ${fromCommit.slice(0, 8)}..${currentCommit.slice(0, 8)}`
  );
  const diffs = await computeDiff(git, fromCommit, currentCommit);
  if (diffs.length === 0) {
    onProgress?.("No changes detected \u2014 skipping sync");
    return {
      diffs: [],
      modulesReanalyzed: 0,
      pagesRebuilt: 0,
      pagesCreated: 0,
      pagesDeleted: 0,
      impactedModules: [],
      duration: Date.now() - startTime,
      previousCommit: fromCommit,
      currentCommit
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
      previousCommit: fromCommit,
      currentCommit
    };
  }
  const prevManifestPath = previousState?.manifestPath ?? manifestPath;
  const previousManifest = await loadManifest(prevManifestPath);
  const renamedFiles = diffs.filter((d) => d.status === "renamed");
  if (previousManifest && renamedFiles.length > 0) {
    for (const rename of renamedFiles) {
      if (!rename.oldPath) continue;
      const oldModule = previousManifest.modules.find(
        (m) => m.filePath === rename.oldPath
      );
      if (oldModule) {
        oldModule.filePath = rename.path;
        for (const edge of previousManifest.dependencyGraph.edges) {
          if (edge.from === rename.oldPath) edge.from = rename.path;
          if (edge.to === rename.oldPath) edge.to = rename.path;
        }
        const nodeIdx = previousManifest.dependencyGraph.nodes.indexOf(
          rename.oldPath
        );
        if (nodeIdx >= 0) {
          previousManifest.dependencyGraph.nodes[nodeIdx] = rename.path;
        }
      }
    }
  }
  const filesToAnalyze = diffs.filter((d) => d.status !== "deleted").map((d) => d.path);
  const deletedFiles = diffs.filter((d) => d.status === "deleted").map((d) => d.path);
  let impactedModules = [];
  if (sync.impact_analysis && previousManifest) {
    impactedModules = findImpactedModulesRecursive(
      diffs,
      previousManifest
    );
    onProgress?.(
      `Impact analysis: ${impactedModules.length} downstream modules affected`
    );
    const analyzeSet = new Set(filesToAnalyze);
    for (const impacted of impactedModules) {
      if (!analyzeSet.has(impacted)) {
        filesToAnalyze.push(impacted);
        analyzeSet.add(impacted);
      }
    }
  }
  onProgress?.(`Re-analyzing ${filesToAnalyze.length} files...`);
  const manifest = await analyzeCodebase({
    source,
    analysis,
    repoRoot,
    commitSha: currentCommit,
    targetFiles: filesToAnalyze,
    previousManifest,
    onProgress: (cur, total, file) => onProgress?.(`Analyzing [${cur}/${total}] ${file}`)
  });
  manifest.modules = manifest.modules.filter(
    (m) => !deletedFiles.includes(m.filePath)
  );
  await saveSyncState(statePath, {
    lastCommitSha: currentCommit,
    lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString(),
    manifestPath: prevManifestPath,
    totalPages: manifest.modules.length
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
    previousCommit: fromCommit,
    currentCommit
  };
}
async function performFullAnalysis(params) {
  const { source, analysis, repoRoot, currentCommit, statePath, manifestPath, startTime, onProgress } = params;
  const manifest = await analyzeCodebase({
    source,
    analysis,
    repoRoot,
    commitSha: currentCommit,
    onProgress: (cur, total, file) => onProgress?.(`Analyzing [${cur}/${total}] ${file}`)
  });
  await saveSyncState(statePath, {
    lastCommitSha: currentCommit,
    lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString(),
    manifestPath,
    totalPages: manifest.modules.length
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
    currentCommit
  };
}
async function isCommitReachable(git, commitSha) {
  try {
    await git.raw(["cat-file", "-t", commitSha]);
    return true;
  } catch {
    return false;
  }
}
async function computeDiff(git, fromCommit, toCommit) {
  const diffResult = await git.diff([
    "--name-status",
    fromCommit,
    toCommit
  ]);
  const diffs = [];
  for (const line of diffResult.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("	");
    const statusCode = parts[0];
    if (statusCode.startsWith("R")) {
      diffs.push({
        path: parts[2],
        oldPath: parts[1],
        status: "renamed"
      });
    } else if (statusCode.startsWith("C")) {
      diffs.push({
        path: parts[2],
        oldPath: parts[1],
        status: "added"
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
function findImpactedModulesRecursive(diffs, manifest) {
  const changedPaths = new Set(diffs.map((d) => d.path));
  const impacted = /* @__PURE__ */ new Set();
  const reverseDeps = /* @__PURE__ */ new Map();
  for (const edge of manifest.dependencyGraph.edges) {
    if (!reverseDeps.has(edge.to)) {
      reverseDeps.set(edge.to, /* @__PURE__ */ new Set());
    }
    reverseDeps.get(edge.to).add(edge.from);
  }
  const queue = [...changedPaths];
  const visited = new Set(changedPaths);
  while (queue.length > 0) {
    const current = queue.shift();
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
  for (const changed of changedPaths) {
    impacted.delete(changed);
  }
  return [...impacted];
}
async function isManifestValid(manifestPath) {
  try {
    await access(manifestPath);
    const content = await readFile(manifestPath, "utf-8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed?.modules);
  } catch {
    return false;
  }
}
async function loadSyncState(statePath) {
  try {
    const content = await readFile(statePath, "utf-8");
    const parsed = JSON.parse(content);
    if (typeof parsed?.lastCommitSha !== "string" || typeof parsed?.lastSyncedAt !== "string" || typeof parsed?.manifestPath !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
async function saveSyncState(statePath, state) {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2));
}
async function loadManifest(manifestPath) {
  try {
    const content = await readFile(manifestPath, "utf-8");
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed?.modules)) return void 0;
    return parsed;
  } catch {
    return void 0;
  }
}
async function saveManifest(manifestPath, manifest) {
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

export {
  runSync
};
