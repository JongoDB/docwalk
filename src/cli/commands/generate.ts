/**
 * DocWalk CLI — generate command
 *
 * Runs the full analysis → generation pipeline:
 * 1. Load config (auto-init if missing)
 * 2. Analyze codebase (with ora spinners)
 * 3. Generate MkDocs Material site
 */

import chalk from "chalk";
import path from "path";
import ora from "ora";
import inquirer from "inquirer";
import { readFile as fsReadFile } from "fs/promises";
import { loadConfig, loadConfigFile, ConfigNotFoundError } from "../../config/loader.js";
import { analyzeCodebase } from "../../analysis/engine.js";
import { generateDocs } from "../../generators/mkdocs.js";
import { resolveApiKey } from "../../analysis/providers/index.js";
import { log, header, blank, setVerbose } from "../../utils/logger.js";
import { resolveRepoRoot } from "../../utils/index.js";
import { saveProjectApiKey } from "../../utils/secrets.js";
import { runAISetup } from "../flows/ai-setup.js";
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

  // ── Load Config (auto-init if missing) ────────────────────────────────
  let config: Awaited<ReturnType<typeof loadConfig>>["config"];
  let filepath: string;

  try {
    const result = options.config
      ? await loadConfigFile(options.config)
      : await loadConfig();
    config = result.config;
    filepath = result.filepath;
  } catch (err) {
    if (err instanceof ConfigNotFoundError) {
      blank();
      log("info", "No configuration found — let's set up DocWalk.");
      blank();

      const { initCommand } = await import("./init.js");
      await initCommand({});

      // Reload config after init
      try {
        const result = await loadConfig();
        config = result.config;
        filepath = result.filepath;
      } catch {
        log("error", "Could not load configuration after init. Please run docwalk init manually.");
        process.exit(1);
      }
    } else {
      throw err;
    }
  }

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

  // ── Apply --ai flag overrides ─────────────────────────────────────────
  if (options.ai) {
    config.analysis.ai_summaries = true;
    config.analysis.ai_narrative = true;
    config.analysis.ai_diagrams = true;

    if (!config.analysis.ai_provider) {
      config.analysis.ai_provider = {
        name: "gemini",
        model: "gemini-2.5-flash",
        api_key_env: "DOCWALK_AI_KEY",
      };
    }

    const provName = config.analysis.ai_provider.name;
    const keyEnv = config.analysis.ai_provider.api_key_env;
    const needsKey = provName !== "ollama" && provName !== "local" && provName !== "docwalk-proxy";
    if (needsKey && !resolveApiKey(provName, keyEnv)) {
      log("info", "No API key found — using DocWalk's free AI service (powered by Gemini Flash)");
      config.analysis.ai_provider.name = "docwalk-proxy";
    }
  }

  // ── Interactive AI key prompt when missing ────────────────────────────
  const aiProvider = config.analysis.ai_provider;
  const aiEnabled = config.analysis.ai_summaries && aiProvider;

  if (aiEnabled) {
    const provName = aiProvider!.name;
    const keyEnv = aiProvider!.api_key_env;
    const needsKey = provName !== "ollama" && provName !== "local" && provName !== "docwalk-proxy";

    if (needsKey && !resolveApiKey(provName, keyEnv)) {
      blank();
      const envVarName = keyEnv || provName.toUpperCase() + "_API_KEY";
      const { action } = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: `AI is enabled but no ${envVarName} found:`,
          choices: [
            { name: "Enter API key now", value: "enter" },
            { name: "Use DocWalk free tier instead", value: "proxy" },
            { name: "Continue without AI", value: "skip" },
          ],
        },
      ]);

      if (action === "enter") {
        const { apiKey } = await inquirer.prompt([
          {
            type: "password",
            name: "apiKey",
            message: `${envVarName}:`,
            mask: "*",
            validate: (input: string) => input.length > 0 || "API key is required",
          },
        ]);

        // Set in process.env so it's available for this run
        process.env[envVarName] = apiKey;

        // Persist to .docwalk/.env
        await saveProjectApiKey(provName, apiKey);
        log("success", `API key saved to ${chalk.dim(".docwalk/.env")}`);
      } else if (action === "proxy") {
        aiProvider!.name = "docwalk-proxy";
      } else {
        config.analysis.ai_summaries = false;
      }
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
  const aiProviderFinal = config.analysis.ai_provider;
  const aiFinalEnabled = config.analysis.ai_summaries && aiProviderFinal;
  const providerLabel = aiProviderFinal
    ? `${aiProviderFinal.name}${aiProviderFinal.model ? ` (${aiProviderFinal.model})` : ""}`
    : "";

  log("info", `Analyzing ${chalk.bold(config.source.repo)} on branch ${chalk.bold(config.source.branch)}`);
  if (aiFinalEnabled) {
    log("info", `AI provider: ${chalk.bold(providerLabel)} at ${chalk.dim(aiProviderFinal!.base_url || "default endpoint")}`);
  }

  // ── Analyze (with ora spinners) ─────────────────────────────────────────
  const totalSteps = aiFinalEnabled ? 4 : 3;
  let step = 1;

  const scanSpinner = ora({
    text: `[${step}/${totalSteps}] Scanning source files...`,
    prefixText: " ",
  }).start();

  const startTime = Date.now();
  let aiStartTime: number | undefined;
  let insightsPhaseStarted = false;
  let scanFileCount = 0;

  // Track spinners for AI phases
  let aiSummarySpinner: ReturnType<typeof ora> | undefined;
  let aiInsightsSpinner: ReturnType<typeof ora> | undefined;

  const manifest = await analyzeCodebase({
    source: config.source,
    analysis: config.analysis,
    repoRoot,
    commitSha,
    onProgress: (current, total, file) => {
      scanFileCount = current;
      scanSpinner.text = `[${step}/${totalSteps}] Scanning source files... ${current}/${total}`;
      log("debug", `[${current}/${total}] ${file}`);
    },
    onAIProgress: (current, total, message) => {
      const isInsightsPhase = message.startsWith("AI analyzing:");
      if (isInsightsPhase) {
        if (!insightsPhaseStarted) {
          insightsPhaseStarted = true;
          step++;
          aiInsightsSpinner = ora({
            text: `[${step}/${totalSteps}] Enhancing code insights... 0/${total}`,
            prefixText: " ",
          }).start();
        }
        const pct = Math.round((current / total) * 100);
        if (aiInsightsSpinner) {
          aiInsightsSpinner.text = `[${step}/${totalSteps}] Enhancing code insights... ${current}/${total} (${pct}%)`;
        }
      } else {
        if (!aiStartTime) {
          aiStartTime = Date.now();
          step++;
          aiSummarySpinner = ora({
            text: `[${step}/${totalSteps}] Writing AI summaries... 0/${total}`,
            prefixText: " ",
          }).start();
        }
        const pct = Math.round((current / total) * 100);
        if (aiSummarySpinner) {
          aiSummarySpinner.text = `[${step}/${totalSteps}] Writing AI summaries... ${current}/${total} (${pct}%)`;
        }
      }
      log("debug", `[AI ${current}/${total}] ${message}`);
    },
  });

  // Complete scan spinner
  const analysisTime = ((Date.now() - startTime) / 1000).toFixed(1);
  scanSpinner.succeed(
    `Scanned ${manifest.stats.totalFiles} files, ${manifest.stats.totalSymbols} symbols (${analysisTime}s)`
  );

  // Complete AI spinners
  if (aiInsightsSpinner) {
    aiInsightsSpinner.succeed("Code insights enhanced");
  }

  if (config.analysis.ai_summaries) {
    const aiModules = manifest.modules.filter((m) => m.aiSummary);
    if (aiModules.length > 0) {
      const aiTime = aiStartTime ? ((Date.now() - aiStartTime) / 1000).toFixed(1) : "?";
      if (aiSummarySpinner) {
        aiSummarySpinner.succeed(
          `AI summaries: ${aiModules.length}/${manifest.modules.length} modules (${aiTime}s via ${providerLabel})`
        );
      }
    } else {
      if (aiSummarySpinner) {
        aiSummarySpinner.warn("AI summaries: no modules received summaries");
      } else if (!aiProviderFinal) {
        log("warn", "AI summaries enabled but no ai_provider configured");
      } else if (aiProviderFinal.name !== "ollama" && aiProviderFinal.name !== "local" && aiProviderFinal.name !== "docwalk-proxy") {
        const keyEnv = aiProviderFinal.api_key_env;
        log("warn", `AI summaries enabled but ${keyEnv} environment variable not set`);
      } else {
        log("warn", `AI summaries enabled but no modules received summaries — check that ${providerLabel} is running`);
      }
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

  // ── Generate (with ora spinner) ─────────────────────────────────────────
  step = totalSteps;
  const outputDir = path.resolve(options.output);

  const genSpinner = ora({
    text: `[${step}/${totalSteps}] Generating documentation pages...`,
    prefixText: " ",
  }).start();

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
        genSpinner.text = `[${step}/${totalSteps}] Generating documentation pages... ${pageCount}`;
        log("debug", msg);
      } else if (msg.startsWith("Warning:")) {
        log("warn", msg.replace("Warning: ", ""));
      } else {
        log("info", msg);
      }
    },
  });

  genSpinner.succeed(`Generated ${pageCount} pages`);

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
