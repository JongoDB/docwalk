/**
 * DocWalk CLI — init command
 *
 * Interactive setup wizard with two tracks:
 *   Quick Start — 3 steps: confirm repo, AI setup, theme → generate
 *   Custom — Full 6-step wizard (repo, analysis, deploy, domain, sync, theme)
 */

import inquirer from "inquirer";
import chalk from "chalk";
import { writeFile, mkdir } from "fs/promises";
import { execSync } from "child_process";
import path from "path";
import yaml from "js-yaml";
import { log, header, blank } from "../../utils/logger.js";
import { runAISetup } from "../flows/ai-setup.js";

interface InitOptions {
  repo?: string;
  provider?: string;
  domain?: string;
  theme?: string;
  layout?: string;
  interactive?: boolean;
  /** When true, skip the "Generate now?" prompt (called from generate's auto-init). */
  _skipGenerate?: boolean;
}

/** Default file include patterns shared by both tracks. */
const DEFAULT_INCLUDES = [
  "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx",
  "**/*.py", "**/*.go", "**/*.rs", "**/*.java", "**/*.rb", "**/*.php",
  "**/*.cs", "**/*.c", "**/*.h", "**/*.cpp", "**/*.hpp", "**/*.cc", "**/*.cxx",
  "**/*.swift", "**/*.kt", "**/*.kts", "**/*.scala",
  "**/*.sh", "**/*.bash",
  "**/*.yaml", "**/*.yml",
  "**/*.tf", "**/*.hcl",
  "**/*.md",
  "**/*.json",
  "**/*.toml", "**/*.xml",
  "**/*.sql",
  "**/*.dockerfile", "**/Dockerfile",
];

const DEFAULT_EXCLUDES = [
  "node_modules/**", "dist/**", "build/**", "out/**",
  ".git/**", ".next/**", "vendor/**", "__pycache__/**",
  "venv/**", ".venv/**", "target/**",
  "**/*.test.*", "**/*.spec.*", "**/__tests__/**",
  "**/test/**", "**/tests/**", "coverage/**", ".docwalk/**",
  "docwalk-output/**", "site/**",
  "**/*.d.ts", "**/*.min.js", "**/migrations/**",
];

const DEFAULT_FEATURES = [
  "navigation.tabs",
  "navigation.sections",
  "navigation.expand",
  "navigation.top",
  "search.suggest",
  "search.highlight",
  "content.code.copy",
  "content.tabs.link",
];

export async function initCommand(options: InitOptions): Promise<void> {
  header("Initialize DocWalk");

  const interactive = options.interactive !== false;

  if (!interactive) {
    await writeDefaultConfig(options);
    return;
  }

  // ── Choose setup mode ──────────────────────────────────────────────────
  const { mode } = await inquirer.prompt([
    {
      type: "list",
      name: "mode",
      message: "Setup mode:",
      choices: [
        { name: "Quick Start — analyze code, generate docs, done", value: "quick" },
        { name: "Custom     — configure deploy, sync, domain, theme", value: "custom" },
      ],
    },
  ]);

  if (mode === "quick") {
    await quickStartTrack(options);
  } else {
    await customTrack(options);
  }
}

// ─── Quick Start Track ──────────────────────────────────────────────────────

async function quickStartTrack(options: InitOptions): Promise<void> {
  // Step 1: Confirm repository
  const detectedRepo = options.repo || await detectCurrentRepo();

  const { repo } = await inquirer.prompt([
    {
      type: "input",
      name: "repo",
      message: "Repository:",
      default: detectedRepo,
      validate: (input: string) => input.length > 0 || "Repository is required",
    },
  ]);

  // Detect branch
  let branch = "main";
  try {
    const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
    if (currentBranch) branch = currentBranch;
  } catch {
    // Not in a git repo, use default
  }

  // Step 2: AI setup
  blank();
  const aiResult = await runAISetup();

  // Step 3: Theme
  blank();
  const { preset } = await inquirer.prompt([
    {
      type: "list",
      name: "preset",
      message: "Theme:",
      choices: [
        { name: "Developer — Dark-first, code-dense, technical", value: "developer" },
        { name: "Corporate — Clean, professional", value: "corporate" },
        { name: "Startup   — Vibrant, modern", value: "startup" },
        { name: "Minimal   — Reading-focused, distraction-free", value: "minimal" },
      ],
      default: "developer",
    },
  ]);

  // Build config with sensible defaults
  const repoName = repo.split("/").pop() || "docs";
  const config: Record<string, any> = {
    source: {
      repo,
      branch,
      include: DEFAULT_INCLUDES,
      exclude: DEFAULT_EXCLUDES,
      languages: "auto",
      provider: detectProvider(repo),
    },
    analysis: {
      depth: "full",
      ai_summaries: aiResult.enabled,
      ...(aiResult.enabled && aiResult.providerName && {
        ai_provider: {
          name: aiResult.providerName,
          ...(aiResult.model && { model: aiResult.model }),
        },
      }),
      dependency_graph: true,
      changelog: true,
      changelog_depth: 100,
      config_docs: true,
      max_file_size: 500_000,
      concurrency: 4,
    },
    sync: {
      trigger: "on_push",
      diff_strategy: "incremental",
      impact_analysis: true,
      state_file: ".docwalk/state.json",
      auto_commit: false,
      commit_message: "docs: update documentation [docwalk]",
    },
    deploy: {
      provider: "gh-pages",
      project: `${repoName}-docs`,
      auto_ssl: true,
      output_dir: "site",
    },
    domain: {
      base_path: "/",
      dns_auto: true,
    },
    theme: {
      preset,
      layout: "tabs",
      features: DEFAULT_FEATURES,
    },
    versioning: {
      enabled: false,
      source: "tags",
      tag_pattern: "^v\\d+\\.\\d+\\.\\d+$",
      default_alias: "latest",
      max_versions: 10,
    },
  };

  await writeConfigAndScaffold(config);

  // If called from generate's auto-init, skip the prompt — generate will continue itself
  if (options._skipGenerate) {
    return;
  }

  // Offer to generate immediately
  blank();
  const { generateNow } = await inquirer.prompt([
    {
      type: "confirm",
      name: "generateNow",
      message: "Generate documentation now?",
      default: true,
    },
  ]);

  if (generateNow) {
    blank();
    const { clearConfigCache } = await import("../../config/loader.js");
    clearConfigCache();
    const { generateCommand } = await import("./generate.js");
    await generateCommand({ output: "docwalk-output" });
  } else {
    blank();
    console.log(chalk.dim("  Next steps:"));
    console.log(`    1. ${chalk.cyan("docwalk generate")}  — Analyze and generate docs`);
    console.log(`    2. ${chalk.cyan("docwalk dev")}       — Preview locally`);
    blank();
  }
}

// ─── Custom Track ───────────────────────────────────────────────────────────

async function customTrack(options: InitOptions): Promise<void> {
  // ── Step 1: Repository ──────────────────────────────────────────────────
  const repoAnswers = await inquirer.prompt([
    {
      type: "input",
      name: "repo",
      message: "Repository (owner/repo or local path):",
      default: options.repo || await detectCurrentRepo(),
      validate: (input: string) =>
        input.length > 0 || "Repository is required",
    },
    {
      type: "list",
      name: "branch",
      message: "Branch to track:",
      choices: ["main", "master", "develop", "Other"],
      default: "main",
    },
    {
      type: "input",
      name: "branchCustom",
      message: "Enter branch name:",
      when: (answers: any) => answers.branch === "Other",
    },
  ]);

  const branch =
    repoAnswers.branch === "Other"
      ? repoAnswers.branchCustom
      : repoAnswers.branch;

  // ── Step 2: Analysis + AI Setup ─────────────────────────────────────────
  blank();
  log("info", "Analysis Configuration");

  const analysisAnswers = await inquirer.prompt([
    {
      type: "list",
      name: "depth",
      message: "Analysis depth:",
      choices: [
        { name: "Full — AST, cross-refs, dependency graph, everything", value: "full" },
        { name: "Surface — File-level overview, exports, top-level docs", value: "surface" },
        { name: "API Only — Public API surface (exports, types, interfaces)", value: "api-only" },
      ],
      default: "full",
    },
    {
      type: "confirm",
      name: "dependency_graph",
      message: "Generate dependency graph?",
      default: true,
    },
    {
      type: "confirm",
      name: "changelog",
      message: "Auto-generate changelog from git history?",
      default: true,
    },
  ]);

  // Use the interactive AI setup flow instead of the old env-var dead-end
  blank();
  const aiResult = await runAISetup();

  // ── Step 3: Deploy Provider ─────────────────────────────────────────────
  blank();
  log("info", "Deployment Configuration");

  const deployAnswers = await inquirer.prompt([
    {
      type: "list",
      name: "provider",
      message: "Hosting provider:",
      choices: [
        { name: "GitHub Pages — Free for public repos, Actions-based", value: "gh-pages" },
        { name: "Cloudflare Pages — Global edge, Wrangler CLI", value: "cloudflare" },
        { name: "Vercel — Instant deploys, preview URLs", value: "vercel" },
        { name: "Netlify — Git-based, form handling", value: "netlify" },
        { name: "AWS S3 — S3 bucket + optional CloudFront", value: "s3" },
      ],
      default: options.provider || "gh-pages",
    },
    {
      type: "input",
      name: "project",
      message: "Project name on hosting platform:",
      default: (answers: any) => {
        const repoName = repoAnswers.repo.split("/").pop() || "docs";
        return `${repoName}-docs`;
      },
    },
  ]);

  // ── Step 4: Domain ──────────────────────────────────────────────────────
  blank();
  log("info", "Domain Configuration");

  const domainAnswers = await inquirer.prompt([
    {
      type: "confirm",
      name: "useCustomDomain",
      message: "Configure a custom domain?",
      default: !!options.domain,
    },
    {
      type: "input",
      name: "custom",
      message: "Custom domain (e.g., docs.yourcompany.com):",
      default: options.domain,
      when: (answers: any) => answers.useCustomDomain,
      validate: (input: string) => {
        if (!input.includes(".")) return "Enter a valid domain";
        return true;
      },
    },
    {
      type: "input",
      name: "base_path",
      message: "Base path (e.g., /project-name, or / for root):",
      default: "/",
    },
    {
      type: "confirm",
      name: "dns_auto",
      message: "Auto-configure DNS via provider API?",
      default: true,
      when: (answers: any) => answers.useCustomDomain,
    },
  ]);

  // ── Step 5: Sync Strategy ───────────────────────────────────────────────
  blank();
  log("info", "Sync Strategy");

  const syncAnswers = await inquirer.prompt([
    {
      type: "list",
      name: "trigger",
      message: "When should docs sync?",
      choices: [
        { name: "On Push — Every push to tracked branch triggers sync", value: "on_push" },
        { name: "Scheduled — Sync on a cron schedule", value: "cron" },
        { name: "Manual — Only via CLI command", value: "manual" },
      ],
      default: "on_push",
    },
    {
      type: "input",
      name: "cron",
      message: "Cron expression (e.g., '0 */6 * * *' for every 6 hours):",
      when: (answers: any) => answers.trigger === "cron",
      default: "0 */6 * * *",
    },
    {
      type: "confirm",
      name: "impact_analysis",
      message: "Enable cross-file impact analysis?",
      default: true,
    },
  ]);

  // ── Step 6: Theme ───────────────────────────────────────────────────────
  blank();
  log("info", "Theme");

  const themeAnswers = await inquirer.prompt([
    {
      type: "list",
      name: "preset",
      message: "Theme preset:",
      choices: [
        { name: "Developer — Dark-first, code-dense, technical (Inter + Fira Code)", value: "developer" },
        { name: "Corporate — Clean, professional, B2B (Roboto)", value: "corporate" },
        { name: "Startup — Vibrant, modern, energetic (Inter + Fira Code)", value: "startup" },
        { name: "Minimal — Reading-focused, distraction-free (Source Serif)", value: "minimal" },
        new inquirer.Separator("── Premium ──"),
        { name: "API Reference — Code-dense, integrated TOC (Team+)", value: "api-reference" },
        { name: "Knowledge Base — Readable, breadcrumbs, sticky tabs (Team+)", value: "knowledge-base" },
        new inquirer.Separator("──"),
        { name: "Custom — Choose your own palette and accent", value: "custom" },
      ],
      default: "developer",
    },
    {
      type: "list",
      name: "layout",
      message: "Layout mode:",
      choices: [
        { name: "Tabs — Top navigation tabs (default)", value: "tabs" },
        { name: "Sidebar — No tabs, TOC integrated in left sidebar", value: "sidebar" },
        { name: "Sticky Tabs — Tabs that stay visible on scroll", value: "tabs-sticky" },
      ],
      default: "tabs",
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
        { name: "Deep Purple", value: "deep-purple" },
      ],
      default: "slate",
      when: (answers: any) => answers.preset === "custom",
    },
    {
      type: "input",
      name: "accent",
      message: "Accent color (hex):",
      default: "#5de4c7",
      when: (answers: any) => answers.preset === "custom",
    },
  ]);

  // ── Build Config ────────────────────────────────────────────────────────
  const config: Record<string, any> = {
    source: {
      repo: repoAnswers.repo,
      branch,
      include: DEFAULT_INCLUDES,
      exclude: DEFAULT_EXCLUDES,
      languages: "auto",
      provider: detectProvider(repoAnswers.repo),
    },
    analysis: {
      depth: analysisAnswers.depth,
      ai_summaries: aiResult.enabled,
      ...(aiResult.enabled && aiResult.providerName && {
        ai_provider: {
          name: aiResult.providerName,
          ...(aiResult.model && { model: aiResult.model }),
        },
      }),
      dependency_graph: analysisAnswers.dependency_graph,
      changelog: analysisAnswers.changelog,
      changelog_depth: 100,
      config_docs: true,
      max_file_size: 500_000,
      concurrency: 4,
    },
    sync: {
      trigger: syncAnswers.trigger,
      ...(syncAnswers.cron && { cron: syncAnswers.cron }),
      diff_strategy: "incremental",
      impact_analysis: syncAnswers.impact_analysis,
      state_file: ".docwalk/state.json",
      auto_commit: false,
      commit_message: "docs: update documentation [docwalk]",
    },
    deploy: {
      provider: deployAnswers.provider,
      project: deployAnswers.project,
      auto_ssl: true,
      output_dir: "site",
    },
    domain: {
      ...(domainAnswers.custom && { custom: domainAnswers.custom }),
      base_path: domainAnswers.base_path,
      dns_auto: domainAnswers.dns_auto ?? true,
    },
    theme: {
      preset: themeAnswers.preset,
      layout: themeAnswers.layout || "tabs",
      ...(themeAnswers.palette && { palette: themeAnswers.palette }),
      ...(themeAnswers.accent && { accent: themeAnswers.accent }),
      features: DEFAULT_FEATURES,
    },
    versioning: {
      enabled: false,
      source: "tags",
      tag_pattern: "^v\\d+\\.\\d+\\.\\d+$",
      default_alias: "latest",
      max_versions: 10,
    },
  };

  await writeConfigAndScaffold(config);

  // ── Generate CI/CD config ─────────────────────────────────────────────
  const { confirm: shouldSetupCI } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Generate CI/CD pipeline config?",
      default: true,
    },
  ]);

  if (shouldSetupCI) {
    log("info", "Generating CI/CD configuration...");
    log(
      "success",
      `Run ${chalk.cyan("docwalk ci-setup")} to generate the pipeline config`
    );
  }

  // ── Next Steps ─────────────────────────────────────────────────────────
  blank();
  log("success", "DocWalk initialized!");
  blank();
  console.log(chalk.dim("  Next steps:"));
  console.log(`    1. ${chalk.cyan("docwalk generate")}  — Analyze and generate docs`);
  console.log(`    2. ${chalk.cyan("docwalk dev")}       — Preview locally`);
  console.log(`    3. ${chalk.cyan("docwalk deploy")}    — Deploy to ${deployAnswers.provider}`);
  blank();
}

// ─── Shared Helpers ─────────────────────────────────────────────────────────

/** Write config file and scaffold .docwalk directory. */
async function writeConfigAndScaffold(config: Record<string, any>): Promise<void> {
  const configPath = path.resolve("docwalk.config.yml");
  const yamlContent = yaml.dump(config, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });

  await writeFile(configPath, `# DocWalk Configuration\n# Generated by 'docwalk init'\n# Docs: https://docwalk.dev/config\n\n${yamlContent}`);

  blank();
  log("success", `Configuration written to ${chalk.cyan("docwalk.config.yml")}`);

  // Create .docwalk directory
  await mkdir(".docwalk", { recursive: true });

  // Create .gitignore (includes .env for API key storage)
  const gitignorePath = path.resolve(".docwalk/.gitignore");
  await writeFile(gitignorePath, "state.json\nmanifest.json\n.env\n");
}

/**
 * Detect whether to use "local" or "github" provider based on repo input.
 */
function detectProvider(repo: string): "local" | "github" {
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

async function detectCurrentRepo(): Promise<string> {
  try {
    const { execa } = await import("execa");
    const result = await execa("git", [
      "remote",
      "get-url",
      "origin",
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

async function writeDefaultConfig(options: InitOptions): Promise<void> {
  const repo = options.repo || ".";
  const config = {
    source: {
      repo,
      branch: "main",
      include: DEFAULT_INCLUDES,
      exclude: DEFAULT_EXCLUDES,
      languages: "auto",
      provider: detectProvider(repo),
    },
    analysis: { depth: "full", ai_summaries: false, dependency_graph: true, changelog: true, changelog_depth: 100, config_docs: true, types_page: true, dependencies_page: true, usage_guide_page: true, max_file_size: 500000, concurrency: 4 },
    sync: { trigger: "on_push", diff_strategy: "incremental", impact_analysis: true, state_file: ".docwalk/state.json", auto_commit: false, commit_message: "docs: update documentation [docwalk]" },
    deploy: { provider: options.provider || "gh-pages", project: `${repo.split("/").pop()}-docs`, auto_ssl: true, output_dir: "site" },
    domain: { ...(options.domain && { custom: options.domain }), base_path: "/", dns_auto: true },
    theme: { preset: options.theme || "developer", layout: options.layout || "tabs", palette: "slate", accent: "#5de4c7", features: DEFAULT_FEATURES },
    versioning: { enabled: false, source: "tags", default_alias: "latest", max_versions: 10 },
  };

  const yamlContent = yaml.dump(config, { indent: 2, lineWidth: 100, noRefs: true });
  await writeFile("docwalk.config.yml", `# DocWalk Configuration\n\n${yamlContent}`);
  await mkdir(".docwalk", { recursive: true });
  await writeFile(path.resolve(".docwalk/.gitignore"), "state.json\nmanifest.json\n.env\n");

  log("success", `Configuration written to ${chalk.cyan("docwalk.config.yml")}`);
}
