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
import { readFile as fsReadFile } from "fs/promises";
import { loadConfig, loadConfigFile } from "../../config/loader.js";
import { analyzeCodebase } from "../../analysis/engine.js";
import { generateDocs } from "../../generators/mkdocs.js";
import { log, header, blank, setVerbose } from "../../utils/logger.js";
import { resolveRepoRoot } from "../../utils/index.js";
import simpleGit from "simple-git";

interface GenerateOptions {
  config?: string;
  output: string;
  full?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  ai?: boolean;
  tryMode?: boolean;
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

  // ── Apply --ai flag overrides ───────────────────────────────────────────
  if (options.ai) {
    config.analysis.ai_summaries = true;
    config.analysis.ai_narrative = true;
    config.analysis.ai_diagrams = true;

    // Default to Gemini if no provider configured (free tier for Try It)
    if (!config.analysis.ai_provider) {
      config.analysis.ai_provider = {
        name: "gemini",
        model: "gemini-2.0-flash",
        api_key_env: "DOCWALK_AI_KEY",
      };
    }
  }

  // ── Resolve repo root ──────────────────────────────────────────────────
  const repoRoot = resolveRepoRoot(config.source);

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
    onAIProgress: (current, total, message) => {
      log("debug", `[AI ${current}/${total}] ${message}`);
    },
  });

  const analysisTime = ((Date.now() - startTime) / 1000).toFixed(1);
  log(
    "success",
    `Analysis complete: ${manifest.stats.totalFiles} files, ${manifest.stats.totalSymbols} symbols (${analysisTime}s)`
  );

  if (config.analysis.ai_summaries) {
    const aiModules = manifest.modules.filter((m) => m.aiSummary);
    if (aiModules.length > 0) {
      log("success", `AI summaries generated for ${aiModules.length} modules`);
    } else if (!config.analysis.ai_provider) {
      log("warn", "AI summaries enabled but no ai_provider configured");
    } else {
      const keyEnv = config.analysis.ai_provider.api_key_env;
      log("warn", `AI summaries enabled but ${keyEnv} environment variable not set`);
    }
  }

  if (options.dryRun) {
    blank();
    log("info", "Dry run — skipping file generation");
    log("info", `Would generate ~${manifest.modules.length + 4} pages`);
    return;
  }

  // ── Generate ───────────────────────────────────────────────────────────
  const outputDir = path.resolve(options.output);
  log("info", `Generating docs to ${chalk.dim(outputDir)}...`);

  // Provide readFile so AI narrative engine can read source files for context
  const readFile = async (filePath: string): Promise<string> => {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(repoRoot, filePath);
    return fsReadFile(fullPath, "utf-8");
  };

  await generateDocs({
    manifest,
    config,
    outputDir,
    readFile,
    tryMode: options.tryMode,
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
