/**
 * DocWalk CLI — deploy command
 *
 * Orchestrates: build → provider auth check → deploy → domain setup.
 */

import chalk from "chalk";
import path from "path";
import { loadConfig, loadConfigFile } from "../../config/loader.js";
import { getProvider } from "../../deploy/index.js";
import { log, header, blank, setVerbose } from "../../utils/logger.js";

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
    ...(options.provider && { provider: options.provider as any }),
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
      `Available providers: gh-pages, cloudflare, vercel, netlify, s3`
    );
    process.exit(1);
  }

  // ── Auth Check ─────────────────────────────────────────────────────────
  log("info", `Checking ${provider.name} authentication...`);
  const auth = await provider.checkAuth();

  if (!auth.authenticated) {
    log("error", auth.message);
    process.exit(1);
  }
  log("success", auth.message);

  // ── Build (if not skipped) ─────────────────────────────────────────────
  const buildDir = path.resolve(deployConfig.output_dir || "site");

  if (!options.skipBuild) {
    log("info", "Building MkDocs site...");

    try {
      const { execa } = await import("execa");
      await execa("mkdocs", [
        "build",
        "--config-file",
        "docwalk-output/mkdocs.yml",
        "--site-dir",
        buildDir,
      ]);
      log("success", `Site built to ${chalk.dim(buildDir)}`);
    } catch (error) {
      log("error", "MkDocs build failed. Is mkdocs-material installed?");
      log("info", `Run: ${chalk.cyan("pip install mkdocs-material mkdocs-minify-plugin")}`);
      process.exit(1);
    }
  }

  // ── Setup Project ──────────────────────────────────────────────────────
  log("info", `Setting up ${provider.name} project...`);
  const { projectId } = await provider.setupProject(deployConfig, domainConfig);
  log("success", `Project configured: ${chalk.cyan(projectId)}`);

  // ── Deploy ─────────────────────────────────────────────────────────────
  log("info", "Deploying...");
  const result = await provider.deploy(buildDir, deployConfig, domainConfig);

  log("success", `Deployed to ${chalk.cyan(result.url)}`);

  if (result.previewUrl && result.previewUrl !== result.url) {
    log("info", `Preview: ${chalk.dim(result.previewUrl)}`);
  }

  // ── Domain Configuration ───────────────────────────────────────────────
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

  blank();
  log("success", "Deployment complete!");
  console.log(`\n    ${chalk.bold.hex("#5de4c7")("→")} ${chalk.bold(result.url)}\n`);
}
