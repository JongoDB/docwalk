/**
 * Sync Engine Integration Tests
 *
 * Creates temporary git repositories with programmatic commits to test
 * the sync engine's diff detection, impact analysis, rename tracking,
 * and recovery from corrupt state.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import os from "os";
import simpleGit from "simple-git";
import { runSync } from "../../src/sync/engine";
import type { SourceConfig, AnalysisConfig, SyncConfig } from "../../src/config/schema";

const baseSource: SourceConfig = {
  repo: ".",
  branch: "master",
  include: ["**/*.ts"],
  exclude: [],
  languages: "auto",
  provider: "local",
};

const baseAnalysis: AnalysisConfig = {
  depth: "full",
  ai_summaries: false,
  dependency_graph: true,
  changelog: false,
  changelog_depth: 0,
  config_docs: false,
  max_file_size: 500000,
  concurrency: 1,
};

const baseSync: SyncConfig = {
  trigger: "manual",
  diff_strategy: "incremental",
  impact_analysis: true,
  state_file: ".docwalk/state.json",
  auto_commit: false,
  commit_message: "docs: update",
};

let tmpDir: string;

async function createTempRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "docwalk-test-"));
  const git = simpleGit(dir);
  await git.init();
  await git.addConfig("user.email", "test@test.com");
  await git.addConfig("user.name", "Test");
  return dir;
}

async function addFile(dir: string, filePath: string, content: string): Promise<void> {
  const full = path.join(dir, filePath);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, content);
}

async function commitAll(dir: string, message: string): Promise<string> {
  const git = simpleGit(dir);
  await git.add("-A");
  await git.commit(message);
  const sha = await git.revparse(["HEAD"]);
  return sha.trim();
}

beforeEach(async () => {
  tmpDir = await createTempRepo();
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("Sync Engine Integration", () => {
  it("performs full analysis on first sync", async () => {
    await addFile(tmpDir, "src/index.ts", 'export const hello = "world";');
    await commitAll(tmpDir, "initial");

    const result = await runSync({
      repoRoot: tmpDir,
      source: baseSource,
      analysis: baseAnalysis,
      sync: baseSync,
    });

    expect(result.previousCommit).toBe("none");
    expect(result.modulesReanalyzed).toBeGreaterThan(0);
    expect(result.pagesCreated).toBeGreaterThan(0);
  });

  it("detects added files on second sync", async () => {
    await addFile(tmpDir, "src/index.ts", 'export const hello = "world";');
    await commitAll(tmpDir, "initial");

    // First sync
    await runSync({
      repoRoot: tmpDir,
      source: baseSource,
      analysis: baseAnalysis,
      sync: baseSync,
    });

    // Add a new file
    await addFile(tmpDir, "src/utils.ts", "export function add(a: number, b: number) { return a + b; }");
    await commitAll(tmpDir, "add utils");

    // Second sync
    const result = await runSync({
      repoRoot: tmpDir,
      source: baseSource,
      analysis: baseAnalysis,
      sync: baseSync,
    });

    expect(result.diffs.length).toBeGreaterThan(0);
    const added = result.diffs.find((d) => d.path.includes("utils.ts"));
    expect(added).toBeDefined();
    expect(added!.status).toBe("added");
  });

  it("detects modified files on second sync", async () => {
    await addFile(tmpDir, "src/index.ts", 'export const hello = "world";');
    await commitAll(tmpDir, "initial");

    await runSync({
      repoRoot: tmpDir,
      source: baseSource,
      analysis: baseAnalysis,
      sync: baseSync,
    });

    // Modify the file
    await addFile(tmpDir, "src/index.ts", 'export const hello = "updated";');
    await commitAll(tmpDir, "modify");

    const result = await runSync({
      repoRoot: tmpDir,
      source: baseSource,
      analysis: baseAnalysis,
      sync: baseSync,
    });

    const modified = result.diffs.find((d) => d.path.includes("index.ts"));
    expect(modified).toBeDefined();
    expect(modified!.status).toBe("modified");
  });

  it("detects deleted files on second sync", async () => {
    await addFile(tmpDir, "src/index.ts", 'export const hello = "world";');
    await addFile(tmpDir, "src/remove-me.ts", "export const temp = 1;");
    await commitAll(tmpDir, "initial");

    await runSync({
      repoRoot: tmpDir,
      source: baseSource,
      analysis: baseAnalysis,
      sync: baseSync,
    });

    // Delete the file
    const git = simpleGit(tmpDir);
    await git.rm(path.join("src/remove-me.ts"));
    await commitAll(tmpDir, "delete file");

    const result = await runSync({
      repoRoot: tmpDir,
      source: baseSource,
      analysis: baseAnalysis,
      sync: baseSync,
    });

    expect(result.pagesDeleted).toBeGreaterThan(0);
    const deleted = result.diffs.find((d) => d.path.includes("remove-me.ts"));
    expect(deleted).toBeDefined();
    expect(deleted!.status).toBe("deleted");
  });

  it("recovers from corrupt state file", async () => {
    await addFile(tmpDir, "src/index.ts", 'export const hello = "world";');
    await commitAll(tmpDir, "initial");

    // Write corrupt state
    const statePath = path.join(tmpDir, ".docwalk/state.json");
    await mkdir(path.dirname(statePath), { recursive: true });
    await writeFile(statePath, "not valid json {{{");

    // Should fall back to full analysis
    const result = await runSync({
      repoRoot: tmpDir,
      source: baseSource,
      analysis: baseAnalysis,
      sync: baseSync,
    });

    expect(result.previousCommit).toBe("none");
    expect(result.modulesReanalyzed).toBeGreaterThan(0);
  });

  it("recovers from state with missing manifest", async () => {
    await addFile(tmpDir, "src/index.ts", 'export const hello = "world";');
    const sha = await commitAll(tmpDir, "initial");

    // Write state pointing to non-existent manifest
    const statePath = path.join(tmpDir, ".docwalk/state.json");
    await mkdir(path.dirname(statePath), { recursive: true });
    await writeFile(
      statePath,
      JSON.stringify({
        lastCommitSha: sha,
        lastSyncedAt: new Date().toISOString(),
        manifestPath: path.join(tmpDir, ".docwalk/manifest.json"),
        totalPages: 1,
      })
    );

    // Should detect missing manifest and do full analysis
    const result = await runSync({
      repoRoot: tmpDir,
      source: baseSource,
      analysis: baseAnalysis,
      sync: baseSync,
    });

    expect(result.previousCommit).toBe("none");
    expect(result.modulesReanalyzed).toBeGreaterThan(0);
  });

  it("recovers from unreachable previous commit (force push)", async () => {
    await addFile(tmpDir, "src/index.ts", 'export const hello = "world";');
    await commitAll(tmpDir, "initial");

    // Write state with a fake commit SHA
    const statePath = path.join(tmpDir, ".docwalk/state.json");
    const manifestPathVal = path.join(tmpDir, ".docwalk/manifest.json");
    await mkdir(path.dirname(statePath), { recursive: true });
    await writeFile(
      statePath,
      JSON.stringify({
        lastCommitSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        lastSyncedAt: new Date().toISOString(),
        manifestPath: manifestPathVal,
        totalPages: 1,
      })
    );
    // Write a valid manifest so the state "looks" valid
    await writeFile(
      manifestPathVal,
      JSON.stringify({ modules: [], dependencyGraph: { nodes: [], edges: [] }, stats: {} })
    );

    // Should detect unreachable commit and do full analysis
    const result = await runSync({
      repoRoot: tmpDir,
      source: baseSource,
      analysis: baseAnalysis,
      sync: baseSync,
    });

    expect(result.previousCommit).toBe("none");
    expect(result.modulesReanalyzed).toBeGreaterThan(0);
  });

  it("supports --since flag for manual range diffing", async () => {
    await addFile(tmpDir, "src/a.ts", "export const a = 1;");
    const sha1 = await commitAll(tmpDir, "first");

    await addFile(tmpDir, "src/b.ts", "export const b = 2;");
    await commitAll(tmpDir, "second");

    await addFile(tmpDir, "src/c.ts", "export const c = 3;");
    await commitAll(tmpDir, "third");

    // First sync so state exists
    await runSync({
      repoRoot: tmpDir,
      source: baseSource,
      analysis: baseAnalysis,
      sync: baseSync,
    });

    // Use --since to diff from sha1
    const result = await runSync({
      repoRoot: tmpDir,
      source: baseSource,
      analysis: baseAnalysis,
      sync: baseSync,
      since: sha1,
    });

    // Should see b.ts and c.ts as added
    const addedPaths = result.diffs
      .filter((d) => d.status === "added")
      .map((d) => d.path);
    expect(addedPaths).toContain("src/b.ts");
    expect(addedPaths).toContain("src/c.ts");
  });

  it("dry run does not modify state", async () => {
    await addFile(tmpDir, "src/index.ts", 'export const hello = "world";');
    await commitAll(tmpDir, "initial");

    // First sync
    await runSync({
      repoRoot: tmpDir,
      source: baseSource,
      analysis: baseAnalysis,
      sync: baseSync,
    });

    // Read state after first sync
    const statePath = path.join(tmpDir, ".docwalk/state.json");
    const stateAfterSync = await readFile(statePath, "utf-8");

    // Modify and commit
    await addFile(tmpDir, "src/index.ts", "export const hello = 'changed';");
    await commitAll(tmpDir, "change");

    // Dry run
    await runSync({
      repoRoot: tmpDir,
      source: baseSource,
      analysis: baseAnalysis,
      sync: baseSync,
      dryRun: true,
    });

    // State should be unchanged
    const stateAfterDryRun = await readFile(statePath, "utf-8");
    expect(stateAfterDryRun).toBe(stateAfterSync);
  });

  it("handles recursive impact analysis", async () => {
    // Create A -> B -> C dependency chain
    await addFile(tmpDir, "src/c.ts", 'export const C_VAL = 1;');
    await addFile(tmpDir, "src/b.ts", 'import { C_VAL } from "./c.js";\nexport const B_VAL = C_VAL + 1;');
    await addFile(tmpDir, "src/a.ts", 'import { B_VAL } from "./b.js";\nexport const A_VAL = B_VAL + 1;');
    await commitAll(tmpDir, "initial chain");

    // First sync
    await runSync({
      repoRoot: tmpDir,
      source: baseSource,
      analysis: baseAnalysis,
      sync: baseSync,
    });

    // Modify C (the leaf)
    await addFile(tmpDir, "src/c.ts", 'export const C_VAL = 42;');
    await commitAll(tmpDir, "change c");

    // Sync — should detect B and A as impacted
    const result = await runSync({
      repoRoot: tmpDir,
      source: baseSource,
      analysis: baseAnalysis,
      sync: baseSync,
    });

    // Both b.ts and a.ts should be impacted
    expect(result.impactedModules).toContain("src/b.ts");
    expect(result.impactedModules).toContain("src/a.ts");
  });
});
