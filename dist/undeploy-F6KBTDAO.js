import {
  getProvider
} from "./chunk-GF6GHTXP.js";
import {
  ToolNotFoundError,
  formatToolError
} from "./chunk-MRKS4VWN.js";
import {
  loadConfig,
  loadConfigFile
} from "./chunk-DI75Y54W.js";
import {
  blank,
  header,
  log,
  setVerbose
} from "./chunk-YQ34VMHP.js";

// src/cli/commands/undeploy.ts
import chalk from "chalk";
async function undeployCommand(options) {
  if (options.verbose) setVerbose(true);
  header("Undeploy Documentation");
  const { config, filepath } = options.config ? await loadConfigFile(options.config) : await loadConfig();
  log("success", `Config loaded from ${chalk.dim(filepath)}`);
  const deployConfig = {
    ...config.deploy,
    ...options.provider && { provider: options.provider }
  };
  const provider = getProvider(deployConfig.provider);
  if (!provider) {
    log("error", `Unknown provider: ${deployConfig.provider}`);
    log(
      "info",
      `Available providers: gh-pages, cloudflare, vercel`
    );
    process.exit(1);
  }
  if (!options.force) {
    const projectName = deployConfig.project || "docwalk-docs";
    log(
      "warn",
      `This will remove the '${projectName}' deployment from ${provider.name}.`
    );
    log("info", `Use ${chalk.cyan("--force")} to skip this confirmation.`);
    blank();
    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const answer = await new Promise((resolve) => {
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
export {
  undeployCommand
};
