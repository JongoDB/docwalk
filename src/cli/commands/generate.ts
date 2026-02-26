/**
 * DocWalk CLI — generate command
 *
 * Runs the full analysis → generation pipeline:
 * 1. Load config
 * 2. Analyze codebase
 * 3. Generate MkDocs Material site
 */

import chalk from "chalk";
import path from "path";
import { loadConfig, loadConfigFile } from "../../config/loader.js";
import { analyzeCodebase } from "../../analysis/engine.js";
import { generateDocs } from "../../generators/mkdocs.js";
import { log, header, blank, setVerbose } from "../../utils/logger.js";
import simpleGit from "simple-git";

interface GenerateOptions {
  config?: string;
  output: string;
  full?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

export async function generateCommand(options: GenerateOptions): Promise<void> {
  if (options.verbose) setVerbose(true);

  header("Generate Documentation");

  // ── Load Config ─────────────────────────────────────────────────────────
  log("info", "Loading configuration...");

  const { config, filepath } = options.config
    ? await loadConfigFile(options.config)
    : await loadConfig();

  log("success", `Config loaded from ${chalk.dim(filepath)}`);

  // ── Resolve repo root ──────────────────────────────────────────────────
  const repoRoot = config.source.provider === "local"
    ? path.resolve(config.source.repo)
    : process.cwd();

  // ── Get current commit ─────────────────────────────────────────────────
  const git = simpleGit(repoRoot);
  let commitSha: string;
  try {
    commitSha = await git.revparse(["HEAD"]);
  } catch {
    commitSha = "unknown";
    log("warn", "Not a git repository — commit tracking disabled");
  }

  // ── Analyze ────────────────────────────────────────────────────────────
  log("info", "Analyzing codebase...");
  const startTime = Date.now();

  const manifest = await analyzeCodebase({
    source: config.source,
    analysis: config.analysis,
    repoRoot,
    commitSha,
    onProgress: (current, total, file) => {
      log("debug", `[${current}/${total}] ${file}`);
    },
  });

  const analysisTime = ((Date.now() - startTime) / 1000).toFixed(1);
  log(
    "success",
    `Analysis complete: ${manifest.stats.totalFiles} files, ${manifest.stats.totalSymbols} symbols (${analysisTime}s)`
  );

  if (options.dryRun) {
    blank();
    log("info", "Dry run — skipping file generation");
    log("info", `Would generate ~${manifest.modules.length + 4} pages`);
    return;
  }

  // ── Generate ───────────────────────────────────────────────────────────
  const outputDir = path.resolve(options.output);
  log("info", `Generating docs to ${chalk.dim(outputDir)}...`);

  await generateDocs({
    manifest,
    config,
    outputDir,
    onProgress: (msg) => log("debug", msg),
  });

  blank();
  log("success", "Documentation generated!");
  blank();
  console.log(chalk.dim("  Next steps:"));
  console.log(`    ${chalk.cyan("docwalk dev")}     — Preview locally`);
  console.log(`    ${chalk.cyan("docwalk deploy")}  — Deploy to ${config.deploy.provider}`);
  blank();
}
