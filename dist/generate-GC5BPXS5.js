import {
  generateDocs
} from "./chunk-D22PLWCU.js";
import {
  analyzeCodebase
} from "./chunk-YKWC67OC.js";
import "./chunk-W5SRVZUR.js";
import {
  saveProjectApiKey
} from "./chunk-LPLYQTRT.js";
import {
  ConfigNotFoundError,
  clearConfigCache,
  loadConfig,
  loadConfigFile
} from "./chunk-DI75Y54W.js";
import {
  resolveApiKey
} from "./chunk-AOVQF4UT.js";
import "./chunk-ECGUKQHA.js";
import "./chunk-WZW77HOO.js";
import "./chunk-D4RNNKFF.js";
import "./chunk-KPWUZIKC.js";
import {
  resolveRepoRoot
} from "./chunk-BAPW5PUT.js";
import {
  blank,
  header,
  log,
  setVerbose
} from "./chunk-YQ34VMHP.js";

// src/cli/commands/generate.ts
import chalk from "chalk";
import path from "path";
import ora from "ora";
import inquirer from "inquirer";
import { readFile as fsReadFile } from "fs/promises";
import simpleGit from "simple-git";
async function generateCommand(options) {
  if (options.verbose) setVerbose(true);
  header("Generate Documentation");
  let config;
  let filepath;
  try {
    const result = options.config ? await loadConfigFile(options.config) : await loadConfig();
    config = result.config;
    filepath = result.filepath;
  } catch (err) {
    if (err instanceof ConfigNotFoundError) {
      blank();
      log("info", "No configuration found \u2014 let's set up DocWalk.");
      blank();
      const { initCommand } = await import("./init-WEZ34M7D.js");
      await initCommand({ _skipGenerate: true });
      clearConfigCache();
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
  if (options.theme) {
    config.theme.preset = options.theme;
    log("info", `Theme preset: ${chalk.bold(options.theme)}`);
  }
  if (options.layout) {
    config.theme.layout = options.layout;
    log("info", `Layout: ${chalk.bold(options.layout)}`);
  }
  if (options.ai) {
    config.analysis.ai_summaries = true;
    config.analysis.ai_narrative = true;
    config.analysis.ai_diagrams = true;
    if (!config.analysis.ai_provider) {
      config.analysis.ai_provider = {
        name: "gemini",
        model: "gemini-2.5-flash",
        api_key_env: "DOCWALK_AI_KEY"
      };
    }
    const provName = config.analysis.ai_provider.name;
    const keyEnv = config.analysis.ai_provider.api_key_env;
    const needsKey = provName !== "ollama" && provName !== "local" && provName !== "docwalk-proxy";
    if (needsKey && !resolveApiKey(provName, keyEnv)) {
      log("info", "No API key found \u2014 using DocWalk's free AI service (powered by Gemini Flash)");
      config.analysis.ai_provider.name = "docwalk-proxy";
    }
  }
  const aiProvider = config.analysis.ai_provider;
  const aiEnabled = config.analysis.ai_summaries && aiProvider;
  if (aiEnabled) {
    const provName = aiProvider.name;
    const keyEnv = aiProvider.api_key_env;
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
            { name: "Continue without AI", value: "skip" }
          ]
        }
      ]);
      if (action === "enter") {
        const { apiKey } = await inquirer.prompt([
          {
            type: "password",
            name: "apiKey",
            message: `${envVarName}:`,
            mask: "*",
            validate: (input) => input.length > 0 || "API key is required"
          }
        ]);
        process.env[envVarName] = apiKey;
        await saveProjectApiKey(provName, apiKey);
        log("success", `API key saved to ${chalk.dim(".docwalk/.env")}`);
      } else if (action === "proxy") {
        aiProvider.name = "docwalk-proxy";
      } else {
        config.analysis.ai_summaries = false;
      }
    }
  }
  const repoRoot = resolveRepoRoot(config.source);
  const git = simpleGit(repoRoot);
  let commitSha;
  try {
    commitSha = await git.revparse(["HEAD"]);
  } catch {
    commitSha = "unknown";
    log("warn", "Not a git repository \u2014 commit tracking disabled");
  }
  const aiProviderFinal = config.analysis.ai_provider;
  const aiFinalEnabled = config.analysis.ai_summaries && aiProviderFinal;
  const providerLabel = aiProviderFinal ? `${aiProviderFinal.name}${aiProviderFinal.model ? ` (${aiProviderFinal.model})` : ""}` : "";
  log("info", `Analyzing ${chalk.bold(config.source.repo)} on branch ${chalk.bold(config.source.branch)}`);
  if (aiFinalEnabled) {
    log("info", `AI provider: ${chalk.bold(providerLabel)} at ${chalk.dim(aiProviderFinal.base_url || "default endpoint")}`);
  }
  const totalSteps = aiFinalEnabled ? 4 : 3;
  let step = 1;
  const scanSpinner = ora({
    text: `[${step}/${totalSteps}] Scanning source files...`,
    prefixText: " "
  }).start();
  const startTime = Date.now();
  let aiStartTime;
  let insightsPhaseStarted = false;
  let scanFileCount = 0;
  let aiSummarySpinner;
  let aiInsightsSpinner;
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
            prefixText: " "
          }).start();
        }
        const pct = Math.round(current / total * 100);
        if (aiInsightsSpinner) {
          aiInsightsSpinner.text = `[${step}/${totalSteps}] Enhancing code insights... ${current}/${total} (${pct}%)`;
        }
      } else {
        if (!aiStartTime) {
          aiStartTime = Date.now();
          step++;
          aiSummarySpinner = ora({
            text: `[${step}/${totalSteps}] Writing AI summaries... 0/${total}`,
            prefixText: " "
          }).start();
        }
        const pct = Math.round(current / total * 100);
        if (aiSummarySpinner) {
          aiSummarySpinner.text = `[${step}/${totalSteps}] Writing AI summaries... ${current}/${total} (${pct}%)`;
        }
      }
      log("debug", `[AI ${current}/${total}] ${message}`);
    }
  });
  const analysisTime = ((Date.now() - startTime) / 1e3).toFixed(1);
  scanSpinner.succeed(
    `Scanned ${manifest.stats.totalFiles} files, ${manifest.stats.totalSymbols} symbols (${analysisTime}s)`
  );
  if (aiInsightsSpinner) {
    aiInsightsSpinner.succeed("Code insights enhanced");
  }
  if (config.analysis.ai_summaries) {
    const aiModules = manifest.modules.filter((m) => m.aiSummary);
    if (aiModules.length > 0) {
      const aiTime = aiStartTime ? ((Date.now() - aiStartTime) / 1e3).toFixed(1) : "?";
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
        log("warn", `AI summaries enabled but no modules received summaries \u2014 check that ${providerLabel} is running`);
      }
    }
  } else {
    log("info", "AI summaries: disabled");
  }
  if (options.dryRun) {
    blank();
    log("info", "Dry run \u2014 skipping file generation");
    log("info", `Would generate ~${manifest.modules.length + 4} pages`);
    return;
  }
  step = totalSteps;
  const outputDir = path.resolve(options.output);
  const genSpinner = ora({
    text: `[${step}/${totalSteps}] Generating documentation pages...`,
    prefixText: " "
  }).start();
  const readFile = async (filePath) => {
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
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
    }
  });
  genSpinner.succeed(`Generated ${pageCount} pages`);
  blank();
  console.log(chalk.dim("  Next steps:"));
  console.log(`    ${chalk.cyan("docwalk dev")}     \u2014 Preview locally`);
  console.log(`    ${chalk.cyan("docwalk deploy")}  \u2014 Deploy to ${config.deploy.provider}`);
  blank();
}
export {
  generateCommand
};
