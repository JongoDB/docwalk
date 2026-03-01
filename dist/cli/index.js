#!/usr/bin/env node
import {
  loadProjectEnv
} from "../chunk-LPLYQTRT.js";
import {
  banner
} from "../chunk-YQ34VMHP.js";

// src/cli/index.ts
import { Command } from "commander";
var program = new Command();
program.name("docwalk").description(
  "Your codebase, documented. Automatically.\nAnalyze repos, generate documentation sites, deploy anywhere."
).version("0.1.0").hook("preAction", async () => {
  await loadProjectEnv();
  banner();
});
program.command("init").description("Initialize DocWalk for a repository").option("-r, --repo <repo>", "Repository (owner/repo or local path)").option("-p, --provider <provider>", "Deploy provider (gh-pages, cloudflare, vercel)").option("-d, --domain <domain>", "Custom domain").option("-t, --theme <theme>", "Theme preset (developer, corporate, startup, minimal, api-reference, knowledge-base)").option("-l, --layout <layout>", "Navigation layout (tabs, sidebar)").option("--no-interactive", "Skip interactive prompts, use defaults").action(async (options) => {
  const { initCommand } = await import("../init-WKU2SNQT.js");
  await initCommand(options);
});
program.command("generate").description("Analyze codebase and generate documentation").option("-c, --config <path>", "Config file path").option("-o, --output <dir>", "Output directory", "docwalk-output").option("--full", "Force full re-analysis (ignore cache)").option("--dry-run", "Show what would be generated without writing files").option("--ai", "Enable AI features using DOCWALK_AI_KEY environment variable").option("--try-mode", "Try mode: limit output and append upsell banners").option("-t, --theme <theme>", "Theme preset (developer, corporate, startup, minimal)").option("-l, --layout <layout>", "Navigation layout (tabs, sidebar, tabs-sticky)").option("-v, --verbose", "Verbose output").action(async (options) => {
  const { generateCommand } = await import("../generate-I2GQ23RB.js");
  await generateCommand(options);
});
program.command("sync").description("Incremental sync \u2014 detect changes and update docs").option("-c, --config <path>", "Config file path").option("--dry-run", "Show diff without applying changes").option("--full", "Force full re-analysis instead of incremental").option("--since <commit>", "Diff from a specific commit SHA instead of last synced").option("-v, --verbose", "Verbose output").action(async (options) => {
  const { syncCommand } = await import("../sync-C6NO4O4X.js");
  await syncCommand(options);
});
program.command("deploy").description("Deploy documentation to hosting provider").option("-c, --config <path>", "Config file path").option("-p, --provider <provider>", "Override deploy provider").option("-d, --domain <domain>", "Override custom domain").option("--skip-build", "Deploy existing build without rebuilding").option("-v, --verbose", "Verbose output").action(async (options) => {
  const { deployCommand } = await import("../deploy-KWBL5Z45.js");
  await deployCommand(options);
});
program.command("undeploy").description("Remove deployment from hosting provider").option("-c, --config <path>", "Config file path").option("-p, --provider <provider>", "Override deploy provider").option("--force", "Skip confirmation prompt").option("-v, --verbose", "Verbose output").action(async (options) => {
  const { undeployCommand } = await import("../undeploy-BHKGYBYB.js");
  await undeployCommand(options);
});
program.command("dev").description("Start local preview server").option("-c, --config <path>", "Config file path").option("--port <port>", "Port number", "8000").option("--host <host>", "Host to bind to", "127.0.0.1").option("-w, --watch", "Watch source files and auto-regenerate docs").option("-v, --verbose", "Verbose output").action(async (options) => {
  const { devCommand } = await import("../dev-AX7IIZL6.js");
  await devCommand(options);
});
program.command("status").description("Show sync state, project info, and deployment status").option("-c, --config <path>", "Config file path").action(async (options) => {
  const { statusCommand } = await import("../status-EGZWIEB6.js");
  await statusCommand(options);
});
program.command("doctor").description("Check Zensical prerequisites and optionally install missing packages").option("--install", "Install missing Python packages").action(async (options) => {
  const { doctorCommand } = await import("../doctor-XP2635ZZ.js");
  await doctorCommand(options);
});
program.command("ci-setup").description("Generate CI/CD pipeline configuration for your provider").option("-c, --config <path>", "Config file path").option("-p, --provider <provider>", "Override deploy provider").option("--preview", "Also generate PR preview deployment workflow").action(async (options) => {
  const { ciSetupCommand } = await import("../ci-setup-3NCBLYVJ.js");
  await ciSetupCommand(options);
});
var versionCmd = program.command("version").description("Manage versioned documentation (requires mike)");
versionCmd.command("list").description("List available documentation versions from git tags").option("-c, --config <path>", "Config file path").option("-v, --verbose", "Verbose output").action(async (options) => {
  const { versionListCommand } = await import("../version-KOBIKQFL.js");
  await versionListCommand(options);
});
versionCmd.command("deploy <tag>").description("Deploy a specific version tag using mike").option("-c, --config <path>", "Config file path").option("-a, --alias <alias>", "Version alias (e.g., latest, stable)").option("--no-set-default", "Don't set this as the default version").option("-v, --verbose", "Verbose output").action(async (tag, options) => {
  const { versionDeployCommand } = await import("../version-KOBIKQFL.js");
  await versionDeployCommand(tag, options);
});
program.parse();
