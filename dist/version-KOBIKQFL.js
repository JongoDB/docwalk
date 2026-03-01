import {
  ToolNotFoundError,
  formatToolError,
  runTool
} from "./chunk-RI67YQXQ.js";
import {
  loadConfig,
  loadConfigFile
} from "./chunk-DTNMTRIJ.js";
import {
  resolveRepoRoot
} from "./chunk-BAPW5PUT.js";
import {
  blank,
  header,
  log,
  setVerbose
} from "./chunk-YQ34VMHP.js";

// src/cli/commands/version.ts
import chalk from "chalk";
import simpleGit from "simple-git";
async function versionListCommand(options) {
  if (options.verbose) setVerbose(true);
  header("Documentation Versions");
  const { config } = options.config ? await loadConfigFile(options.config) : await loadConfig();
  if (!config.versioning.enabled) {
    log("warn", "Versioning is not enabled in your configuration.");
    log("info", `Enable it by setting ${chalk.cyan("versioning.enabled: true")} in docwalk.config.yml`);
    return;
  }
  const repoRoot = resolveRepoRoot(config.source);
  const git = simpleGit(repoRoot);
  const tagsResult = await git.tags();
  const pattern = new RegExp(config.versioning.tag_pattern);
  const matchingTags = tagsResult.all.filter((t) => pattern.test(t));
  if (matchingTags.length === 0) {
    log("info", "No version tags found matching pattern: " + chalk.dim(config.versioning.tag_pattern));
    return;
  }
  const displayed = matchingTags.reverse().slice(0, config.versioning.max_versions);
  log("info", `Found ${matchingTags.length} version(s):`);
  blank();
  for (const tag of displayed) {
    console.log(`    ${chalk.cyan(tag)}`);
  }
  blank();
  log("info", `Default alias: ${chalk.cyan(config.versioning.default_alias)}`);
}
async function versionDeployCommand(tag, options) {
  if (options.verbose) setVerbose(true);
  header(`Deploy Version: ${tag}`);
  const { config } = options.config ? await loadConfigFile(options.config) : await loadConfig();
  if (!config.versioning.enabled) {
    log("error", "Versioning is not enabled in your configuration.");
    process.exit(1);
  }
  const repoRoot = resolveRepoRoot(config.source);
  const git = simpleGit(repoRoot);
  const tagsResult = await git.tags();
  if (!tagsResult.all.includes(tag)) {
    log("error", `Tag '${tag}' not found in repository.`);
    log("info", "Run " + chalk.cyan("docwalk version list") + " to see available versions.");
    process.exit(1);
  }
  const alias = options.alias || config.versioning.default_alias;
  const setDefault = options.setDefault !== false;
  log("info", `Deploying version ${chalk.cyan(tag)} with alias ${chalk.cyan(alias)}...`);
  try {
    const mikeArgs = [
      "deploy",
      "--config-file",
      "docwalk-output/mkdocs.yml",
      tag,
      alias
    ];
    if (setDefault) {
      mikeArgs.push("--update-aliases");
    }
    await runTool("mike", mikeArgs);
    log("success", `Version ${chalk.cyan(tag)} deployed as ${chalk.cyan(alias)}`);
    if (setDefault) {
      await runTool("mike", [
        "set-default",
        "--config-file",
        "docwalk-output/mkdocs.yml",
        alias
      ]);
      log("success", `Default version set to ${chalk.cyan(alias)}`);
    }
  } catch (error) {
    if (error instanceof ToolNotFoundError) {
      console.log(formatToolError(error));
      log("info", `Install mike: ${chalk.cyan("pip install mike")}`);
      process.exit(1);
    }
    throw error;
  }
}
export {
  versionDeployCommand,
  versionListCommand
};
