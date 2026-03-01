import {
  executeHooks
} from "./chunk-W5SRVZUR.js";
import {
  getProvider
} from "./chunk-EQALQVQO.js";
import {
  ToolNotFoundError,
  ZENSICAL_INSTALL_CMD,
  formatToolError,
  runTool
} from "./chunk-RI67YQXQ.js";
import {
  loadConfig,
  loadConfigFile
} from "./chunk-DTNMTRIJ.js";
import {
  blank,
  header,
  log,
  setVerbose
} from "./chunk-YQ34VMHP.js";

// src/cli/commands/deploy.ts
import chalk from "chalk";
import path from "path";
async function deployCommand(options) {
  if (options.verbose) setVerbose(true);
  header("Deploy Documentation");
  const { config, filepath } = options.config ? await loadConfigFile(options.config) : await loadConfig();
  log("success", `Config loaded from ${chalk.dim(filepath)}`);
  const deployConfig = {
    ...config.deploy,
    ...options.provider && { provider: options.provider }
  };
  const domainConfig = {
    ...config.domain,
    ...options.domain && { custom: options.domain }
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
  log("info", `Checking ${provider.name} authentication...`);
  try {
    const auth = await provider.checkAuth();
    if (!auth.authenticated) {
      log("error", auth.message);
      process.exit(1);
    }
    log("success", auth.message);
  } catch (error) {
    if (error instanceof ToolNotFoundError) {
      console.log(formatToolError(error));
      process.exit(1);
    }
    throw error;
  }
  const buildDir = path.resolve(deployConfig.output_dir || "site");
  if (!options.skipBuild) {
    log("info", "Building documentation site...");
    try {
      await runTool("zensical", [
        "build",
        "--config-file",
        "docwalk-output/mkdocs.yml",
        "--site-dir",
        buildDir
      ]);
      log("success", `Site built to ${chalk.dim(buildDir)}`);
    } catch (error) {
      if (error instanceof ToolNotFoundError) {
        console.log(formatToolError(error));
        process.exit(1);
      }
      log("error", "Build failed. Is Zensical installed?");
      log("info", `Run: ${chalk.cyan(ZENSICAL_INSTALL_CMD)}`);
      process.exit(1);
    }
  }
  log("info", `Setting up ${provider.name} project...`);
  try {
    const { projectId } = await provider.setupProject(deployConfig, domainConfig);
    log("success", `Project configured: ${chalk.cyan(projectId)}`);
  } catch (error) {
    if (error instanceof ToolNotFoundError) {
      console.log(formatToolError(error));
      process.exit(1);
    }
    throw error;
  }
  await executeHooks("pre_deploy", config.hooks, { cwd: process.cwd() });
  log("info", "Deploying...");
  try {
    const result = await provider.deploy(buildDir, deployConfig, domainConfig);
    log("success", `Deployed to ${chalk.cyan(result.url)}`);
    if (result.previewUrl && result.previewUrl !== result.url) {
      log("info", `Preview: ${chalk.dim(result.previewUrl)}`);
    }
    if (domainConfig.custom) {
      log("info", `Configuring domain: ${chalk.cyan(domainConfig.custom)}...`);
      const domainResult = await provider.configureDomain(
        domainConfig,
        deployConfig
      );
      if (domainResult.configured) {
        log("success", "Custom domain configured with SSL");
      } else if (domainResult.dnsRecords) {
        log("warn", "Manual DNS configuration required:");
        blank();
        for (const record of domainResult.dnsRecords) {
          console.log(
            `    ${chalk.cyan(record.type)} ${chalk.dim(record.name)} \u2192 ${record.value}`
          );
        }
        blank();
        log("info", "Add these records to your DNS provider, then re-run deploy.");
      }
    }
    await executeHooks("post_deploy", config.hooks, { cwd: process.cwd() });
    blank();
    log("success", "Deployment complete!");
    console.log(`
    ${chalk.bold.hex("#5de4c7")("\u2192")} ${chalk.bold(result.url)}
`);
  } catch (error) {
    if (error instanceof ToolNotFoundError) {
      console.log(formatToolError(error));
      process.exit(1);
    }
    throw error;
  }
}
export {
  deployCommand
};
