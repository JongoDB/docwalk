/**
 * DocWalk CLI — init command
 *
 * Interactive setup wizard that walks the user through:
 * 1. Repository selection
 * 2. Language detection
 * 3. Analysis preferences
 * 4. Deploy provider selection
 * 5. Domain configuration
 * 6. Theme preferences
 * 7. Writes docwalk.config.yml
 * 8. Generates CI/CD config
 */

import inquirer from "inquirer";
import chalk from "chalk";
import { writeFile, mkdir } from "fs/promises";
import { execSync } from "child_process";
import path from "path";
import yaml from "js-yaml";
import { log, header, blank } from "../../utils/logger.js";
import type { DocWalkConfig } from "../../config/schema.js";

interface InitOptions {
  repo?: string;
  provider?: string;
  domain?: string;
  interactive?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  header("Initialize DocWalk");

  const interactive = options.interactive !== false;

  if (!interactive) {
    // Non-interactive: use defaults + provided flags
    await writeDefaultConfig(options);
    return;
  }

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

  // ── Step 2: Analysis ────────────────────────────────────────────────────
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
      name: "ai_summaries",
      message: "Enable AI-powered summaries? (requires API key)",
      default: false,
    },
    {
      type: "list",
      name: "ai_provider",
      message: "AI provider:",
      choices: ["anthropic", "openai", "local"],
      when: (answers: any) => answers.ai_summaries,
      default: "anthropic",
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
  const config: Partial<DocWalkConfig> = {
    source: {
      repo: repoAnswers.repo,
      branch,
      include: [
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
      ],
      exclude: [
        "node_modules/**", "dist/**", "build/**", "out/**",
        ".git/**", ".next/**", "vendor/**", "__pycache__/**",
        "venv/**", ".venv/**", "target/**",
        "**/*.test.*", "**/*.spec.*", "**/__tests__/**",
        "**/test/**", "**/tests/**", "coverage/**", ".docwalk/**",
        "docwalk-output/**", "site/**",
        "**/*.d.ts", "**/*.min.js", "**/migrations/**",
      ],
      languages: "auto",
      provider: detectProvider(repoAnswers.repo),
    },
    analysis: {
      depth: analysisAnswers.depth,
      ai_summaries: analysisAnswers.ai_summaries,
      ...(analysisAnswers.ai_summaries && {
        ai_provider: {
          name: analysisAnswers.ai_provider,
          api_key_env: "DOCWALK_AI_KEY",
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
      features: [
        "navigation.tabs",
        "navigation.sections",
        "navigation.expand",
        "navigation.top",
        "search.suggest",
        "search.highlight",
        "content.code.copy",
        "content.tabs.link",
      ],
    },
    versioning: {
      enabled: false,
      source: "tags",
      tag_pattern: "^v\\d+\\.\\d+\\.\\d+$",
      default_alias: "latest",
      max_versions: 10,
    },
  };

  // ── Write Config ────────────────────────────────────────────────────────
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

  // ── Create .docwalk directory ──────────────────────────────────────────
  await mkdir(".docwalk", { recursive: true });

  // ── Create .gitignore entry ────────────────────────────────────────────
  const gitignorePath = path.resolve(".docwalk/.gitignore");
  await writeFile(gitignorePath, "state.json\nmanifest.json\n");

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
    // This will be handled by the ci-setup command
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

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Detect whether to use "local" or "github" provider based on repo input.
 * If the repo is "." or an absolute/relative path, use "local".
 * If it looks like "owner/repo" format, check if we're in a local git checkout
 * of that repo — if so, use "local". Otherwise "github".
 */
function detectProvider(repo: string): "local" | "github" {
  // Explicit local paths
  if (repo === "." || repo.startsWith("/") || repo.startsWith("./") || repo.startsWith("../")) {
    return "local";
  }

  // If "owner/repo" format but we're currently inside a git repo, prefer local
  // (user likely cloned the repo and is running from inside it)
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
    return "local";
  } catch {
    // Not in a git repo — assume it's a remote GitHub reference
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

    // Parse GitHub URL → owner/repo
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
      include: [
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
      ],
      exclude: [
        "node_modules/**", "dist/**", "build/**", "out/**",
        ".git/**", ".next/**", "vendor/**", "__pycache__/**",
        "venv/**", ".venv/**", "target/**",
        "**/*.test.*", "**/*.spec.*", "**/__tests__/**",
        "**/test/**", "**/tests/**", "coverage/**", ".docwalk/**",
        "docwalk-output/**", "site/**",
        "**/*.d.ts", "**/*.min.js", "**/migrations/**",
      ],
      languages: "auto",
      provider: detectProvider(repo),
    },
    analysis: { depth: "full", ai_summaries: false, dependency_graph: true, changelog: true, changelog_depth: 100, config_docs: true, types_page: true, dependencies_page: true, usage_guide_page: true, max_file_size: 500000, concurrency: 4 },
    sync: { trigger: "on_push", diff_strategy: "incremental", impact_analysis: true, state_file: ".docwalk/state.json", auto_commit: false, commit_message: "docs: update documentation [docwalk]" },
    deploy: { provider: options.provider || "gh-pages", project: `${repo.split("/").pop()}-docs`, auto_ssl: true, output_dir: "site" },
    domain: { ...(options.domain && { custom: options.domain }), base_path: "/", dns_auto: true },
    theme: { preset: "developer", palette: "slate", accent: "#5de4c7", features: ["navigation.tabs", "navigation.sections", "search.suggest", "content.code.copy"] },
    versioning: { enabled: false, source: "tags", default_alias: "latest", max_versions: 10 },
  };

  const yamlContent = yaml.dump(config, { indent: 2, lineWidth: 100, noRefs: true });
  await writeFile("docwalk.config.yml", `# DocWalk Configuration\n\n${yamlContent}`);
  await mkdir(".docwalk", { recursive: true });

  log("success", `Configuration written to ${chalk.cyan("docwalk.config.yml")}`);
}
