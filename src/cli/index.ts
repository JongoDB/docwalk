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
 *   dev       Local preview server
 *   status    Show sync state and project info
 */

import { Command } from "commander";
import chalk from "chalk";
import { banner } from "../utils/logger.js";

const program = new Command();

program
  .name("docwalk")
  .description(
    "Your codebase, documented. Automatically.\nAnalyze repos, generate MkDocs Material sites, deploy anywhere."
  )
  .version("0.1.0")
  .hook("preAction", () => {
    banner();
  });

// ─── INIT ───────────────────────────────────────────────────────────────────

program
  .command("init")
  .description("Initialize DocWalk for a repository")
  .option("-r, --repo <repo>", "Repository (owner/repo or local path)")
  .option("-p, --provider <provider>", "Deploy provider (gh-pages, cloudflare, vercel)")
  .option("-d, --domain <domain>", "Custom domain")
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

// ─── DEV ────────────────────────────────────────────────────────────────────

program
  .command("dev")
  .description("Start local preview server")
  .option("-c, --config <path>", "Config file path")
  .option("--port <port>", "Port number", "8000")
  .option("--host <host>", "Host to bind to", "127.0.0.1")
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

// ─── CI-SETUP ───────────────────────────────────────────────────────────────

program
  .command("ci-setup")
  .description("Generate CI/CD pipeline configuration for your provider")
  .option("-c, --config <path>", "Config file path")
  .option("-p, --provider <provider>", "Override deploy provider")
  .action(async (options) => {
    const { ciSetupCommand } = await import("./commands/ci-setup.js");
    await ciSetupCommand(options);
  });

// ─── RUN ────────────────────────────────────────────────────────────────────

program.parse();
