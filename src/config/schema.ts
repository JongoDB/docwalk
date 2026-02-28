/**
 * DocWalk Configuration Schema
 *
 * Defines and validates the docwalk.config.yml structure.
 * Every configurable aspect of DocWalk flows through this schema.
 */

import { z } from "zod";

// ─── Source Configuration ───────────────────────────────────────────────────

export const SourceSchema = z.object({
  /** GitHub/GitLab/Bitbucket repo in owner/name format, or local path */
  repo: z.string().describe("Repository identifier (owner/repo) or local path"),

  /** Branch to track for documentation */
  branch: z.string().default("main"),

  /** Glob patterns for files to include in analysis */
  include: z.array(z.string()).default([
    "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx",
    "**/*.py", "**/*.pyi",
    "**/*.go",
    "**/*.rs",
    "**/*.java",
    "**/*.cs",
    "**/*.rb",
    "**/*.php",
    "**/*.sh", "**/*.bash",
    "**/*.yaml", "**/*.yml",
    "**/*.tf", "**/*.hcl",
    "**/*.md",
    "**/*.json",
    "**/*.toml",
    "**/*.xml",
    "**/*.sql",
    "**/*.dockerfile", "**/Dockerfile",
    "**/*.c", "**/*.h",
    "**/*.cpp", "**/*.hpp", "**/*.cc", "**/*.cxx",
    "**/*.swift",
    "**/*.kt", "**/*.kts",
    "**/*.scala",
  ]),

  /** Glob patterns for files to exclude from analysis */
  exclude: z
    .array(z.string())
    .default([
      "node_modules/**",
      "dist/**",
      "build/**",
      "out/**",
      ".git/**",
      ".next/**",
      ".nuxt/**",
      ".output/**",
      "vendor/**",
      "__pycache__/**",
      "venv/**",
      ".venv/**",
      "env/**",
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
      "**/migrations/**",
    ]),

  /** Language detection mode — 'auto' detects from file extensions */
  languages: z
    .union([z.literal("auto"), z.array(z.string())])
    .default("auto"),

  /** Remote provider type for API-based repo access */
  provider: z
    .enum(["github", "gitlab", "bitbucket", "local"])
    .default("github"),
});

// ─── Analysis Configuration ─────────────────────────────────────────────────

export const AnalysisSchema = z.object({
  /**
   * Analysis depth:
   * - full: AST parsing, cross-refs, dependency graphs, everything
   * - surface: File-level overview, exports, top-level docs
   * - api-only: Only public API surface (exports, types, interfaces)
   */
  depth: z.enum(["full", "surface", "api-only"]).default("full"),

  /** Enable AI-powered summaries for modules and functions */
  ai_summaries: z.boolean().default(false),

  /** AI provider for summaries and narrative generation */
  ai_provider: z
    .object({
      name: z.enum(["openai", "anthropic", "gemini", "ollama", "openrouter", "local", "docwalk-proxy"]).default("anthropic"),
      model: z.string().optional(),
      api_key_env: z
        .string()
        .default("DOCWALK_AI_KEY")
        .describe("Environment variable name holding the API key"),
      base_url: z.string().optional().describe("Custom base URL for the provider (e.g., Ollama endpoint)"),
    })
    .optional(),

  /** Generate dependency graph visualization */
  dependency_graph: z.boolean().default(true),

  /** Auto-generate changelog from git history */
  changelog: z.boolean().default(true),

  /** Max number of git log entries for changelog */
  changelog_depth: z.number().int().positive().default(100),

  /** Extract and document configuration schemas */
  config_docs: z.boolean().default(true),

  /** Generate aggregate types/interfaces page */
  types_page: z.boolean().default(true),

  /** Generate external dependencies listing page */
  dependencies_page: z.boolean().default(true),

  /** Generate "How to use these docs" usage guide page */
  usage_guide_page: z.boolean().default(false),

  /** Maximum file size to analyze (bytes) — skip huge generated files */
  max_file_size: z.number().int().positive().default(500_000),

  /** Parallelism for analysis workers */
  concurrency: z.number().int().positive().default(4),

  /** Audience separation: auto-detect library vs app, split into user/dev tabs, or unified */
  audience: z.enum(["auto", "unified", "split"]).default("split"),

  /** Multi-level architecture pages (system → package → module) */
  architecture_tiers: z.boolean().default(true),

  /** Generate Software Bill of Materials page */
  sbom: z.boolean().default(true),

  /** Add GitHub source links on symbols */
  source_links: z.boolean().default(true),

  /** Generate code insights page (static analyzers) */
  insights: z.boolean().default(true),

  /** Enable AI-powered insights (requires license + API key) */
  insights_ai: z.boolean().default(false),

  /** Enable AI-generated narrative prose on pages (requires AI provider) */
  ai_narrative: z.boolean().default(false),

  /** Enable AI-generated diagrams (sequence, flowcharts) */
  ai_diagrams: z.boolean().default(false),

  /** Enable AI-driven dynamic page structure suggestions */
  ai_structure: z.boolean().default(false),

  /** Enable monorepo workspace package resolution for dependency graphs */
  monorepo: z.boolean().default(true),

  /** Generate end-user documentation (user guides, troubleshooting, FAQ) */
  user_docs: z.boolean().default(true),

  /** Per-page toggles for end-user documentation */
  user_docs_config: z.object({
    overview: z.boolean().default(true),
    getting_started: z.boolean().default(true),
    features: z.boolean().default(true),
    troubleshooting: z.boolean().default(true),
    faq: z.boolean().default(true),
    section_title: z.string().default("User Guide"),
  }).optional(),

  /** Enable Q&A chat widget in generated docs (Team feature) */
  qa_widget: z.boolean().default(false),

  /** Q&A widget configuration */
  qa_config: z.object({
    provider: z.enum(["openai", "anthropic", "gemini", "ollama", "local"]).default("openai"),
    model: z.string().optional(),
    embedding_model: z.string().default("text-embedding-3-small"),
    context_window: z.number().default(4000),
    position: z.enum(["bottom-right", "bottom-left"]).default("bottom-right"),
    greeting: z.string().default("Ask me anything about this project."),
    daily_limit: z.number().default(50),
    api_key_env: z.string().optional().describe("Environment variable name for Q&A API key (overrides ai_provider key)"),
    base_url: z.string().optional().describe("Custom base URL for Q&A embedding provider"),
  }).optional(),
});

// ─── Sync Configuration ─────────────────────────────────────────────────────

export const SyncSchema = z.object({
  /**
   * When to trigger doc sync:
   * - on_push: CI triggers on every push to tracked branch
   * - cron: Scheduled interval
   * - manual: Only via `docwalk sync` CLI
   * - webhook: HTTP endpoint trigger
   */
  trigger: z.enum(["on_push", "cron", "manual", "webhook"]).default("on_push"),

  /** Cron expression for scheduled sync (only used when trigger=cron) */
  cron: z.string().optional(),

  /** Diff strategy — incremental only re-analyzes changed files */
  diff_strategy: z.enum(["incremental", "full"]).default("incremental"),

  /** Cross-file impact analysis — detect downstream doc changes */
  impact_analysis: z.boolean().default(true),

  /** Commit SHA storage location */
  state_file: z.string().default(".docwalk/state.json"),

  /** Auto-commit generated docs back to repo (for gh-pages flow) */
  auto_commit: z.boolean().default(false),

  /** Commit message template for auto-commit */
  commit_message: z
    .string()
    .default("docs: update documentation [docwalk]"),
});

// ─── Deploy Configuration ───────────────────────────────────────────────────

export const DeploySchema = z.object({
  /**
   * Hosting provider:
   * - gh-pages: GitHub Pages via Actions
   * - cloudflare: Cloudflare Pages via Wrangler
   * - vercel: Vercel via CLI/API
   * - netlify: Netlify via CLI
   * - s3: AWS S3 + optional CloudFront
   */
  provider: z
    .enum(["gh-pages", "cloudflare", "vercel", "netlify", "s3"])
    .default("gh-pages"),

  /** Project name on the hosting platform */
  project: z.string().optional(),

  /** Automatic SSL provisioning */
  auto_ssl: z.boolean().default(true),

  /** Build output directory */
  output_dir: z.string().default("site"),

  /** Provider-specific configuration overrides */
  provider_config: z.record(z.string(), z.unknown()).optional(),
});

// ─── Domain Configuration ───────────────────────────────────────────────────

export const DomainSchema = z.object({
  /** Custom domain for docs */
  custom: z.string().optional(),

  /** Base path prefix (e.g., /cyroid for docs.example.com/cyroid) */
  base_path: z.string().default("/"),

  /** Auto-configure DNS records via provider API */
  dns_auto: z.boolean().default(true),

  /** Additional domain aliases */
  aliases: z.array(z.string()).optional(),
});

// ─── Theme Configuration ────────────────────────────────────────────────────

export const ThemeSchema = z.object({
  /** Theme preset — provides palette, fonts, features, and custom CSS out of the box.
   *  Built-in: corporate, startup, developer, minimal (free) + api-reference, knowledge-base (premium).
   *  Additional presets can be registered via @docwalk/themes-premium or custom packages. */
  preset: z.string().default("developer"),

  /** Layout mode — controls tab/sidebar behavior */
  layout: z
    .enum(["tabs", "sidebar", "tabs-sticky"])
    .default("tabs"),

  /** MkDocs Material color palette preset */
  palette: z
    .enum(["default", "slate", "indigo", "deep-purple", "teal", "custom"])
    .default("slate"),

  /** Primary accent color (hex) */
  accent: z.string().default("#5de4c7"),

  /** Path to logo file */
  logo: z.string().optional(),

  /** Path to favicon */
  favicon: z.string().optional(),

  /** Material theme features to enable */
  features: z
    .array(z.string())
    .default([
      "navigation.tabs",
      "navigation.sections",
      "navigation.expand",
      "navigation.top",
      "search.suggest",
      "search.highlight",
      "content.code.copy",
      "content.tabs.link",
    ]),

  /** Custom CSS file paths */
  custom_css: z.array(z.string()).optional(),

  /** Custom JS file paths */
  custom_js: z.array(z.string()).optional(),

  /** Social links for footer */
  social: z
    .array(
      z.object({
        icon: z.string(),
        link: z.string(),
        name: z.string().optional(),
      })
    )
    .optional(),
});

// ─── Versioning Configuration ───────────────────────────────────────────────

export const VersioningSchema = z.object({
  /** Enable versioned documentation */
  enabled: z.boolean().default(false),

  /** Version source — git tags or branches */
  source: z.enum(["tags", "branches"]).default("tags"),

  /** Tag pattern to match (regex) */
  tag_pattern: z.string().default("^v\\d+\\.\\d+\\.\\d+$"),

  /** Default version alias (e.g., 'latest', 'stable') */
  default_alias: z.string().default("latest"),

  /** Maximum number of versions to keep deployed */
  max_versions: z.number().int().positive().default(10),
});

// ─── Plugins Configuration ──────────────────────────────────────────────────

export const PluginSchema = z.object({
  /** Plugin package name or local path */
  name: z.string(),

  /** Plugin-specific configuration */
  config: z.record(z.string(), z.unknown()).optional(),

  /** Whether plugin is enabled */
  enabled: z.boolean().default(true),
});

// ─── Hooks Configuration ────────────────────────────────────────────────────

export const HooksSchema = z.object({
  /** Run before analysis */
  pre_analyze: z.array(z.string()).optional(),

  /** Run after analysis */
  post_analyze: z.array(z.string()).optional(),

  /** Run before MkDocs build */
  pre_build: z.array(z.string()).optional(),

  /** Run after MkDocs build */
  post_build: z.array(z.string()).optional(),

  /** Run before deploy */
  pre_deploy: z.array(z.string()).optional(),

  /** Run after deploy */
  post_deploy: z.array(z.string()).optional(),
});

// ─── Root Configuration ─────────────────────────────────────────────────────

export const DocWalkConfigSchema = z.object({
  /** Source repository configuration */
  source: SourceSchema,

  /** Analysis engine configuration */
  analysis: AnalysisSchema.default({}),

  /** Sync strategy configuration */
  sync: SyncSchema.default({}),

  /** Deployment configuration */
  deploy: DeploySchema.default({}),

  /** Domain routing configuration */
  domain: DomainSchema.default({}),

  /** Theme and appearance */
  theme: ThemeSchema.default({}),

  /** Documentation versioning */
  versioning: VersioningSchema.default({}),

  /** Plugins */
  plugins: z.array(PluginSchema).optional(),

  /** Lifecycle hooks */
  hooks: HooksSchema.optional(),

  /** License key for premium features (themes, AI summaries, etc.) */
  license_key: z.string().optional(),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type DocWalkConfig = z.infer<typeof DocWalkConfigSchema>;
export type SourceConfig = z.infer<typeof SourceSchema>;
export type AnalysisConfig = z.infer<typeof AnalysisSchema>;
export type SyncConfig = z.infer<typeof SyncSchema>;
export type DeployConfig = z.infer<typeof DeploySchema>;
export type DomainConfig = z.infer<typeof DomainSchema>;
export type ThemeConfig = z.infer<typeof ThemeSchema>;
export type VersioningConfig = z.infer<typeof VersioningSchema>;
export type PluginConfig = z.infer<typeof PluginSchema>;
export type HooksConfig = z.infer<typeof HooksSchema>;
