import {
  runSync
} from "./chunk-MBWIQ4KR.js";
import "./chunk-NC7KAWM7.js";
import "./chunk-W5SRVZUR.js";
import {
  loadConfig,
  loadConfigFile
} from "./chunk-DTNMTRIJ.js";
import "./chunk-KPWUZIKC.js";
import {
  resolveRepoRoot
} from "./chunk-BAPW5PUT.js";
import {
  blank,
  header,
  log,
  setVerbose
} from "./chunk-YQ34VMHP.js";

// src/cli/commands/sync.ts
import chalk from "chalk";
async function syncCommand(options) {
  if (options.verbose) setVerbose(true);
  header("Sync Documentation");
  const { config, filepath } = options.config ? await loadConfigFile(options.config) : await loadConfig();
  log("success", `Config loaded from ${chalk.dim(filepath)}`);
  const repoRoot = resolveRepoRoot(config.source);
  const syncConfig = {
    ...config.sync,
    ...options.full && { diff_strategy: "full" }
  };
  log("info", "Running sync...");
  const result = await runSync({
    repoRoot,
    source: config.source,
    analysis: config.analysis,
    sync: syncConfig,
    dryRun: options.dryRun,
    since: options.since,
    onProgress: (msg) => log("debug", msg)
  });
  blank();
  if (result.diffs.length === 0) {
    log("success", "Documentation is up to date \u2014 no changes detected");
    return;
  }
  log("success", `Sync complete (${(result.duration / 1e3).toFixed(1)}s)`);
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
    log("info", "Dry run \u2014 no files were modified");
    blank();
    console.log(chalk.dim("  Changed files:"));
    for (const diff of result.diffs) {
      const icon = diff.status === "added" ? chalk.green("+") : diff.status === "deleted" ? chalk.red("-") : chalk.yellow("~");
      console.log(`    ${icon} ${diff.path}`);
    }
    blank();
  }
}
export {
  syncCommand
};
