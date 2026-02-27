/**
 * DocWalk CLI — deploy command
 *
 * Orchestrates: build → provider auth check → deploy → domain setup.
 * Provides user-friendly errors when external tools are missing.
 */

import chalk from "chalk";
import path from "path";
import { loadConfig, loadConfigFile } from "../../config/loader.js";
import { getProvider } from "../../deploy/index.js";
import { ToolNotFoundError, formatToolError, runTool } from "../../utils/cli-tools.js";
import { log, header, blank, setVerbose } from "../../utils/logger.js";
import { executeHooks } from "../../utils/hooks.js";

interface DeployOptions {
  config?: string;
  provider?: string;
  domain?: string;
  skipBuild?: boolean;
  verbose?: boolean;
}

export async function deployCommand(options: DeployOptions): Promise<void> {
  if (options.verbose) setVerbose(true);

  header("Deploy Documentation");

  // ── Load Config ─────────────────────────────────────────────────────────
  const { config, filepath } = options.config
    ? await loadConfigFile(options.config)
    : await loadConfig();

  log("success", `Config loaded from ${chalk.dim(filepath)}`);

  const deployConfig = {
    ...config.deploy,
    ...(options.provider && { provider: options.provider as "gh-pages" | "cloudflare" | "vercel" | "netlify" | "s3" }),
  };

  const domainConfig = {
    ...config.domain,
    ...(options.domain && { custom: options.domain }),
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

  // ── Auth Check ─────────────────────────────────────────────────────────
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

  // ── Build (if not skipped) ─────────────────────────────────────────────
  const buildDir = path.resolve(deployConfig.output_dir || "site");

  if (!options.skipBuild) {
    log("info", "Building MkDocs site...");

    try {
      await runTool("mkdocs", [
        "build",
        "--config-file",
        "docwalk-output/mkdocs.yml",
        "--site-dir",
        buildDir,
      ]);
      log("success", `Site built to ${chalk.dim(buildDir)}`);
    } catch (error) {
      if (error instanceof ToolNotFoundError) {
        console.log(formatToolError(error));
        process.exit(1);
      }
      log("error", "MkDocs build failed. Is mkdocs-material installed?");
      log("info", `Run: ${chalk.cyan("pip install mkdocs-material mkdocs-minify-plugin mkdocs-glightbox")}`);
      process.exit(1);
    }
  }

  // ── Setup Project ──────────────────────────────────────────────────────
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

  // ── Pre-deploy hooks ───────────────────────────────────────────────────
  await executeHooks("pre_deploy", config.hooks, { cwd: process.cwd() });

  // ── Deploy ─────────────────────────────────────────────────────────────
  log("info", "Deploying...");

  try {
    const result = await provider.deploy(buildDir, deployConfig, domainConfig);

    log("success", `Deployed to ${chalk.cyan(result.url)}`);

    if (result.previewUrl && result.previewUrl !== result.url) {
      log("info", `Preview: ${chalk.dim(result.previewUrl)}`);
    }

    // ── Domain Configuration ───────────────────────────────────────────
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
            `    ${chalk.cyan(record.type)} ${chalk.dim(record.name)} → ${record.value}`
          );
        }
        blank();
        log("info", "Add these records to your DNS provider, then re-run deploy.");
      }
    }

    // ── Post-deploy hooks ──────────────────────────────────────────────
    await executeHooks("post_deploy", config.hooks, { cwd: process.cwd() });

    blank();
    log("success", "Deployment complete!");
    console.log(`\n    ${chalk.bold.hex("#5de4c7")("→")} ${chalk.bold(result.url)}\n`);
  } catch (error) {
    if (error instanceof ToolNotFoundError) {
      console.log(formatToolError(error));
      process.exit(1);
    }
    throw error;
  }
}
