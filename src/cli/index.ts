#!/usr/bin/env node

/**
 * DocWalk CLI
 *
 * Main entry point for the docwalk command-line tool.
 *
 * Commands:
 *   init      Interactive setup wizard
 *   generate  Analyze codebase and generate docs
 *   sync      Incremental sync via git-diff
 *   deploy    Deploy to hosting provider
 *   undeploy  Remove deployment from hosting provider
 *   dev       Local preview server (with --watch support)
 *   status    Show sync state and project info
 */

import { Command } from "commander";
import chalk from "chalk";
import { banner } from "../utils/logger.js";
import { loadProjectEnv } from "../utils/secrets.js";

const program = new Command();

program
  .name("docwalk")
  .description(
    "Your codebase, documented. Automatically.\nAnalyze repos, generate documentation sites, deploy anywhere."
  )
  .version("0.1.0")
  .hook("preAction", async () => {
    await loadProjectEnv();
    banner();
  });

// ─── INIT ───────────────────────────────────────────────────────────────────

program
  .command("init")
  .description("Initialize DocWalk for a repository")
  .option("-r, --repo <repo>", "Repository (owner/repo or local path)")
  .option("-p, --provider <provider>", "Deploy provider (gh-pages, cloudflare, vercel)")
  .option("-d, --domain <domain>", "Custom domain")
  .option("-t, --theme <theme>", "Theme preset (developer, corporate, startup, minimal, api-reference, knowledge-base)")
  .option("-l, --layout <layout>", "Navigation layout (tabs, sidebar)")
  .option("--no-interactive", "Skip interactive prompts, use defaults")
  .action(async (options) => {
    const { initCommand } = await import("./commands/init.js");
    await initCommand(options);
  });

// ─── GENERATE ───────────────────────────────────────────────────────────────

program
  .command("generate")
  .description("Analyze codebase and generate documentation")
  .option("-c, --config <path>", "Config file path")
  .option("-o, --output <dir>", "Output directory", "docwalk-output")
  .option("--full", "Force full re-analysis (ignore cache)")
  .option("--dry-run", "Show what would be generated without writing files")
  .option("--ai", "Enable AI features using DOCWALK_AI_KEY environment variable")
  .option("--try-mode", "Try mode: limit output and append upsell banners")
  .option("-t, --theme <theme>", "Theme preset (developer, corporate, startup, minimal)")
  .option("-l, --layout <layout>", "Navigation layout (tabs, sidebar, tabs-sticky)")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    const { generateCommand } = await import("./commands/generate.js");
    await generateCommand(options);
  });

// ─── SYNC ───────────────────────────────────────────────────────────────────

program
  .command("sync")
  .description("Incremental sync — detect changes and update docs")
  .option("-c, --config <path>", "Config file path")
  .option("--dry-run", "Show diff without applying changes")
  .option("--full", "Force full re-analysis instead of incremental")
  .option("--since <commit>", "Diff from a specific commit SHA instead of last synced")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    const { syncCommand } = await import("./commands/sync.js");
    await syncCommand(options);
  });

// ─── DEPLOY ─────────────────────────────────────────────────────────────────

program
  .command("deploy")
  .description("Deploy documentation to hosting provider")
  .option("-c, --config <path>", "Config file path")
  .option("-p, --provider <provider>", "Override deploy provider")
  .option("-d, --domain <domain>", "Override custom domain")
  .option("--skip-build", "Deploy existing build without rebuilding")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    const { deployCommand } = await import("./commands/deploy.js");
    await deployCommand(options);
  });

// ─── UNDEPLOY ────────────────────────────────────────────────────────────────

program
  .command("undeploy")
  .description("Remove deployment from hosting provider")
  .option("-c, --config <path>", "Config file path")
  .option("-p, --provider <provider>", "Override deploy provider")
  .option("--force", "Skip confirmation prompt")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    const { undeployCommand } = await import("./commands/undeploy.js");
    await undeployCommand(options);
  });

// ─── DEV ────────────────────────────────────────────────────────────────────

program
  .command("dev")
  .description("Start local preview server")
  .option("-c, --config <path>", "Config file path")
  .option("--port <port>", "Port number", "8000")
  .option("--host <host>", "Host to bind to", "127.0.0.1")
  .option("-w, --watch", "Watch source files and auto-regenerate docs")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    const { devCommand } = await import("./commands/dev.js");
    await devCommand(options);
  });

// ─── STATUS ─────────────────────────────────────────────────────────────────

program
  .command("status")
  .description("Show sync state, project info, and deployment status")
  .option("-c, --config <path>", "Config file path")
  .action(async (options) => {
    const { statusCommand } = await import("./commands/status.js");
    await statusCommand(options);
  });

// ─── DOCTOR ─────────────────────────────────────────────────────────────────

program
  .command("doctor")
  .description("Check Zensical prerequisites and optionally install missing packages")
  .option("--install", "Install missing Python packages")
  .action(async (options) => {
    const { doctorCommand } = await import("./commands/doctor.js");
    await doctorCommand(options);
  });

// ─── CI-SETUP ───────────────────────────────────────────────────────────────

program
  .command("ci-setup")
  .description("Generate CI/CD pipeline configuration for your provider")
  .option("-c, --config <path>", "Config file path")
  .option("-p, --provider <provider>", "Override deploy provider")
  .option("--preview", "Also generate PR preview deployment workflow")
  .action(async (options) => {
    const { ciSetupCommand } = await import("./commands/ci-setup.js");
    await ciSetupCommand(options);
  });

// ─── VERSION ─────────────────────────────────────────────────────────────────

const versionCmd = program
  .command("version")
  .description("Manage versioned documentation (requires mike)");

versionCmd
  .command("list")
  .description("List available documentation versions from git tags")
  .option("-c, --config <path>", "Config file path")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    const { versionListCommand } = await import("./commands/version.js");
    await versionListCommand(options);
  });

versionCmd
  .command("deploy <tag>")
  .description("Deploy a specific version tag using mike")
  .option("-c, --config <path>", "Config file path")
  .option("-a, --alias <alias>", "Version alias (e.g., latest, stable)")
  .option("--no-set-default", "Don't set this as the default version")
  .option("-v, --verbose", "Verbose output")
  .action(async (tag, options) => {
    const { versionDeployCommand } = await import("./commands/version.js");
    await versionDeployCommand(tag, options);
  });

// ─── RUN ────────────────────────────────────────────────────────────────────

program.parse();
