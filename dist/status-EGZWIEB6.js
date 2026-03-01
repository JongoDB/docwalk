import {
  loadConfig,
  loadConfigFile
} from "./chunk-DTNMTRIJ.js";
import {
  blank,
  header,
  log
} from "./chunk-YQ34VMHP.js";

// src/cli/commands/status.ts
import chalk from "chalk";
import path from "path";
import { readFile } from "fs/promises";
async function statusCommand(options) {
  header("DocWalk Status");
  try {
    const { config, filepath } = options.config ? await loadConfigFile(options.config) : await loadConfig();
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
    const statePath = path.resolve(config.sync.state_file);
    try {
      const stateContent = await readFile(statePath, "utf-8");
      const state = JSON.parse(stateContent);
      console.log(chalk.dim("  Sync State"));
      console.log(`    Last commit:    ${chalk.cyan(state.lastCommitSha.slice(0, 8))}`);
      console.log(`    Last synced:    ${state.lastSyncedAt}`);
      console.log(`    Total pages:    ${state.totalPages}`);
      blank();
    } catch {
      console.log(chalk.dim("  Sync State"));
      console.log(`    ${chalk.yellow("Not synced yet")} \u2014 run ${chalk.cyan("docwalk generate")} first`);
      blank();
    }
  } catch (error) {
    log("error", error.message);
    log("info", `Run ${chalk.cyan("docwalk init")} to set up DocWalk`);
  }
}
export {
  statusCommand
};
