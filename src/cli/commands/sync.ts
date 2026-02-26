/**
 * DocWalk CLI — sync command
 *
 * Runs incremental sync: git-diff → targeted re-analysis → rebuild.
 */

import chalk from "chalk";
import path from "path";
import { loadConfig, loadConfigFile } from "../../config/loader.js";
import { runSync } from "../../sync/engine.js";
import { log, header, blank, setVerbose } from "../../utils/logger.js";

interface SyncOptions {
  config?: string;
  dryRun?: boolean;
  full?: boolean;
  since?: string;
  verbose?: boolean;
}

export async function syncCommand(options: SyncOptions): Promise<void> {
  if (options.verbose) setVerbose(true);

  header("Sync Documentation");

  // ── Load Config ─────────────────────────────────────────────────────────
  const { config, filepath } = options.config
    ? await loadConfigFile(options.config)
    : await loadConfig();

  log("success", `Config loaded from ${chalk.dim(filepath)}`);

  const repoRoot = config.source.provider === "local"
    ? path.resolve(config.source.repo)
    : process.cwd();

  // ── Override to full if requested ──────────────────────────────────────
  const syncConfig = {
    ...config.sync,
    ...(options.full && { diff_strategy: "full" as const }),
  };

  // ── Run Sync ───────────────────────────────────────────────────────────
  log("info", "Running sync...");

  const result = await runSync({
    repoRoot,
    source: config.source,
    analysis: config.analysis,
    sync: syncConfig,
    dryRun: options.dryRun,
    since: options.since,
    onProgress: (msg) => log("debug", msg),
  });

  // ── Report ─────────────────────────────────────────────────────────────
  blank();

  if (result.diffs.length === 0) {
    log("success", "Documentation is up to date — no changes detected");
    return;
  }

  log("success", `Sync complete (${(result.duration / 1000).toFixed(1)}s)`);
  blank();

  console.log(chalk.dim("  Summary:"));
  console.log(`    Files changed:        ${chalk.cyan(result.diffs.length.toString())}`);
  console.log(`    Modules re-analyzed:  ${chalk.cyan(result.modulesReanalyzed.toString())}`);
  console.log(`    Pages rebuilt:        ${chalk.cyan(result.pagesRebuilt.toString())}`);
  console.log(`    Pages created:        ${chalk.green(result.pagesCreated.toString())}`);
  console.log(`    Pages deleted:        ${chalk.red(result.pagesDeleted.toString())}`);

  if (result.impactedModules.length > 0) {
    console.log(`    Impacted downstream:  ${chalk.yellow(result.impactedModules.length.toString())}`);
  }

  console.log(`    Commit range:         ${chalk.dim(`${result.previousCommit.slice(0, 8)}..${result.currentCommit.slice(0, 8)}`)}`);
  blank();

  if (options.dryRun) {
    log("info", "Dry run — no files were modified");
    blank();
    console.log(chalk.dim("  Changed files:"));
    for (const diff of result.diffs) {
      const icon = diff.status === "added" ? chalk.green("+") : diff.status === "deleted" ? chalk.red("-") : chalk.yellow("~");
      console.log(`    ${icon} ${diff.path}`);
    }
    blank();
  }
}
