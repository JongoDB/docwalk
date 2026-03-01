import {
  getProvider
} from "./chunk-EQALQVQO.js";
import "./chunk-RI67YQXQ.js";
import {
  loadConfig,
  loadConfigFile
} from "./chunk-DI75Y54W.js";
import {
  blank,
  header,
  log
} from "./chunk-YQ34VMHP.js";

// src/cli/commands/ci-setup.ts
import chalk from "chalk";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
async function ciSetupCommand(options) {
  header("CI/CD Setup");
  const { config } = options.config ? await loadConfigFile(options.config) : await loadConfig();
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
  log("success", `Deploy workflow written to ${chalk.cyan(ciConfig.path)}`);
  if (options.preview) {
    const previewConfig = await provider.generatePreviewCIConfig(
      config.deploy,
      config.domain
    );
    const previewPath = path.resolve(previewConfig.path);
    await mkdir(path.dirname(previewPath), { recursive: true });
    await writeFile(previewPath, previewConfig.content);
    log("success", `Preview workflow written to ${chalk.cyan(previewConfig.path)}`);
  }
  blank();
  if (providerId === "cloudflare") {
    console.log(chalk.dim("  Required GitHub Secrets:"));
    console.log(`    ${chalk.cyan("CLOUDFLARE_API_TOKEN")}   \u2014 Cloudflare API token`);
    console.log(`    ${chalk.cyan("CLOUDFLARE_ACCOUNT_ID")}  \u2014 Cloudflare account ID`);
  } else if (providerId === "vercel") {
    console.log(chalk.dim("  Required GitHub Secrets:"));
    console.log(`    ${chalk.cyan("VERCEL_TOKEN")}       \u2014 Vercel authentication token`);
    console.log(`    ${chalk.cyan("VERCEL_ORG_ID")}      \u2014 Vercel organization ID`);
    console.log(`    ${chalk.cyan("VERCEL_PROJECT_ID")}  \u2014 Vercel project ID`);
  }
  blank();
  log("info", `Commit ${chalk.cyan(ciConfig.path)} to enable automatic deployments`);
  if (options.preview) {
    log("info", `Commit the preview workflow to enable PR previews`);
  }
  blank();
}
export {
  ciSetupCommand
};
