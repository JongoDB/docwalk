/**
 * DocWalk CLI — ci-setup command
 *
 * Generates provider-specific CI/CD pipeline configuration.
 */

import chalk from "chalk";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { loadConfig, loadConfigFile } from "../../config/loader.js";
import { getProvider } from "../../deploy/index.js";
import { log, header, blank } from "../../utils/logger.js";

interface CISetupOptions {
  config?: string;
  provider?: string;
}

export async function ciSetupCommand(options: CISetupOptions): Promise<void> {
  header("CI/CD Setup");

  const { config } = options.config
    ? await loadConfigFile(options.config)
    : await loadConfig();

  const providerId = options.provider || config.deploy.provider;
  const provider = getProvider(providerId);

  if (!provider) {
    log("error", `Unknown provider: ${providerId}`);
    process.exit(1);
  }

  log("info", `Generating ${provider.name} CI/CD configuration...`);

  const ciConfig = await provider.generateCIConfig(config.deploy, config.domain);

  const ciPath = path.resolve(ciConfig.path);
  await mkdir(path.dirname(ciPath), { recursive: true });
  await writeFile(ciPath, ciConfig.content);

  log("success", `CI/CD config written to ${chalk.cyan(ciConfig.path)}`);
  blank();

  // Provider-specific secrets reminder
  if (providerId === "cloudflare") {
    console.log(chalk.dim("  Required GitHub Secrets:"));
    console.log(`    ${chalk.cyan("CLOUDFLARE_API_TOKEN")}   — Cloudflare API token`);
    console.log(`    ${chalk.cyan("CLOUDFLARE_ACCOUNT_ID")}  — Cloudflare account ID`);
  } else if (providerId === "vercel") {
    console.log(chalk.dim("  Required GitHub Secrets:"));
    console.log(`    ${chalk.cyan("VERCEL_TOKEN")}       — Vercel authentication token`);
    console.log(`    ${chalk.cyan("VERCEL_ORG_ID")}      — Vercel organization ID`);
    console.log(`    ${chalk.cyan("VERCEL_PROJECT_ID")}  — Vercel project ID`);
  }

  blank();
  log("info", `Commit ${chalk.cyan(ciConfig.path)} to enable automatic deployments`);
  blank();
}
