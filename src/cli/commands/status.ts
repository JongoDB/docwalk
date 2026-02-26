/**
 * DocWalk CLI — status command
 *
 * Shows current sync state, project info, and config summary.
 */

import chalk from "chalk";
import path from "path";
import { readFile } from "fs/promises";
import { loadConfig, loadConfigFile } from "../../config/loader.js";
import { log, header, blank } from "../../utils/logger.js";
import type { SyncState } from "../../analysis/types.js";

interface StatusOptions {
  config?: string;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  header("DocWalk Status");

  try {
    const { config, filepath } = options.config
      ? await loadConfigFile(options.config)
      : await loadConfig();

    console.log(chalk.dim("  Configuration"));
    console.log(`    Config file:    ${chalk.cyan(filepath)}`);
    console.log(`    Repository:     ${chalk.cyan(config.source.repo)}`);
    console.log(`    Branch:         ${config.source.branch}`);
    console.log(`    Provider:       ${config.deploy.provider}`);
    console.log(`    Domain:         ${config.domain.custom || chalk.dim("(none)")}`);
    console.log(`    Base path:      ${config.domain.base_path}`);
    console.log(`    Sync trigger:   ${config.sync.trigger}`);
    console.log(`    Analysis depth: ${config.analysis.depth}`);
    console.log(`    AI summaries:   ${config.analysis.ai_summaries ? chalk.green("enabled") : chalk.dim("disabled")}`);
    blank();

    // Load sync state
    const statePath = path.resolve(config.sync.state_file);
    try {
      const stateContent = await readFile(statePath, "utf-8");
      const state: SyncState = JSON.parse(stateContent);

      console.log(chalk.dim("  Sync State"));
      console.log(`    Last commit:    ${chalk.cyan(state.lastCommitSha.slice(0, 8))}`);
      console.log(`    Last synced:    ${state.lastSyncedAt}`);
      console.log(`    Total pages:    ${state.totalPages}`);
      blank();
    } catch {
      console.log(chalk.dim("  Sync State"));
      console.log(`    ${chalk.yellow("Not synced yet")} — run ${chalk.cyan("docwalk generate")} first`);
      blank();
    }
  } catch (error: any) {
    log("error", error.message);
    log("info", `Run ${chalk.cyan("docwalk init")} to set up DocWalk`);
  }
}
