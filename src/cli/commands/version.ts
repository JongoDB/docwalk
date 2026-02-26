/**
 * DocWalk CLI — version command
 *
 * Manages versioned documentation using mike (MkDocs versioning tool).
 * Supports listing available versions and deploying specific versions.
 */

import chalk from "chalk";
import path from "path";
import simpleGit from "simple-git";
import { loadConfig, loadConfigFile } from "../../config/loader.js";
import { runTool, ToolNotFoundError, formatToolError } from "../../utils/cli-tools.js";
import { log, header, blank, setVerbose } from "../../utils/logger.js";

interface VersionOptions {
  config?: string;
  verbose?: boolean;
}

interface VersionDeployOptions extends VersionOptions {
  alias?: string;
  setDefault?: boolean;
}

/**
 * List available versions from git tags matching the configured pattern.
 */
export async function versionListCommand(options: VersionOptions): Promise<void> {
  if (options.verbose) setVerbose(true);

  header("Documentation Versions");

  const { config } = options.config
    ? await loadConfigFile(options.config)
    : await loadConfig();

  if (!config.versioning.enabled) {
    log("warn", "Versioning is not enabled in your configuration.");
    log("info", `Enable it by setting ${chalk.cyan("versioning.enabled: true")} in docwalk.config.yml`);
    return;
  }

  const repoRoot = config.source.provider === "local"
    ? path.resolve(config.source.repo)
    : process.cwd();

  const git = simpleGit(repoRoot);
  const tagsResult = await git.tags();

  const pattern = new RegExp(config.versioning.tag_pattern);
  const matchingTags = tagsResult.all.filter((t) => pattern.test(t));

  if (matchingTags.length === 0) {
    log("info", "No version tags found matching pattern: " + chalk.dim(config.versioning.tag_pattern));
    return;
  }

  // Show most recent first, limited to max_versions
  const displayed = matchingTags.reverse().slice(0, config.versioning.max_versions);

  log("info", `Found ${matchingTags.length} version(s):`);
  blank();
  for (const tag of displayed) {
    console.log(`    ${chalk.cyan(tag)}`);
  }
  blank();
  log("info", `Default alias: ${chalk.cyan(config.versioning.default_alias)}`);
}

/**
 * Deploy a specific version tag using mike.
 */
export async function versionDeployCommand(
  tag: string,
  options: VersionDeployOptions
): Promise<void> {
  if (options.verbose) setVerbose(true);

  header(`Deploy Version: ${tag}`);

  const { config } = options.config
    ? await loadConfigFile(options.config)
    : await loadConfig();

  if (!config.versioning.enabled) {
    log("error", "Versioning is not enabled in your configuration.");
    process.exit(1);
  }

  // Verify tag exists
  const repoRoot = config.source.provider === "local"
    ? path.resolve(config.source.repo)
    : process.cwd();

  const git = simpleGit(repoRoot);
  const tagsResult = await git.tags();

  if (!tagsResult.all.includes(tag)) {
    log("error", `Tag '${tag}' not found in repository.`);
    log("info", "Run " + chalk.cyan("docwalk version list") + " to see available versions.");
    process.exit(1);
  }

  // Determine alias
  const alias = options.alias || config.versioning.default_alias;
  const setDefault = options.setDefault !== false;

  log("info", `Deploying version ${chalk.cyan(tag)} with alias ${chalk.cyan(alias)}...`);

  try {
    const mikeArgs = [
      "deploy",
      "--config-file",
      "docwalk-output/mkdocs.yml",
      tag,
      alias,
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
        alias,
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
