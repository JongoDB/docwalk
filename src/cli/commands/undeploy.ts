/**
 * DocWalk CLI — undeploy command
 *
 * Removes a deployed documentation site from the hosting provider.
 */

import chalk from "chalk";
import { loadConfig, loadConfigFile } from "../../config/loader.js";
import { getProvider } from "../../deploy/index.js";
import { ToolNotFoundError, formatToolError } from "../../utils/cli-tools.js";
import { log, header, blank, setVerbose } from "../../utils/logger.js";

interface UndeployOptions {
  config?: string;
  provider?: string;
  verbose?: boolean;
  force?: boolean;
}

export async function undeployCommand(options: UndeployOptions): Promise<void> {
  if (options.verbose) setVerbose(true);

  header("Undeploy Documentation");

  // ── Load Config ─────────────────────────────────────────────────────────
  const { config, filepath } = options.config
    ? await loadConfigFile(options.config)
    : await loadConfig();

  log("success", `Config loaded from ${chalk.dim(filepath)}`);

  const deployConfig = {
    ...config.deploy,
    ...(options.provider && { provider: options.provider as "gh-pages" | "cloudflare" | "vercel" | "netlify" | "s3" }),
  };

  // ── Get Provider ───────────────────────────────────────────────────────
  const provider = getProvider(deployConfig.provider);
  if (!provider) {
    log("error", `Unknown provider: ${deployConfig.provider}`);
    log(
      "info",
      `Available providers: gh-pages, cloudflare, vercel`
    );
    process.exit(1);
  }

  // ── Confirm ─────────────────────────────────────────────────────────────
  if (!options.force) {
    const projectName = deployConfig.project || "docwalk-docs";
    log(
      "warn",
      `This will remove the '${projectName}' deployment from ${provider.name}.`
    );
    log("info", `Use ${chalk.cyan("--force")} to skip this confirmation.`);
    blank();

    // Simple stdin confirmation
    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(
        chalk.yellow("  Are you sure? (y/N) "),
        (ans) => {
          rl.close();
          resolve(ans.trim().toLowerCase());
        }
      );
    });

    if (answer !== "y" && answer !== "yes") {
      log("info", "Cancelled.");
      return;
    }
    blank();
  }

  // ── Undeploy ────────────────────────────────────────────────────────────
  log("info", `Removing deployment from ${provider.name}...`);

  try {
    const result = await provider.undeploy(deployConfig, config.domain);

    if (result.success) {
      log("success", result.message);
    } else {
      log("warn", result.message);
    }
  } catch (error) {
    if (error instanceof ToolNotFoundError) {
      console.log(formatToolError(error));
      process.exit(1);
    }
    throw error;
  }

  blank();
}
