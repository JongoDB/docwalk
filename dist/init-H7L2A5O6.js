import {
  saveProjectApiKey
} from "./chunk-LPLYQTRT.js";
import {
  resolveApiKey
} from "./chunk-NOZSCKAF.js";
import {
  blank,
  header,
  log
} from "./chunk-YQ34VMHP.js";

// src/cli/commands/init.ts
import inquirer2 from "inquirer";
import chalk2 from "chalk";
import { writeFile, mkdir } from "fs/promises";
import { execSync } from "child_process";
import path from "path";
import yaml from "js-yaml";

// src/cli/flows/ai-setup.ts
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
var PROVIDER_CHOICES = [
  { name: "Google Gemini    \u2014 free tier, fast, great for docs", value: "gemini" },
  { name: "Anthropic Claude \u2014 best quality, requires API key", value: "anthropic" },
  { name: "OpenAI GPT      \u2014 widely available", value: "openai" },
  { name: "OpenRouter       \u2014 multi-model gateway", value: "openrouter" },
  { name: "Local / Ollama   \u2014 no API key, runs locally", value: "ollama" },
  { name: "Skip             \u2014 use DocWalk free tier (Gemini Flash)", value: "docwalk-proxy" }
];
var KEY_URLS = {
  gemini: "https://aistudio.google.com/app/apikey",
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  openrouter: "https://openrouter.ai/keys"
};
var ENV_VAR_NAMES = {
  gemini: "GEMINI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY"
};
var DEFAULT_MODELS = {
  gemini: "gemini-2.5-flash",
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
  openrouter: "google/gemini-2.5-flash",
  ollama: "llama3.2"
};
async function runAISetup() {
  const { enableAI } = await inquirer.prompt([
    {
      type: "confirm",
      name: "enableAI",
      message: "Enable AI-powered documentation? (summaries, narratives, diagrams)",
      default: true
    }
  ]);
  if (!enableAI) {
    return { enabled: false };
  }
  const { provider } = await inquirer.prompt([
    {
      type: "list",
      name: "provider",
      message: "AI provider:",
      choices: PROVIDER_CHOICES
    }
  ]);
  if (provider === "ollama" || provider === "docwalk-proxy") {
    return {
      enabled: true,
      providerName: provider,
      model: DEFAULT_MODELS[provider]
    };
  }
  const envVar = ENV_VAR_NAMES[provider];
  const existingKey = resolveApiKey(provider, envVar);
  if (existingKey) {
    log("success", `Found existing ${chalk.cyan(envVar)} in environment`);
    return {
      enabled: true,
      providerName: provider,
      model: DEFAULT_MODELS[provider],
      keyStored: false
    };
  }
  const keyUrl = KEY_URLS[provider];
  if (keyUrl) {
    blank();
    console.log(`  Get your API key: ${chalk.cyan.underline(keyUrl)}`);
    blank();
  }
  const { apiKey } = await inquirer.prompt([
    {
      type: "password",
      name: "apiKey",
      message: `${envVar}:`,
      mask: "*",
      validate: (input) => input.length > 0 || "API key is required"
    }
  ]);
  const spinner = ora("Validating API key...").start();
  try {
    await validateApiKey(provider, apiKey);
    spinner.succeed("API key is valid");
  } catch (err) {
    spinner.fail(`API key validation failed: ${err.message || "unknown error"}`);
    const { fallback } = await inquirer.prompt([
      {
        type: "list",
        name: "fallback",
        message: "What would you like to do?",
        choices: [
          { name: "Try a different key", value: "retry" },
          { name: "Save anyway (skip validation)", value: "save" },
          { name: "Use DocWalk free tier instead", value: "proxy" }
        ]
      }
    ]);
    if (fallback === "retry") {
      return runAISetup();
    }
    if (fallback === "proxy") {
      return {
        enabled: true,
        providerName: "docwalk-proxy",
        model: DEFAULT_MODELS["docwalk-proxy"]
      };
    }
  }
  await saveProjectApiKey(provider, apiKey);
  log("success", `API key saved to ${chalk.dim(".docwalk/.env")}`);
  return {
    enabled: true,
    providerName: provider,
    model: DEFAULT_MODELS[provider],
    keyStored: true
  };
}
async function validateApiKey(provider, apiKey) {
  switch (provider) {
    case "gemini": {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { maxOutputTokens: 10 }
      });
      await model.generateContent("Say hi");
      break;
    }
    case "anthropic": {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say hi" }]
      });
      break;
    }
    case "openai": {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey });
      await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say hi" }]
      });
      break;
    }
    case "openrouter": {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1"
      });
      await client.chat.completions.create({
        model: "google/gemini-2.5-flash",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say hi" }]
      });
      break;
    }
    default:
      break;
  }
}

// src/cli/commands/init.ts
var DEFAULT_INCLUDES = [
  "**/*.ts",
  "**/*.tsx",
  "**/*.js",
  "**/*.jsx",
  "**/*.py",
  "**/*.go",
  "**/*.rs",
  "**/*.java",
  "**/*.rb",
  "**/*.php",
  "**/*.cs",
  "**/*.c",
  "**/*.h",
  "**/*.cpp",
  "**/*.hpp",
  "**/*.cc",
  "**/*.cxx",
  "**/*.swift",
  "**/*.kt",
  "**/*.kts",
  "**/*.scala",
  "**/*.sh",
  "**/*.bash",
  "**/*.yaml",
  "**/*.yml",
  "**/*.tf",
  "**/*.hcl",
  "**/*.md",
  "**/*.json",
  "**/*.toml",
  "**/*.xml",
  "**/*.sql",
  "**/*.dockerfile",
  "**/Dockerfile"
];
var DEFAULT_EXCLUDES = [
  "node_modules/**",
  "dist/**",
  "build/**",
  "out/**",
  ".git/**",
  ".next/**",
  "vendor/**",
  "__pycache__/**",
  "venv/**",
  ".venv/**",
  "target/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/__tests__/**",
  "**/test/**",
  "**/tests/**",
  "coverage/**",
  ".docwalk/**",
  "docwalk-output/**",
  "site/**",
  "**/*.d.ts",
  "**/*.min.js",
  "**/migrations/**"
];
var DEFAULT_FEATURES = [
  "navigation.tabs",
  "navigation.sections",
  "navigation.expand",
  "navigation.top",
  "search.suggest",
  "search.highlight",
  "content.code.copy",
  "content.tabs.link"
];
async function initCommand(options) {
  header("Initialize DocWalk");
  const interactive = options.interactive !== false;
  if (!interactive) {
    await writeDefaultConfig(options);
    return;
  }
  const { mode } = await inquirer2.prompt([
    {
      type: "list",
      name: "mode",
      message: "Setup mode:",
      choices: [
        { name: "Quick Start \u2014 analyze code, generate docs, done", value: "quick" },
        { name: "Custom     \u2014 configure deploy, sync, domain, theme", value: "custom" }
      ]
    }
  ]);
  if (mode === "quick") {
    await quickStartTrack(options);
  } else {
    await customTrack(options);
  }
}
async function quickStartTrack(options) {
  const detectedRepo = options.repo || await detectCurrentRepo();
  const { repo } = await inquirer2.prompt([
    {
      type: "input",
      name: "repo",
      message: "Repository:",
      default: detectedRepo,
      validate: (input) => input.length > 0 || "Repository is required"
    }
  ]);
  let branch = "main";
  try {
    const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
    if (currentBranch) branch = currentBranch;
  } catch {
  }
  blank();
  const aiResult = await runAISetup();
  blank();
  const { preset } = await inquirer2.prompt([
    {
      type: "list",
      name: "preset",
      message: "Theme:",
      choices: [
        { name: "Developer \u2014 Dark-first, code-dense, technical", value: "developer" },
        { name: "Corporate \u2014 Clean, professional", value: "corporate" },
        { name: "Startup   \u2014 Vibrant, modern", value: "startup" },
        { name: "Minimal   \u2014 Reading-focused, distraction-free", value: "minimal" }
      ],
      default: "developer"
    }
  ]);
  const repoName = repo.split("/").pop() || "docs";
  const config = {
    source: {
      repo,
      branch,
      include: DEFAULT_INCLUDES,
      exclude: DEFAULT_EXCLUDES,
      languages: "auto",
      provider: detectProvider(repo)
    },
    analysis: {
      depth: "full",
      ai_summaries: aiResult.enabled,
      ...aiResult.enabled && aiResult.providerName && {
        ai_provider: {
          name: aiResult.providerName,
          ...aiResult.model && { model: aiResult.model }
        }
      },
      dependency_graph: true,
      changelog: true,
      changelog_depth: 100,
      config_docs: true,
      max_file_size: 5e5,
      concurrency: 4
    },
    sync: {
      trigger: "on_push",
      diff_strategy: "incremental",
      impact_analysis: true,
      state_file: ".docwalk/state.json",
      auto_commit: false,
      commit_message: "docs: update documentation [docwalk]"
    },
    deploy: {
      provider: "gh-pages",
      project: `${repoName}-docs`,
      auto_ssl: true,
      output_dir: "site"
    },
    domain: {
      base_path: "/",
      dns_auto: true
    },
    theme: {
      preset,
      layout: "tabs",
      features: DEFAULT_FEATURES
    },
    versioning: {
      enabled: false,
      source: "tags",
      tag_pattern: "^v\\d+\\.\\d+\\.\\d+$",
      default_alias: "latest",
      max_versions: 10
    }
  };
  await writeConfigAndScaffold(config);
  if (options._skipGenerate) {
    return;
  }
  blank();
  const { generateNow } = await inquirer2.prompt([
    {
      type: "confirm",
      name: "generateNow",
      message: "Generate documentation now?",
      default: true
    }
  ]);
  if (generateNow) {
    blank();
    const { clearConfigCache } = await import("./loader-5BOX56KF.js");
    clearConfigCache();
    const { generateCommand } = await import("./generate-CRFYZAMP.js");
    await generateCommand({ output: "docwalk-output" });
  } else {
    blank();
    console.log(chalk2.dim("  Next steps:"));
    console.log(`    1. ${chalk2.cyan("docwalk generate")}  \u2014 Analyze and generate docs`);
    console.log(`    2. ${chalk2.cyan("docwalk dev")}       \u2014 Preview locally`);
    blank();
  }
}
async function customTrack(options) {
  const repoAnswers = await inquirer2.prompt([
    {
      type: "input",
      name: "repo",
      message: "Repository (owner/repo or local path):",
      default: options.repo || await detectCurrentRepo(),
      validate: (input) => input.length > 0 || "Repository is required"
    },
    {
      type: "list",
      name: "branch",
      message: "Branch to track:",
      choices: ["main", "master", "develop", "Other"],
      default: "main"
    },
    {
      type: "input",
      name: "branchCustom",
      message: "Enter branch name:",
      when: (answers) => answers.branch === "Other"
    }
  ]);
  const branch = repoAnswers.branch === "Other" ? repoAnswers.branchCustom : repoAnswers.branch;
  blank();
  log("info", "Analysis Configuration");
  const analysisAnswers = await inquirer2.prompt([
    {
      type: "list",
      name: "depth",
      message: "Analysis depth:",
      choices: [
        { name: "Full \u2014 AST, cross-refs, dependency graph, everything", value: "full" },
        { name: "Surface \u2014 File-level overview, exports, top-level docs", value: "surface" },
        { name: "API Only \u2014 Public API surface (exports, types, interfaces)", value: "api-only" }
      ],
      default: "full"
    },
    {
      type: "confirm",
      name: "dependency_graph",
      message: "Generate dependency graph?",
      default: true
    },
    {
      type: "confirm",
      name: "changelog",
      message: "Auto-generate changelog from git history?",
      default: true
    }
  ]);
  blank();
  const aiResult = await runAISetup();
  blank();
  log("info", "Deployment Configuration");
  const deployAnswers = await inquirer2.prompt([
    {
      type: "list",
      name: "provider",
      message: "Hosting provider:",
      choices: [
        { name: "GitHub Pages \u2014 Free for public repos, Actions-based", value: "gh-pages" },
        { name: "Cloudflare Pages \u2014 Global edge, Wrangler CLI", value: "cloudflare" },
        { name: "Vercel \u2014 Instant deploys, preview URLs", value: "vercel" },
        { name: "Netlify \u2014 Git-based, form handling", value: "netlify" },
        { name: "AWS S3 \u2014 S3 bucket + optional CloudFront", value: "s3" }
      ],
      default: options.provider || "gh-pages"
    },
    {
      type: "input",
      name: "project",
      message: "Project name on hosting platform:",
      default: (answers) => {
        const repoName = repoAnswers.repo.split("/").pop() || "docs";
        return `${repoName}-docs`;
      }
    }
  ]);
  blank();
  log("info", "Domain Configuration");
  const domainAnswers = await inquirer2.prompt([
    {
      type: "confirm",
      name: "useCustomDomain",
      message: "Configure a custom domain?",
      default: !!options.domain
    },
    {
      type: "input",
      name: "custom",
      message: "Custom domain (e.g., docs.yourcompany.com):",
      default: options.domain,
      when: (answers) => answers.useCustomDomain,
      validate: (input) => {
        if (!input.includes(".")) return "Enter a valid domain";
        return true;
      }
    },
    {
      type: "input",
      name: "base_path",
      message: "Base path (e.g., /project-name, or / for root):",
      default: "/"
    },
    {
      type: "confirm",
      name: "dns_auto",
      message: "Auto-configure DNS via provider API?",
      default: true,
      when: (answers) => answers.useCustomDomain
    }
  ]);
  blank();
  log("info", "Sync Strategy");
  const syncAnswers = await inquirer2.prompt([
    {
      type: "list",
      name: "trigger",
      message: "When should docs sync?",
      choices: [
        { name: "On Push \u2014 Every push to tracked branch triggers sync", value: "on_push" },
        { name: "Scheduled \u2014 Sync on a cron schedule", value: "cron" },
        { name: "Manual \u2014 Only via CLI command", value: "manual" }
      ],
      default: "on_push"
    },
    {
      type: "input",
      name: "cron",
      message: "Cron expression (e.g., '0 */6 * * *' for every 6 hours):",
      when: (answers) => answers.trigger === "cron",
      default: "0 */6 * * *"
    },
    {
      type: "confirm",
      name: "impact_analysis",
      message: "Enable cross-file impact analysis?",
      default: true
    }
  ]);
  blank();
  log("info", "Theme");
  const themeAnswers = await inquirer2.prompt([
    {
      type: "list",
      name: "preset",
      message: "Theme preset:",
      choices: [
        { name: "Developer \u2014 Dark-first, code-dense, technical (Inter + Fira Code)", value: "developer" },
        { name: "Corporate \u2014 Clean, professional, B2B (Roboto)", value: "corporate" },
        { name: "Startup \u2014 Vibrant, modern, energetic (Inter + Fira Code)", value: "startup" },
        { name: "Minimal \u2014 Reading-focused, distraction-free (Source Serif)", value: "minimal" },
        new inquirer2.Separator("\u2500\u2500 Premium \u2500\u2500"),
        { name: "API Reference \u2014 Code-dense, integrated TOC (Team+)", value: "api-reference" },
        { name: "Knowledge Base \u2014 Readable, breadcrumbs, sticky tabs (Team+)", value: "knowledge-base" },
        new inquirer2.Separator("\u2500\u2500"),
        { name: "Custom \u2014 Choose your own palette and accent", value: "custom" }
      ],
      default: "developer"
    },
    {
      type: "list",
      name: "layout",
      message: "Layout mode:",
      choices: [
        { name: "Tabs \u2014 Top navigation tabs (default)", value: "tabs" },
        { name: "Sidebar \u2014 No tabs, TOC integrated in left sidebar", value: "sidebar" },
        { name: "Sticky Tabs \u2014 Tabs that stay visible on scroll", value: "tabs-sticky" }
      ],
      default: "tabs"
    },
    {
      type: "list",
      name: "palette",
      message: "Color palette:",
      choices: [
        { name: "Slate (dark)", value: "slate" },
        { name: "Default (light)", value: "default" },
        { name: "Indigo", value: "indigo" },
        { name: "Teal", value: "teal" },
        { name: "Deep Purple", value: "deep-purple" }
      ],
      default: "slate",
      when: (answers) => answers.preset === "custom"
    },
    {
      type: "input",
      name: "accent",
      message: "Accent color (hex):",
      default: "#5de4c7",
      when: (answers) => answers.preset === "custom"
    }
  ]);
  const config = {
    source: {
      repo: repoAnswers.repo,
      branch,
      include: DEFAULT_INCLUDES,
      exclude: DEFAULT_EXCLUDES,
      languages: "auto",
      provider: detectProvider(repoAnswers.repo)
    },
    analysis: {
      depth: analysisAnswers.depth,
      ai_summaries: aiResult.enabled,
      ...aiResult.enabled && aiResult.providerName && {
        ai_provider: {
          name: aiResult.providerName,
          ...aiResult.model && { model: aiResult.model }
        }
      },
      dependency_graph: analysisAnswers.dependency_graph,
      changelog: analysisAnswers.changelog,
      changelog_depth: 100,
      config_docs: true,
      max_file_size: 5e5,
      concurrency: 4
    },
    sync: {
      trigger: syncAnswers.trigger,
      ...syncAnswers.cron && { cron: syncAnswers.cron },
      diff_strategy: "incremental",
      impact_analysis: syncAnswers.impact_analysis,
      state_file: ".docwalk/state.json",
      auto_commit: false,
      commit_message: "docs: update documentation [docwalk]"
    },
    deploy: {
      provider: deployAnswers.provider,
      project: deployAnswers.project,
      auto_ssl: true,
      output_dir: "site"
    },
    domain: {
      ...domainAnswers.custom && { custom: domainAnswers.custom },
      base_path: domainAnswers.base_path,
      dns_auto: domainAnswers.dns_auto ?? true
    },
    theme: {
      preset: themeAnswers.preset,
      layout: themeAnswers.layout || "tabs",
      ...themeAnswers.palette && { palette: themeAnswers.palette },
      ...themeAnswers.accent && { accent: themeAnswers.accent },
      features: DEFAULT_FEATURES
    },
    versioning: {
      enabled: false,
      source: "tags",
      tag_pattern: "^v\\d+\\.\\d+\\.\\d+$",
      default_alias: "latest",
      max_versions: 10
    }
  };
  await writeConfigAndScaffold(config);
  const { confirm: shouldSetupCI } = await inquirer2.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Generate CI/CD pipeline config?",
      default: true
    }
  ]);
  if (shouldSetupCI) {
    log("info", "Generating CI/CD configuration...");
    log(
      "success",
      `Run ${chalk2.cyan("docwalk ci-setup")} to generate the pipeline config`
    );
  }
  blank();
  log("success", "DocWalk initialized!");
  blank();
  console.log(chalk2.dim("  Next steps:"));
  console.log(`    1. ${chalk2.cyan("docwalk generate")}  \u2014 Analyze and generate docs`);
  console.log(`    2. ${chalk2.cyan("docwalk dev")}       \u2014 Preview locally`);
  console.log(`    3. ${chalk2.cyan("docwalk deploy")}    \u2014 Deploy to ${deployAnswers.provider}`);
  blank();
}
async function writeConfigAndScaffold(config) {
  const configPath = path.resolve("docwalk.config.yml");
  const yamlContent = yaml.dump(config, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false
  });
  await writeFile(configPath, `# DocWalk Configuration
# Generated by 'docwalk init'
# Docs: https://docwalk.dev/config

${yamlContent}`);
  blank();
  log("success", `Configuration written to ${chalk2.cyan("docwalk.config.yml")}`);
  await mkdir(".docwalk", { recursive: true });
  const gitignorePath = path.resolve(".docwalk/.gitignore");
  await writeFile(gitignorePath, "state.json\nmanifest.json\n.env\n");
}
function detectProvider(repo) {
  if (repo === "." || repo.startsWith("/") || repo.startsWith("./") || repo.startsWith("../")) {
    return "local";
  }
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
    return "local";
  } catch {
    return repo.includes("/") ? "github" : "local";
  }
}
async function detectCurrentRepo() {
  try {
    const { execa } = await import("execa");
    const result = await execa("git", [
      "remote",
      "get-url",
      "origin"
    ]);
    const url = result.stdout.trim();
    const match = url.match(
      /github\.com[:/]([^/]+\/[^/.]+)/
    );
    if (match) return match[1];
    return url;
  } catch {
    return ".";
  }
}
async function writeDefaultConfig(options) {
  const repo = options.repo || ".";
  const config = {
    source: {
      repo,
      branch: "main",
      include: DEFAULT_INCLUDES,
      exclude: DEFAULT_EXCLUDES,
      languages: "auto",
      provider: detectProvider(repo)
    },
    analysis: { depth: "full", ai_summaries: false, dependency_graph: true, changelog: true, changelog_depth: 100, config_docs: true, types_page: true, dependencies_page: true, usage_guide_page: true, max_file_size: 5e5, concurrency: 4 },
    sync: { trigger: "on_push", diff_strategy: "incremental", impact_analysis: true, state_file: ".docwalk/state.json", auto_commit: false, commit_message: "docs: update documentation [docwalk]" },
    deploy: { provider: options.provider || "gh-pages", project: `${repo.split("/").pop()}-docs`, auto_ssl: true, output_dir: "site" },
    domain: { ...options.domain && { custom: options.domain }, base_path: "/", dns_auto: true },
    theme: { preset: options.theme || "developer", layout: options.layout || "tabs", palette: "slate", accent: "#5de4c7", features: DEFAULT_FEATURES },
    versioning: { enabled: false, source: "tags", default_alias: "latest", max_versions: 10 }
  };
  const yamlContent = yaml.dump(config, { indent: 2, lineWidth: 100, noRefs: true });
  await writeFile("docwalk.config.yml", `# DocWalk Configuration

${yamlContent}`);
  await mkdir(".docwalk", { recursive: true });
  await writeFile(path.resolve(".docwalk/.gitignore"), "state.json\nmanifest.json\n.env\n");
  log("success", `Configuration written to ${chalk2.cyan("docwalk.config.yml")}`);
}
export {
  initCommand
};
