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
import { resolveApiKey } from "../../analysis/providers/index.js";
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
  theme?: string;
  layout?: string;
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

  // ── Apply --theme / --layout overrides ──────────────────────────────────
  if (options.theme) {
    config.theme.preset = options.theme;
    log("info", `Theme preset: ${chalk.bold(options.theme)}`);
  }
  if (options.layout) {
    config.theme.layout = options.layout as "tabs" | "sidebar" | "tabs-sticky";
    log("info", `Layout: ${chalk.bold(options.layout)}`);
  }

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

    // Auto-fallback: if the provider needs an API key but none is found,
    // swap to the DocWalk proxy (free Gemini Flash via api.docwalk.dev)
    const provName = config.analysis.ai_provider.name;
    const keyEnv = config.analysis.ai_provider.api_key_env;
    const needsKey = provName !== "ollama" && provName !== "local" && provName !== "docwalk-proxy";
    if (needsKey && !resolveApiKey(provName, keyEnv)) {
      log("info", "No API key found — using DocWalk's free AI service (powered by Gemini Flash)");
      config.analysis.ai_provider.name = "docwalk-proxy";
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

  // ── Show pipeline plan ─────────────────────────────────────────────────
  const aiProvider = config.analysis.ai_provider;
  const aiEnabled = config.analysis.ai_summaries && aiProvider;
  const providerLabel = aiProvider
    ? `${aiProvider.name}${aiProvider.model ? ` (${aiProvider.model})` : ""}`
    : "";

  log("info", `Analyzing ${chalk.bold(config.source.repo)} on branch ${chalk.bold(config.source.branch)}`);
  if (aiEnabled) {
    log("info", `AI provider: ${chalk.bold(providerLabel)} at ${chalk.dim(aiProvider!.base_url || "default endpoint")}`);
  }

  // ── Analyze ────────────────────────────────────────────────────────────
  log("info", "Scanning files...");
  const startTime = Date.now();
  let aiStartTime: number | undefined;
  let lastAIProgress = 0;

  const manifest = await analyzeCodebase({
    source: config.source,
    analysis: config.analysis,
    repoRoot,
    commitSha,
    onProgress: (current, total, file) => {
      log("debug", `[${current}/${total}] ${file}`);
    },
    onAIProgress: (current, total, message) => {
      // Detect phase switch: AI insights reuses this callback with different messages
      const isInsightsPhase = message.startsWith("AI analyzing:");
      if (isInsightsPhase) {
        if (current === 1) {
          log("info", `Enhancing insights with AI (${total} insights)...`);
        }
        const step = Math.max(1, Math.min(5, Math.floor(total / 10)));
        if (current % step === 0 || current === total) {
          const pct = Math.round((current / total) * 100);
          log("info", `  AI insights: ${current}/${total} (${pct}%)`);
        }
      } else {
        if (!aiStartTime) {
          aiStartTime = Date.now();
          log("info", `Generating AI summaries (${total} modules)...`);
        }
        // Log every 10% or every 5 modules, whichever is more frequent
        const step = Math.max(1, Math.min(5, Math.floor(total / 10)));
        if (current % step === 0 || current === total) {
          const pct = Math.round((current / total) * 100);
          log("info", `  AI progress: ${current}/${total} (${pct}%)`);
        }
      }
      lastAIProgress = current;
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
      const aiTime = aiStartTime ? ((Date.now() - aiStartTime) / 1000).toFixed(1) : "?";
      log("success", `AI summaries: ${aiModules.length}/${manifest.modules.length} modules (${aiTime}s via ${providerLabel})`);
    } else if (!config.analysis.ai_provider) {
      log("warn", "AI summaries enabled but no ai_provider configured");
    } else if (config.analysis.ai_provider.name !== "ollama" && config.analysis.ai_provider.name !== "local" && config.analysis.ai_provider.name !== "docwalk-proxy") {
      const keyEnv = config.analysis.ai_provider.api_key_env;
      log("warn", `AI summaries enabled but ${keyEnv} environment variable not set`);
    } else {
      log("warn", `AI summaries enabled but no modules received summaries — check that ${providerLabel} is running`);
    }
  } else {
    log("info", "AI summaries: disabled");
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

  let pageCount = 0;
  await generateDocs({
    manifest,
    config,
    outputDir,
    readFile,
    tryMode: options.tryMode,
    onProgress: (msg) => {
      if (msg.startsWith("Written:")) {
        pageCount++;
        log("debug", msg);
      } else if (msg.startsWith("Warning:")) {
        log("warn", msg.replace("Warning: ", ""));
      } else {
        // Surface key generation steps (not file writes)
        log("info", msg);
      }
    },
  });

  blank();
  log("success", `Documentation generated: ${pageCount} pages written`);

  // Non-blocking check: nudge if Zensical isn't installed
  try {
    const { execa } = await import("execa");
    await execa("python3", ["-c", "import zensical"]);
  } catch {
    blank();
    log("warn", "Zensical not installed — needed for preview/deploy");
    console.log(`    Run: ${chalk.cyan("docwalk doctor --install")}`);
  }

  blank();
  console.log(chalk.dim("  Next steps:"));
  console.log(`    ${chalk.cyan("docwalk dev")}     — Preview locally`);
  console.log(`    ${chalk.cyan("docwalk deploy")}  — Deploy to ${config.deploy.provider}`);
  blank();
}
