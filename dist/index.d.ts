import { z } from 'zod';

/**
 * DocWalk Configuration Schema
 *
 * Defines and validates the docwalk.config.yml structure.
 * Every configurable aspect of DocWalk flows through this schema.
 */

declare const SourceSchema: z.ZodObject<{
    /** GitHub/GitLab/Bitbucket repo in owner/name format, or local path */
    repo: z.ZodString;
    /** Branch to track for documentation */
    branch: z.ZodDefault<z.ZodString>;
    /** Glob patterns for files to include in analysis */
    include: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Glob patterns for files to exclude from analysis */
    exclude: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Language detection mode — 'auto' detects from file extensions */
    languages: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"auto">, z.ZodArray<z.ZodString, "many">]>>;
    /** Remote provider type for API-based repo access */
    provider: z.ZodDefault<z.ZodEnum<["github", "gitlab", "bitbucket", "local"]>>;
}, "strip", z.ZodTypeAny, {
    repo: string;
    branch: string;
    include: string[];
    exclude: string[];
    languages: string[] | "auto";
    provider: "github" | "gitlab" | "bitbucket" | "local";
}, {
    repo: string;
    branch?: string | undefined;
    include?: string[] | undefined;
    exclude?: string[] | undefined;
    languages?: string[] | "auto" | undefined;
    provider?: "github" | "gitlab" | "bitbucket" | "local" | undefined;
}>;
declare const AnalysisSchema: z.ZodObject<{
    /**
     * Analysis depth:
     * - full: AST parsing, cross-refs, dependency graphs, everything
     * - surface: File-level overview, exports, top-level docs
     * - api-only: Only public API surface (exports, types, interfaces)
     */
    depth: z.ZodDefault<z.ZodEnum<["full", "surface", "api-only"]>>;
    /** Enable AI-powered summaries for modules and functions */
    ai_summaries: z.ZodDefault<z.ZodBoolean>;
    /** AI provider for summaries and narrative generation */
    ai_provider: z.ZodOptional<z.ZodObject<{
        name: z.ZodDefault<z.ZodEnum<["openai", "anthropic", "gemini", "ollama", "openrouter", "local", "docwalk-proxy"]>>;
        model: z.ZodOptional<z.ZodString>;
        api_key_env: z.ZodDefault<z.ZodString>;
        base_url: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: "local" | "openai" | "anthropic" | "gemini" | "ollama" | "openrouter" | "docwalk-proxy";
        api_key_env: string;
        model?: string | undefined;
        base_url?: string | undefined;
    }, {
        name?: "local" | "openai" | "anthropic" | "gemini" | "ollama" | "openrouter" | "docwalk-proxy" | undefined;
        model?: string | undefined;
        api_key_env?: string | undefined;
        base_url?: string | undefined;
    }>>;
    /** Generate dependency graph visualization */
    dependency_graph: z.ZodDefault<z.ZodBoolean>;
    /** Auto-generate changelog from git history */
    changelog: z.ZodDefault<z.ZodBoolean>;
    /** Max number of git log entries for changelog */
    changelog_depth: z.ZodDefault<z.ZodNumber>;
    /** Extract and document configuration schemas */
    config_docs: z.ZodDefault<z.ZodBoolean>;
    /** Generate aggregate types/interfaces page */
    types_page: z.ZodDefault<z.ZodBoolean>;
    /** Generate external dependencies listing page */
    dependencies_page: z.ZodDefault<z.ZodBoolean>;
    /** Generate "How to use these docs" usage guide page */
    usage_guide_page: z.ZodDefault<z.ZodBoolean>;
    /** Maximum file size to analyze (bytes) — skip huge generated files */
    max_file_size: z.ZodDefault<z.ZodNumber>;
    /** Parallelism for analysis workers */
    concurrency: z.ZodDefault<z.ZodNumber>;
    /** Audience separation: auto-detect library vs app, split into user/dev tabs, or unified */
    audience: z.ZodDefault<z.ZodEnum<["auto", "unified", "split"]>>;
    /** Multi-level architecture pages (system → package → module) */
    architecture_tiers: z.ZodDefault<z.ZodBoolean>;
    /** Generate Software Bill of Materials page */
    sbom: z.ZodDefault<z.ZodBoolean>;
    /** Add GitHub source links on symbols */
    source_links: z.ZodDefault<z.ZodBoolean>;
    /** Generate code insights page (static analyzers) */
    insights: z.ZodDefault<z.ZodBoolean>;
    /** Enable AI-powered insights (requires license + API key) */
    insights_ai: z.ZodDefault<z.ZodBoolean>;
    /** Enable AI-generated narrative prose on pages (requires AI provider) */
    ai_narrative: z.ZodDefault<z.ZodBoolean>;
    /** Enable AI-generated diagrams (sequence, flowcharts) */
    ai_diagrams: z.ZodDefault<z.ZodBoolean>;
    /** Enable AI-driven dynamic page structure suggestions */
    ai_structure: z.ZodDefault<z.ZodBoolean>;
    /** Enable monorepo workspace package resolution for dependency graphs */
    monorepo: z.ZodDefault<z.ZodBoolean>;
    /** Generate end-user documentation (user guides, troubleshooting, FAQ) */
    user_docs: z.ZodDefault<z.ZodBoolean>;
    /** Per-page toggles for end-user documentation */
    user_docs_config: z.ZodOptional<z.ZodObject<{
        overview: z.ZodDefault<z.ZodBoolean>;
        getting_started: z.ZodDefault<z.ZodBoolean>;
        features: z.ZodDefault<z.ZodBoolean>;
        troubleshooting: z.ZodDefault<z.ZodBoolean>;
        faq: z.ZodDefault<z.ZodBoolean>;
        section_title: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        overview: boolean;
        getting_started: boolean;
        features: boolean;
        troubleshooting: boolean;
        faq: boolean;
        section_title: string;
    }, {
        overview?: boolean | undefined;
        getting_started?: boolean | undefined;
        features?: boolean | undefined;
        troubleshooting?: boolean | undefined;
        faq?: boolean | undefined;
        section_title?: string | undefined;
    }>>;
    /** Enable Q&A chat widget in generated docs (Team feature) */
    qa_widget: z.ZodDefault<z.ZodBoolean>;
    /** Q&A widget configuration */
    qa_config: z.ZodOptional<z.ZodObject<{
        provider: z.ZodDefault<z.ZodEnum<["openai", "anthropic", "gemini", "ollama", "local"]>>;
        model: z.ZodOptional<z.ZodString>;
        embedding_model: z.ZodDefault<z.ZodString>;
        context_window: z.ZodDefault<z.ZodNumber>;
        position: z.ZodDefault<z.ZodEnum<["bottom-right", "bottom-left"]>>;
        greeting: z.ZodDefault<z.ZodString>;
        daily_limit: z.ZodDefault<z.ZodNumber>;
        api_key_env: z.ZodOptional<z.ZodString>;
        base_url: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        provider: "local" | "openai" | "anthropic" | "gemini" | "ollama";
        embedding_model: string;
        context_window: number;
        position: "bottom-right" | "bottom-left";
        greeting: string;
        daily_limit: number;
        model?: string | undefined;
        api_key_env?: string | undefined;
        base_url?: string | undefined;
    }, {
        provider?: "local" | "openai" | "anthropic" | "gemini" | "ollama" | undefined;
        model?: string | undefined;
        api_key_env?: string | undefined;
        base_url?: string | undefined;
        embedding_model?: string | undefined;
        context_window?: number | undefined;
        position?: "bottom-right" | "bottom-left" | undefined;
        greeting?: string | undefined;
        daily_limit?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    depth: "full" | "surface" | "api-only";
    ai_summaries: boolean;
    dependency_graph: boolean;
    changelog: boolean;
    changelog_depth: number;
    config_docs: boolean;
    types_page: boolean;
    dependencies_page: boolean;
    usage_guide_page: boolean;
    max_file_size: number;
    concurrency: number;
    audience: "auto" | "unified" | "split";
    architecture_tiers: boolean;
    sbom: boolean;
    source_links: boolean;
    insights: boolean;
    insights_ai: boolean;
    ai_narrative: boolean;
    ai_diagrams: boolean;
    ai_structure: boolean;
    monorepo: boolean;
    user_docs: boolean;
    qa_widget: boolean;
    ai_provider?: {
        name: "local" | "openai" | "anthropic" | "gemini" | "ollama" | "openrouter" | "docwalk-proxy";
        api_key_env: string;
        model?: string | undefined;
        base_url?: string | undefined;
    } | undefined;
    user_docs_config?: {
        overview: boolean;
        getting_started: boolean;
        features: boolean;
        troubleshooting: boolean;
        faq: boolean;
        section_title: string;
    } | undefined;
    qa_config?: {
        provider: "local" | "openai" | "anthropic" | "gemini" | "ollama";
        embedding_model: string;
        context_window: number;
        position: "bottom-right" | "bottom-left";
        greeting: string;
        daily_limit: number;
        model?: string | undefined;
        api_key_env?: string | undefined;
        base_url?: string | undefined;
    } | undefined;
}, {
    depth?: "full" | "surface" | "api-only" | undefined;
    ai_summaries?: boolean | undefined;
    ai_provider?: {
        name?: "local" | "openai" | "anthropic" | "gemini" | "ollama" | "openrouter" | "docwalk-proxy" | undefined;
        model?: string | undefined;
        api_key_env?: string | undefined;
        base_url?: string | undefined;
    } | undefined;
    dependency_graph?: boolean | undefined;
    changelog?: boolean | undefined;
    changelog_depth?: number | undefined;
    config_docs?: boolean | undefined;
    types_page?: boolean | undefined;
    dependencies_page?: boolean | undefined;
    usage_guide_page?: boolean | undefined;
    max_file_size?: number | undefined;
    concurrency?: number | undefined;
    audience?: "auto" | "unified" | "split" | undefined;
    architecture_tiers?: boolean | undefined;
    sbom?: boolean | undefined;
    source_links?: boolean | undefined;
    insights?: boolean | undefined;
    insights_ai?: boolean | undefined;
    ai_narrative?: boolean | undefined;
    ai_diagrams?: boolean | undefined;
    ai_structure?: boolean | undefined;
    monorepo?: boolean | undefined;
    user_docs?: boolean | undefined;
    user_docs_config?: {
        overview?: boolean | undefined;
        getting_started?: boolean | undefined;
        features?: boolean | undefined;
        troubleshooting?: boolean | undefined;
        faq?: boolean | undefined;
        section_title?: string | undefined;
    } | undefined;
    qa_widget?: boolean | undefined;
    qa_config?: {
        provider?: "local" | "openai" | "anthropic" | "gemini" | "ollama" | undefined;
        model?: string | undefined;
        api_key_env?: string | undefined;
        base_url?: string | undefined;
        embedding_model?: string | undefined;
        context_window?: number | undefined;
        position?: "bottom-right" | "bottom-left" | undefined;
        greeting?: string | undefined;
        daily_limit?: number | undefined;
    } | undefined;
}>;
declare const SyncSchema: z.ZodObject<{
    /**
     * When to trigger doc sync:
     * - on_push: CI triggers on every push to tracked branch
     * - cron: Scheduled interval
     * - manual: Only via `docwalk sync` CLI
     * - webhook: HTTP endpoint trigger
     */
    trigger: z.ZodDefault<z.ZodEnum<["on_push", "cron", "manual", "webhook"]>>;
    /** Cron expression for scheduled sync (only used when trigger=cron) */
    cron: z.ZodOptional<z.ZodString>;
    /** Diff strategy — incremental only re-analyzes changed files */
    diff_strategy: z.ZodDefault<z.ZodEnum<["incremental", "full"]>>;
    /** Cross-file impact analysis — detect downstream doc changes */
    impact_analysis: z.ZodDefault<z.ZodBoolean>;
    /** Commit SHA storage location */
    state_file: z.ZodDefault<z.ZodString>;
    /** Auto-commit generated docs back to repo (for gh-pages flow) */
    auto_commit: z.ZodDefault<z.ZodBoolean>;
    /** Commit message template for auto-commit */
    commit_message: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    trigger: "on_push" | "cron" | "manual" | "webhook";
    diff_strategy: "full" | "incremental";
    impact_analysis: boolean;
    state_file: string;
    auto_commit: boolean;
    commit_message: string;
    cron?: string | undefined;
}, {
    cron?: string | undefined;
    trigger?: "on_push" | "cron" | "manual" | "webhook" | undefined;
    diff_strategy?: "full" | "incremental" | undefined;
    impact_analysis?: boolean | undefined;
    state_file?: string | undefined;
    auto_commit?: boolean | undefined;
    commit_message?: string | undefined;
}>;
declare const DeploySchema: z.ZodObject<{
    /**
     * Hosting provider:
     * - gh-pages: GitHub Pages via Actions
     * - cloudflare: Cloudflare Pages via Wrangler
     * - vercel: Vercel via CLI/API
     * - netlify: Netlify via CLI
     * - s3: AWS S3 + optional CloudFront
     */
    provider: z.ZodDefault<z.ZodEnum<["gh-pages", "cloudflare", "vercel", "netlify", "s3"]>>;
    /** Project name on the hosting platform */
    project: z.ZodOptional<z.ZodString>;
    /** Automatic SSL provisioning */
    auto_ssl: z.ZodDefault<z.ZodBoolean>;
    /** Build output directory */
    output_dir: z.ZodDefault<z.ZodString>;
    /** Provider-specific configuration overrides */
    provider_config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    provider: "gh-pages" | "cloudflare" | "vercel" | "netlify" | "s3";
    auto_ssl: boolean;
    output_dir: string;
    project?: string | undefined;
    provider_config?: Record<string, unknown> | undefined;
}, {
    provider?: "gh-pages" | "cloudflare" | "vercel" | "netlify" | "s3" | undefined;
    project?: string | undefined;
    auto_ssl?: boolean | undefined;
    output_dir?: string | undefined;
    provider_config?: Record<string, unknown> | undefined;
}>;
declare const DomainSchema: z.ZodObject<{
    /** Custom domain for docs */
    custom: z.ZodOptional<z.ZodString>;
    /** Base path prefix (e.g., /cyroid for docs.example.com/cyroid) */
    base_path: z.ZodDefault<z.ZodString>;
    /** Auto-configure DNS records via provider API */
    dns_auto: z.ZodDefault<z.ZodBoolean>;
    /** Additional domain aliases */
    aliases: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    base_path: string;
    dns_auto: boolean;
    custom?: string | undefined;
    aliases?: string[] | undefined;
}, {
    custom?: string | undefined;
    base_path?: string | undefined;
    dns_auto?: boolean | undefined;
    aliases?: string[] | undefined;
}>;
declare const ThemeSchema: z.ZodObject<{
    /** Theme preset — provides palette, fonts, features, and custom CSS out of the box.
     *  Built-in: corporate, startup, developer, minimal (free) + api-reference, knowledge-base (premium).
     *  Additional presets can be registered via @docwalk/themes-premium or custom packages. */
    preset: z.ZodDefault<z.ZodString>;
    /** Layout mode — controls tab/sidebar behavior */
    layout: z.ZodDefault<z.ZodEnum<["tabs", "sidebar", "tabs-sticky"]>>;
    /** MkDocs Material color palette preset */
    palette: z.ZodDefault<z.ZodEnum<["default", "slate", "indigo", "deep-purple", "teal", "custom"]>>;
    /** Primary accent color (hex) */
    accent: z.ZodDefault<z.ZodString>;
    /** Path to logo file */
    logo: z.ZodOptional<z.ZodString>;
    /** Path to favicon */
    favicon: z.ZodOptional<z.ZodString>;
    /** Material theme features to enable */
    features: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Custom CSS file paths */
    custom_css: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /** Custom JS file paths */
    custom_js: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /** Social links for footer */
    social: z.ZodOptional<z.ZodArray<z.ZodObject<{
        icon: z.ZodString;
        link: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        icon: string;
        link: string;
        name?: string | undefined;
    }, {
        icon: string;
        link: string;
        name?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    features: string[];
    preset: string;
    layout: "tabs" | "sidebar" | "tabs-sticky";
    palette: "custom" | "default" | "slate" | "indigo" | "deep-purple" | "teal";
    accent: string;
    logo?: string | undefined;
    favicon?: string | undefined;
    custom_css?: string[] | undefined;
    custom_js?: string[] | undefined;
    social?: {
        icon: string;
        link: string;
        name?: string | undefined;
    }[] | undefined;
}, {
    features?: string[] | undefined;
    preset?: string | undefined;
    layout?: "tabs" | "sidebar" | "tabs-sticky" | undefined;
    palette?: "custom" | "default" | "slate" | "indigo" | "deep-purple" | "teal" | undefined;
    accent?: string | undefined;
    logo?: string | undefined;
    favicon?: string | undefined;
    custom_css?: string[] | undefined;
    custom_js?: string[] | undefined;
    social?: {
        icon: string;
        link: string;
        name?: string | undefined;
    }[] | undefined;
}>;
declare const VersioningSchema: z.ZodObject<{
    /** Enable versioned documentation */
    enabled: z.ZodDefault<z.ZodBoolean>;
    /** Version source — git tags or branches */
    source: z.ZodDefault<z.ZodEnum<["tags", "branches"]>>;
    /** Tag pattern to match (regex) */
    tag_pattern: z.ZodDefault<z.ZodString>;
    /** Default version alias (e.g., 'latest', 'stable') */
    default_alias: z.ZodDefault<z.ZodString>;
    /** Maximum number of versions to keep deployed */
    max_versions: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    source: "tags" | "branches";
    tag_pattern: string;
    default_alias: string;
    max_versions: number;
}, {
    enabled?: boolean | undefined;
    source?: "tags" | "branches" | undefined;
    tag_pattern?: string | undefined;
    default_alias?: string | undefined;
    max_versions?: number | undefined;
}>;
declare const PluginSchema: z.ZodObject<{
    /** Plugin package name or local path */
    name: z.ZodString;
    /** Plugin-specific configuration */
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    /** Whether plugin is enabled */
    enabled: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    enabled: boolean;
    config?: Record<string, unknown> | undefined;
}, {
    name: string;
    enabled?: boolean | undefined;
    config?: Record<string, unknown> | undefined;
}>;
declare const HooksSchema: z.ZodObject<{
    /** Run before analysis */
    pre_analyze: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /** Run after analysis */
    post_analyze: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /** Run before MkDocs build */
    pre_build: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /** Run after MkDocs build */
    post_build: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /** Run before deploy */
    pre_deploy: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /** Run after deploy */
    post_deploy: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    pre_analyze?: string[] | undefined;
    post_analyze?: string[] | undefined;
    pre_build?: string[] | undefined;
    post_build?: string[] | undefined;
    pre_deploy?: string[] | undefined;
    post_deploy?: string[] | undefined;
}, {
    pre_analyze?: string[] | undefined;
    post_analyze?: string[] | undefined;
    pre_build?: string[] | undefined;
    post_build?: string[] | undefined;
    pre_deploy?: string[] | undefined;
    post_deploy?: string[] | undefined;
}>;
declare const DocWalkConfigSchema: z.ZodObject<{
    /** Source repository configuration */
    source: z.ZodObject<{
        /** GitHub/GitLab/Bitbucket repo in owner/name format, or local path */
        repo: z.ZodString;
        /** Branch to track for documentation */
        branch: z.ZodDefault<z.ZodString>;
        /** Glob patterns for files to include in analysis */
        include: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Glob patterns for files to exclude from analysis */
        exclude: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Language detection mode — 'auto' detects from file extensions */
        languages: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"auto">, z.ZodArray<z.ZodString, "many">]>>;
        /** Remote provider type for API-based repo access */
        provider: z.ZodDefault<z.ZodEnum<["github", "gitlab", "bitbucket", "local"]>>;
    }, "strip", z.ZodTypeAny, {
        repo: string;
        branch: string;
        include: string[];
        exclude: string[];
        languages: string[] | "auto";
        provider: "github" | "gitlab" | "bitbucket" | "local";
    }, {
        repo: string;
        branch?: string | undefined;
        include?: string[] | undefined;
        exclude?: string[] | undefined;
        languages?: string[] | "auto" | undefined;
        provider?: "github" | "gitlab" | "bitbucket" | "local" | undefined;
    }>;
    /** Analysis engine configuration */
    analysis: z.ZodDefault<z.ZodObject<{
        /**
         * Analysis depth:
         * - full: AST parsing, cross-refs, dependency graphs, everything
         * - surface: File-level overview, exports, top-level docs
         * - api-only: Only public API surface (exports, types, interfaces)
         */
        depth: z.ZodDefault<z.ZodEnum<["full", "surface", "api-only"]>>;
        /** Enable AI-powered summaries for modules and functions */
        ai_summaries: z.ZodDefault<z.ZodBoolean>;
        /** AI provider for summaries and narrative generation */
        ai_provider: z.ZodOptional<z.ZodObject<{
            name: z.ZodDefault<z.ZodEnum<["openai", "anthropic", "gemini", "ollama", "openrouter", "local", "docwalk-proxy"]>>;
            model: z.ZodOptional<z.ZodString>;
            api_key_env: z.ZodDefault<z.ZodString>;
            base_url: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: "local" | "openai" | "anthropic" | "gemini" | "ollama" | "openrouter" | "docwalk-proxy";
            api_key_env: string;
            model?: string | undefined;
            base_url?: string | undefined;
        }, {
            name?: "local" | "openai" | "anthropic" | "gemini" | "ollama" | "openrouter" | "docwalk-proxy" | undefined;
            model?: string | undefined;
            api_key_env?: string | undefined;
            base_url?: string | undefined;
        }>>;
        /** Generate dependency graph visualization */
        dependency_graph: z.ZodDefault<z.ZodBoolean>;
        /** Auto-generate changelog from git history */
        changelog: z.ZodDefault<z.ZodBoolean>;
        /** Max number of git log entries for changelog */
        changelog_depth: z.ZodDefault<z.ZodNumber>;
        /** Extract and document configuration schemas */
        config_docs: z.ZodDefault<z.ZodBoolean>;
        /** Generate aggregate types/interfaces page */
        types_page: z.ZodDefault<z.ZodBoolean>;
        /** Generate external dependencies listing page */
        dependencies_page: z.ZodDefault<z.ZodBoolean>;
        /** Generate "How to use these docs" usage guide page */
        usage_guide_page: z.ZodDefault<z.ZodBoolean>;
        /** Maximum file size to analyze (bytes) — skip huge generated files */
        max_file_size: z.ZodDefault<z.ZodNumber>;
        /** Parallelism for analysis workers */
        concurrency: z.ZodDefault<z.ZodNumber>;
        /** Audience separation: auto-detect library vs app, split into user/dev tabs, or unified */
        audience: z.ZodDefault<z.ZodEnum<["auto", "unified", "split"]>>;
        /** Multi-level architecture pages (system → package → module) */
        architecture_tiers: z.ZodDefault<z.ZodBoolean>;
        /** Generate Software Bill of Materials page */
        sbom: z.ZodDefault<z.ZodBoolean>;
        /** Add GitHub source links on symbols */
        source_links: z.ZodDefault<z.ZodBoolean>;
        /** Generate code insights page (static analyzers) */
        insights: z.ZodDefault<z.ZodBoolean>;
        /** Enable AI-powered insights (requires license + API key) */
        insights_ai: z.ZodDefault<z.ZodBoolean>;
        /** Enable AI-generated narrative prose on pages (requires AI provider) */
        ai_narrative: z.ZodDefault<z.ZodBoolean>;
        /** Enable AI-generated diagrams (sequence, flowcharts) */
        ai_diagrams: z.ZodDefault<z.ZodBoolean>;
        /** Enable AI-driven dynamic page structure suggestions */
        ai_structure: z.ZodDefault<z.ZodBoolean>;
        /** Enable monorepo workspace package resolution for dependency graphs */
        monorepo: z.ZodDefault<z.ZodBoolean>;
        /** Generate end-user documentation (user guides, troubleshooting, FAQ) */
        user_docs: z.ZodDefault<z.ZodBoolean>;
        /** Per-page toggles for end-user documentation */
        user_docs_config: z.ZodOptional<z.ZodObject<{
            overview: z.ZodDefault<z.ZodBoolean>;
            getting_started: z.ZodDefault<z.ZodBoolean>;
            features: z.ZodDefault<z.ZodBoolean>;
            troubleshooting: z.ZodDefault<z.ZodBoolean>;
            faq: z.ZodDefault<z.ZodBoolean>;
            section_title: z.ZodDefault<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            overview: boolean;
            getting_started: boolean;
            features: boolean;
            troubleshooting: boolean;
            faq: boolean;
            section_title: string;
        }, {
            overview?: boolean | undefined;
            getting_started?: boolean | undefined;
            features?: boolean | undefined;
            troubleshooting?: boolean | undefined;
            faq?: boolean | undefined;
            section_title?: string | undefined;
        }>>;
        /** Enable Q&A chat widget in generated docs (Team feature) */
        qa_widget: z.ZodDefault<z.ZodBoolean>;
        /** Q&A widget configuration */
        qa_config: z.ZodOptional<z.ZodObject<{
            provider: z.ZodDefault<z.ZodEnum<["openai", "anthropic", "gemini", "ollama", "local"]>>;
            model: z.ZodOptional<z.ZodString>;
            embedding_model: z.ZodDefault<z.ZodString>;
            context_window: z.ZodDefault<z.ZodNumber>;
            position: z.ZodDefault<z.ZodEnum<["bottom-right", "bottom-left"]>>;
            greeting: z.ZodDefault<z.ZodString>;
            daily_limit: z.ZodDefault<z.ZodNumber>;
            api_key_env: z.ZodOptional<z.ZodString>;
            base_url: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            provider: "local" | "openai" | "anthropic" | "gemini" | "ollama";
            embedding_model: string;
            context_window: number;
            position: "bottom-right" | "bottom-left";
            greeting: string;
            daily_limit: number;
            model?: string | undefined;
            api_key_env?: string | undefined;
            base_url?: string | undefined;
        }, {
            provider?: "local" | "openai" | "anthropic" | "gemini" | "ollama" | undefined;
            model?: string | undefined;
            api_key_env?: string | undefined;
            base_url?: string | undefined;
            embedding_model?: string | undefined;
            context_window?: number | undefined;
            position?: "bottom-right" | "bottom-left" | undefined;
            greeting?: string | undefined;
            daily_limit?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        depth: "full" | "surface" | "api-only";
        ai_summaries: boolean;
        dependency_graph: boolean;
        changelog: boolean;
        changelog_depth: number;
        config_docs: boolean;
        types_page: boolean;
        dependencies_page: boolean;
        usage_guide_page: boolean;
        max_file_size: number;
        concurrency: number;
        audience: "auto" | "unified" | "split";
        architecture_tiers: boolean;
        sbom: boolean;
        source_links: boolean;
        insights: boolean;
        insights_ai: boolean;
        ai_narrative: boolean;
        ai_diagrams: boolean;
        ai_structure: boolean;
        monorepo: boolean;
        user_docs: boolean;
        qa_widget: boolean;
        ai_provider?: {
            name: "local" | "openai" | "anthropic" | "gemini" | "ollama" | "openrouter" | "docwalk-proxy";
            api_key_env: string;
            model?: string | undefined;
            base_url?: string | undefined;
        } | undefined;
        user_docs_config?: {
            overview: boolean;
            getting_started: boolean;
            features: boolean;
            troubleshooting: boolean;
            faq: boolean;
            section_title: string;
        } | undefined;
        qa_config?: {
            provider: "local" | "openai" | "anthropic" | "gemini" | "ollama";
            embedding_model: string;
            context_window: number;
            position: "bottom-right" | "bottom-left";
            greeting: string;
            daily_limit: number;
            model?: string | undefined;
            api_key_env?: string | undefined;
            base_url?: string | undefined;
        } | undefined;
    }, {
        depth?: "full" | "surface" | "api-only" | undefined;
        ai_summaries?: boolean | undefined;
        ai_provider?: {
            name?: "local" | "openai" | "anthropic" | "gemini" | "ollama" | "openrouter" | "docwalk-proxy" | undefined;
            model?: string | undefined;
            api_key_env?: string | undefined;
            base_url?: string | undefined;
        } | undefined;
        dependency_graph?: boolean | undefined;
        changelog?: boolean | undefined;
        changelog_depth?: number | undefined;
        config_docs?: boolean | undefined;
        types_page?: boolean | undefined;
        dependencies_page?: boolean | undefined;
        usage_guide_page?: boolean | undefined;
        max_file_size?: number | undefined;
        concurrency?: number | undefined;
        audience?: "auto" | "unified" | "split" | undefined;
        architecture_tiers?: boolean | undefined;
        sbom?: boolean | undefined;
        source_links?: boolean | undefined;
        insights?: boolean | undefined;
        insights_ai?: boolean | undefined;
        ai_narrative?: boolean | undefined;
        ai_diagrams?: boolean | undefined;
        ai_structure?: boolean | undefined;
        monorepo?: boolean | undefined;
        user_docs?: boolean | undefined;
        user_docs_config?: {
            overview?: boolean | undefined;
            getting_started?: boolean | undefined;
            features?: boolean | undefined;
            troubleshooting?: boolean | undefined;
            faq?: boolean | undefined;
            section_title?: string | undefined;
        } | undefined;
        qa_widget?: boolean | undefined;
        qa_config?: {
            provider?: "local" | "openai" | "anthropic" | "gemini" | "ollama" | undefined;
            model?: string | undefined;
            api_key_env?: string | undefined;
            base_url?: string | undefined;
            embedding_model?: string | undefined;
            context_window?: number | undefined;
            position?: "bottom-right" | "bottom-left" | undefined;
            greeting?: string | undefined;
            daily_limit?: number | undefined;
        } | undefined;
    }>>;
    /** Sync strategy configuration */
    sync: z.ZodDefault<z.ZodObject<{
        /**
         * When to trigger doc sync:
         * - on_push: CI triggers on every push to tracked branch
         * - cron: Scheduled interval
         * - manual: Only via `docwalk sync` CLI
         * - webhook: HTTP endpoint trigger
         */
        trigger: z.ZodDefault<z.ZodEnum<["on_push", "cron", "manual", "webhook"]>>;
        /** Cron expression for scheduled sync (only used when trigger=cron) */
        cron: z.ZodOptional<z.ZodString>;
        /** Diff strategy — incremental only re-analyzes changed files */
        diff_strategy: z.ZodDefault<z.ZodEnum<["incremental", "full"]>>;
        /** Cross-file impact analysis — detect downstream doc changes */
        impact_analysis: z.ZodDefault<z.ZodBoolean>;
        /** Commit SHA storage location */
        state_file: z.ZodDefault<z.ZodString>;
        /** Auto-commit generated docs back to repo (for gh-pages flow) */
        auto_commit: z.ZodDefault<z.ZodBoolean>;
        /** Commit message template for auto-commit */
        commit_message: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        trigger: "on_push" | "cron" | "manual" | "webhook";
        diff_strategy: "full" | "incremental";
        impact_analysis: boolean;
        state_file: string;
        auto_commit: boolean;
        commit_message: string;
        cron?: string | undefined;
    }, {
        cron?: string | undefined;
        trigger?: "on_push" | "cron" | "manual" | "webhook" | undefined;
        diff_strategy?: "full" | "incremental" | undefined;
        impact_analysis?: boolean | undefined;
        state_file?: string | undefined;
        auto_commit?: boolean | undefined;
        commit_message?: string | undefined;
    }>>;
    /** Deployment configuration */
    deploy: z.ZodDefault<z.ZodObject<{
        /**
         * Hosting provider:
         * - gh-pages: GitHub Pages via Actions
         * - cloudflare: Cloudflare Pages via Wrangler
         * - vercel: Vercel via CLI/API
         * - netlify: Netlify via CLI
         * - s3: AWS S3 + optional CloudFront
         */
        provider: z.ZodDefault<z.ZodEnum<["gh-pages", "cloudflare", "vercel", "netlify", "s3"]>>;
        /** Project name on the hosting platform */
        project: z.ZodOptional<z.ZodString>;
        /** Automatic SSL provisioning */
        auto_ssl: z.ZodDefault<z.ZodBoolean>;
        /** Build output directory */
        output_dir: z.ZodDefault<z.ZodString>;
        /** Provider-specific configuration overrides */
        provider_config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        provider: "gh-pages" | "cloudflare" | "vercel" | "netlify" | "s3";
        auto_ssl: boolean;
        output_dir: string;
        project?: string | undefined;
        provider_config?: Record<string, unknown> | undefined;
    }, {
        provider?: "gh-pages" | "cloudflare" | "vercel" | "netlify" | "s3" | undefined;
        project?: string | undefined;
        auto_ssl?: boolean | undefined;
        output_dir?: string | undefined;
        provider_config?: Record<string, unknown> | undefined;
    }>>;
    /** Domain routing configuration */
    domain: z.ZodDefault<z.ZodObject<{
        /** Custom domain for docs */
        custom: z.ZodOptional<z.ZodString>;
        /** Base path prefix (e.g., /cyroid for docs.example.com/cyroid) */
        base_path: z.ZodDefault<z.ZodString>;
        /** Auto-configure DNS records via provider API */
        dns_auto: z.ZodDefault<z.ZodBoolean>;
        /** Additional domain aliases */
        aliases: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        base_path: string;
        dns_auto: boolean;
        custom?: string | undefined;
        aliases?: string[] | undefined;
    }, {
        custom?: string | undefined;
        base_path?: string | undefined;
        dns_auto?: boolean | undefined;
        aliases?: string[] | undefined;
    }>>;
    /** Theme and appearance */
    theme: z.ZodDefault<z.ZodObject<{
        /** Theme preset — provides palette, fonts, features, and custom CSS out of the box.
         *  Built-in: corporate, startup, developer, minimal (free) + api-reference, knowledge-base (premium).
         *  Additional presets can be registered via @docwalk/themes-premium or custom packages. */
        preset: z.ZodDefault<z.ZodString>;
        /** Layout mode — controls tab/sidebar behavior */
        layout: z.ZodDefault<z.ZodEnum<["tabs", "sidebar", "tabs-sticky"]>>;
        /** MkDocs Material color palette preset */
        palette: z.ZodDefault<z.ZodEnum<["default", "slate", "indigo", "deep-purple", "teal", "custom"]>>;
        /** Primary accent color (hex) */
        accent: z.ZodDefault<z.ZodString>;
        /** Path to logo file */
        logo: z.ZodOptional<z.ZodString>;
        /** Path to favicon */
        favicon: z.ZodOptional<z.ZodString>;
        /** Material theme features to enable */
        features: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Custom CSS file paths */
        custom_css: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Custom JS file paths */
        custom_js: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Social links for footer */
        social: z.ZodOptional<z.ZodArray<z.ZodObject<{
            icon: z.ZodString;
            link: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            icon: string;
            link: string;
            name?: string | undefined;
        }, {
            icon: string;
            link: string;
            name?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        features: string[];
        preset: string;
        layout: "tabs" | "sidebar" | "tabs-sticky";
        palette: "custom" | "default" | "slate" | "indigo" | "deep-purple" | "teal";
        accent: string;
        logo?: string | undefined;
        favicon?: string | undefined;
        custom_css?: string[] | undefined;
        custom_js?: string[] | undefined;
        social?: {
            icon: string;
            link: string;
            name?: string | undefined;
        }[] | undefined;
    }, {
        features?: string[] | undefined;
        preset?: string | undefined;
        layout?: "tabs" | "sidebar" | "tabs-sticky" | undefined;
        palette?: "custom" | "default" | "slate" | "indigo" | "deep-purple" | "teal" | undefined;
        accent?: string | undefined;
        logo?: string | undefined;
        favicon?: string | undefined;
        custom_css?: string[] | undefined;
        custom_js?: string[] | undefined;
        social?: {
            icon: string;
            link: string;
            name?: string | undefined;
        }[] | undefined;
    }>>;
    /** Documentation versioning */
    versioning: z.ZodDefault<z.ZodObject<{
        /** Enable versioned documentation */
        enabled: z.ZodDefault<z.ZodBoolean>;
        /** Version source — git tags or branches */
        source: z.ZodDefault<z.ZodEnum<["tags", "branches"]>>;
        /** Tag pattern to match (regex) */
        tag_pattern: z.ZodDefault<z.ZodString>;
        /** Default version alias (e.g., 'latest', 'stable') */
        default_alias: z.ZodDefault<z.ZodString>;
        /** Maximum number of versions to keep deployed */
        max_versions: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        source: "tags" | "branches";
        tag_pattern: string;
        default_alias: string;
        max_versions: number;
    }, {
        enabled?: boolean | undefined;
        source?: "tags" | "branches" | undefined;
        tag_pattern?: string | undefined;
        default_alias?: string | undefined;
        max_versions?: number | undefined;
    }>>;
    /** Plugins */
    plugins: z.ZodOptional<z.ZodArray<z.ZodObject<{
        /** Plugin package name or local path */
        name: z.ZodString;
        /** Plugin-specific configuration */
        config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        /** Whether plugin is enabled */
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        enabled: boolean;
        config?: Record<string, unknown> | undefined;
    }, {
        name: string;
        enabled?: boolean | undefined;
        config?: Record<string, unknown> | undefined;
    }>, "many">>;
    /** Lifecycle hooks */
    hooks: z.ZodOptional<z.ZodObject<{
        /** Run before analysis */
        pre_analyze: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Run after analysis */
        post_analyze: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Run before MkDocs build */
        pre_build: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Run after MkDocs build */
        post_build: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Run before deploy */
        pre_deploy: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Run after deploy */
        post_deploy: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        pre_analyze?: string[] | undefined;
        post_analyze?: string[] | undefined;
        pre_build?: string[] | undefined;
        post_build?: string[] | undefined;
        pre_deploy?: string[] | undefined;
        post_deploy?: string[] | undefined;
    }, {
        pre_analyze?: string[] | undefined;
        post_analyze?: string[] | undefined;
        pre_build?: string[] | undefined;
        post_build?: string[] | undefined;
        pre_deploy?: string[] | undefined;
        post_deploy?: string[] | undefined;
    }>>;
    /** License key for premium features (themes, AI summaries, etc.) */
    license_key: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    source: {
        repo: string;
        branch: string;
        include: string[];
        exclude: string[];
        languages: string[] | "auto";
        provider: "github" | "gitlab" | "bitbucket" | "local";
    };
    analysis: {
        depth: "full" | "surface" | "api-only";
        ai_summaries: boolean;
        dependency_graph: boolean;
        changelog: boolean;
        changelog_depth: number;
        config_docs: boolean;
        types_page: boolean;
        dependencies_page: boolean;
        usage_guide_page: boolean;
        max_file_size: number;
        concurrency: number;
        audience: "auto" | "unified" | "split";
        architecture_tiers: boolean;
        sbom: boolean;
        source_links: boolean;
        insights: boolean;
        insights_ai: boolean;
        ai_narrative: boolean;
        ai_diagrams: boolean;
        ai_structure: boolean;
        monorepo: boolean;
        user_docs: boolean;
        qa_widget: boolean;
        ai_provider?: {
            name: "local" | "openai" | "anthropic" | "gemini" | "ollama" | "openrouter" | "docwalk-proxy";
            api_key_env: string;
            model?: string | undefined;
            base_url?: string | undefined;
        } | undefined;
        user_docs_config?: {
            overview: boolean;
            getting_started: boolean;
            features: boolean;
            troubleshooting: boolean;
            faq: boolean;
            section_title: string;
        } | undefined;
        qa_config?: {
            provider: "local" | "openai" | "anthropic" | "gemini" | "ollama";
            embedding_model: string;
            context_window: number;
            position: "bottom-right" | "bottom-left";
            greeting: string;
            daily_limit: number;
            model?: string | undefined;
            api_key_env?: string | undefined;
            base_url?: string | undefined;
        } | undefined;
    };
    sync: {
        trigger: "on_push" | "cron" | "manual" | "webhook";
        diff_strategy: "full" | "incremental";
        impact_analysis: boolean;
        state_file: string;
        auto_commit: boolean;
        commit_message: string;
        cron?: string | undefined;
    };
    deploy: {
        provider: "gh-pages" | "cloudflare" | "vercel" | "netlify" | "s3";
        auto_ssl: boolean;
        output_dir: string;
        project?: string | undefined;
        provider_config?: Record<string, unknown> | undefined;
    };
    domain: {
        base_path: string;
        dns_auto: boolean;
        custom?: string | undefined;
        aliases?: string[] | undefined;
    };
    theme: {
        features: string[];
        preset: string;
        layout: "tabs" | "sidebar" | "tabs-sticky";
        palette: "custom" | "default" | "slate" | "indigo" | "deep-purple" | "teal";
        accent: string;
        logo?: string | undefined;
        favicon?: string | undefined;
        custom_css?: string[] | undefined;
        custom_js?: string[] | undefined;
        social?: {
            icon: string;
            link: string;
            name?: string | undefined;
        }[] | undefined;
    };
    versioning: {
        enabled: boolean;
        source: "tags" | "branches";
        tag_pattern: string;
        default_alias: string;
        max_versions: number;
    };
    plugins?: {
        name: string;
        enabled: boolean;
        config?: Record<string, unknown> | undefined;
    }[] | undefined;
    hooks?: {
        pre_analyze?: string[] | undefined;
        post_analyze?: string[] | undefined;
        pre_build?: string[] | undefined;
        post_build?: string[] | undefined;
        pre_deploy?: string[] | undefined;
        post_deploy?: string[] | undefined;
    } | undefined;
    license_key?: string | undefined;
}, {
    source: {
        repo: string;
        branch?: string | undefined;
        include?: string[] | undefined;
        exclude?: string[] | undefined;
        languages?: string[] | "auto" | undefined;
        provider?: "github" | "gitlab" | "bitbucket" | "local" | undefined;
    };
    analysis?: {
        depth?: "full" | "surface" | "api-only" | undefined;
        ai_summaries?: boolean | undefined;
        ai_provider?: {
            name?: "local" | "openai" | "anthropic" | "gemini" | "ollama" | "openrouter" | "docwalk-proxy" | undefined;
            model?: string | undefined;
            api_key_env?: string | undefined;
            base_url?: string | undefined;
        } | undefined;
        dependency_graph?: boolean | undefined;
        changelog?: boolean | undefined;
        changelog_depth?: number | undefined;
        config_docs?: boolean | undefined;
        types_page?: boolean | undefined;
        dependencies_page?: boolean | undefined;
        usage_guide_page?: boolean | undefined;
        max_file_size?: number | undefined;
        concurrency?: number | undefined;
        audience?: "auto" | "unified" | "split" | undefined;
        architecture_tiers?: boolean | undefined;
        sbom?: boolean | undefined;
        source_links?: boolean | undefined;
        insights?: boolean | undefined;
        insights_ai?: boolean | undefined;
        ai_narrative?: boolean | undefined;
        ai_diagrams?: boolean | undefined;
        ai_structure?: boolean | undefined;
        monorepo?: boolean | undefined;
        user_docs?: boolean | undefined;
        user_docs_config?: {
            overview?: boolean | undefined;
            getting_started?: boolean | undefined;
            features?: boolean | undefined;
            troubleshooting?: boolean | undefined;
            faq?: boolean | undefined;
            section_title?: string | undefined;
        } | undefined;
        qa_widget?: boolean | undefined;
        qa_config?: {
            provider?: "local" | "openai" | "anthropic" | "gemini" | "ollama" | undefined;
            model?: string | undefined;
            api_key_env?: string | undefined;
            base_url?: string | undefined;
            embedding_model?: string | undefined;
            context_window?: number | undefined;
            position?: "bottom-right" | "bottom-left" | undefined;
            greeting?: string | undefined;
            daily_limit?: number | undefined;
        } | undefined;
    } | undefined;
    sync?: {
        cron?: string | undefined;
        trigger?: "on_push" | "cron" | "manual" | "webhook" | undefined;
        diff_strategy?: "full" | "incremental" | undefined;
        impact_analysis?: boolean | undefined;
        state_file?: string | undefined;
        auto_commit?: boolean | undefined;
        commit_message?: string | undefined;
    } | undefined;
    deploy?: {
        provider?: "gh-pages" | "cloudflare" | "vercel" | "netlify" | "s3" | undefined;
        project?: string | undefined;
        auto_ssl?: boolean | undefined;
        output_dir?: string | undefined;
        provider_config?: Record<string, unknown> | undefined;
    } | undefined;
    domain?: {
        custom?: string | undefined;
        base_path?: string | undefined;
        dns_auto?: boolean | undefined;
        aliases?: string[] | undefined;
    } | undefined;
    theme?: {
        features?: string[] | undefined;
        preset?: string | undefined;
        layout?: "tabs" | "sidebar" | "tabs-sticky" | undefined;
        palette?: "custom" | "default" | "slate" | "indigo" | "deep-purple" | "teal" | undefined;
        accent?: string | undefined;
        logo?: string | undefined;
        favicon?: string | undefined;
        custom_css?: string[] | undefined;
        custom_js?: string[] | undefined;
        social?: {
            icon: string;
            link: string;
            name?: string | undefined;
        }[] | undefined;
    } | undefined;
    versioning?: {
        enabled?: boolean | undefined;
        source?: "tags" | "branches" | undefined;
        tag_pattern?: string | undefined;
        default_alias?: string | undefined;
        max_versions?: number | undefined;
    } | undefined;
    plugins?: {
        name: string;
        enabled?: boolean | undefined;
        config?: Record<string, unknown> | undefined;
    }[] | undefined;
    hooks?: {
        pre_analyze?: string[] | undefined;
        post_analyze?: string[] | undefined;
        pre_build?: string[] | undefined;
        post_build?: string[] | undefined;
        pre_deploy?: string[] | undefined;
        post_deploy?: string[] | undefined;
    } | undefined;
    license_key?: string | undefined;
}>;
type DocWalkConfig = z.infer<typeof DocWalkConfigSchema>;
type SourceConfig = z.infer<typeof SourceSchema>;
type AnalysisConfig = z.infer<typeof AnalysisSchema>;
type SyncConfig = z.infer<typeof SyncSchema>;
type DeployConfig = z.infer<typeof DeploySchema>;
type DomainConfig = z.infer<typeof DomainSchema>;
type ThemeConfig = z.infer<typeof ThemeSchema>;
type VersioningConfig = z.infer<typeof VersioningSchema>;
type PluginConfig = z.infer<typeof PluginSchema>;
type HooksConfig = z.infer<typeof HooksSchema>;

/**
 * DocWalk Configuration Loader
 *
 * Uses cosmiconfig to discover docwalk.config.yml (or .json, .js, etc.)
 * from the project root, then validates it against the Zod schema.
 */

interface LoadConfigResult {
    config: DocWalkConfig;
    filepath: string;
}
/**
 * Load and validate DocWalk configuration from the project directory.
 *
 * @param searchFrom - Directory to search from (defaults to cwd)
 * @returns Validated config and the filepath it was loaded from
 * @throws If no config found or validation fails
 */
declare function loadConfig(searchFrom?: string): Promise<LoadConfigResult>;
/**
 * Load config from a specific file path.
 */
declare function loadConfigFile(filepath: string): Promise<LoadConfigResult>;
declare class ConfigNotFoundError extends Error {
    constructor(message: string);
}
declare class ConfigValidationError extends Error {
    constructor(message: string);
}

/**
 * DocWalk Analysis Types
 *
 * Core type definitions for the static analysis engine.
 * These types represent the intermediate representation (IR) that
 * the analysis engine produces and the generators consume.
 */
type SymbolKind = "function" | "class" | "interface" | "type" | "enum" | "constant" | "variable" | "method" | "property" | "module" | "namespace" | "decorator" | "hook" | "component";
type Visibility = "public" | "private" | "protected" | "internal";
interface SourceLocation {
    file: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
}
interface ParameterInfo {
    name: string;
    type?: string;
    description?: string;
    defaultValue?: string;
    optional: boolean;
    rest: boolean;
}
interface ReturnInfo {
    type?: string;
    description?: string;
}
interface DocComment {
    summary: string;
    description?: string;
    params?: Record<string, string>;
    returns?: string;
    throws?: string[];
    examples?: string[];
    tags?: Record<string, string>;
    deprecated?: string | boolean;
    since?: string;
    see?: string[];
}
interface Symbol {
    /** Unique identifier within the codebase */
    id: string;
    /** Human-readable name */
    name: string;
    /** What kind of symbol this is */
    kind: SymbolKind;
    /** Access visibility */
    visibility: Visibility;
    /** Source location */
    location: SourceLocation;
    /** Whether this symbol is exported */
    exported: boolean;
    /** Function/method parameters */
    parameters?: ParameterInfo[];
    /** Return type info */
    returns?: ReturnInfo;
    /** Type annotation or definition */
    typeAnnotation?: string;
    /** Parsed doc comment */
    docs?: DocComment;
    /** AI-generated summary (if enabled) */
    aiSummary?: string;
    /** Parent symbol ID (e.g., method belongs to class) */
    parentId?: string;
    /** Child symbol IDs */
    children?: string[];
    /** Symbols this one depends on */
    dependencies?: string[];
    /** Symbols that depend on this one */
    dependents?: string[];
    /** Generic type parameters */
    typeParameters?: string[];
    /** For classes: extended class */
    extends?: string;
    /** For classes/interfaces: implemented interfaces */
    implements?: string[];
    /** Decorators applied to this symbol */
    decorators?: string[];
    /** Whether this is async */
    async?: boolean;
    /** Whether this is a generator */
    generator?: boolean;
    /** Raw signature string for display */
    signature?: string;
}
interface ModuleInfo {
    /** Relative file path from repo root */
    filePath: string;
    /** Detected language */
    language: string;
    /** All symbols found in this file */
    symbols: Symbol[];
    /** Import statements */
    imports: ImportInfo[];
    /** Export statements */
    exports: ExportInfo[];
    /** File-level doc comment (top of file) */
    moduleDoc?: DocComment;
    /** AI-generated module summary */
    aiSummary?: string;
    /** File size in bytes */
    fileSize: number;
    /** Number of lines */
    lineCount: number;
    /** SHA of file content (for cache invalidation) */
    contentHash: string;
    /** Last analyzed timestamp */
    analyzedAt: string;
}
interface ImportInfo {
    source: string;
    specifiers: Array<{
        name: string;
        alias?: string;
        isDefault: boolean;
        isNamespace: boolean;
    }>;
    isTypeOnly: boolean;
}
interface ExportInfo {
    name: string;
    alias?: string;
    isDefault: boolean;
    isReExport: boolean;
    source?: string;
    symbolId?: string;
}
interface DependencyEdge {
    from: string;
    to: string;
    imports: string[];
    isTypeOnly: boolean;
}
interface DependencyGraph {
    nodes: string[];
    edges: DependencyEdge[];
}
interface AnalysisManifest {
    /** DocWalk version that produced this manifest */
    docwalkVersion: string;
    /** Repository identifier */
    repo: string;
    /** Branch that was analyzed */
    branch: string;
    /** Commit SHA at time of analysis */
    commitSha: string;
    /** When the analysis was performed */
    analyzedAt: string;
    /** All analyzed modules */
    modules: ModuleInfo[];
    /** Cross-file dependency graph */
    dependencyGraph: DependencyGraph;
    /** Detected project metadata */
    projectMeta: ProjectMeta;
    /** Analysis statistics */
    stats: AnalysisStats;
    /** Cached AI summaries keyed by content hash */
    summaryCache?: Array<{
        contentHash: string;
        summary: string;
        generatedAt: string;
    }>;
    /** Code improvement insights from static analysis */
    insights?: Insight[];
}
interface ProjectMeta {
    name: string;
    version?: string;
    description?: string;
    /** Summary extracted from the project's README.md, if present */
    readmeDescription?: string;
    languages: Array<{
        name: string;
        fileCount: number;
        percentage: number;
    }>;
    entryPoints: string[];
    packageManager?: string;
    framework?: string;
    license?: string;
    repository?: string;
    projectType?: "library" | "application" | "unknown";
}
interface AnalysisStats {
    totalFiles: number;
    totalSymbols: number;
    totalLines: number;
    byLanguage: Record<string, {
        files: number;
        symbols: number;
        lines: number;
    }>;
    byKind: Record<SymbolKind, number>;
    analysisTime: number;
    skippedFiles: number;
}
type DiffStatus = "added" | "modified" | "deleted" | "renamed";
interface FileDiff {
    path: string;
    oldPath?: string;
    status: DiffStatus;
}
interface SyncState {
    lastCommitSha: string;
    lastSyncedAt: string;
    manifestPath: string;
    totalPages: number;
}
interface SyncResult {
    diffs: FileDiff[];
    modulesReanalyzed: number;
    pagesRebuilt: number;
    pagesCreated: number;
    pagesDeleted: number;
    impactedModules: string[];
    duration: number;
    previousCommit: string;
    currentCommit: string;
}
interface GeneratedPage {
    /** Output path relative to docs/ directory */
    path: string;
    /** Page title */
    title: string;
    /** Markdown content */
    content: string;
    /** Navigation group */
    navGroup: string;
    /** Navigation order weight */
    navOrder: number;
    /** Audience for this page when audience separation is enabled */
    audience?: "user" | "developer" | "both";
}
interface Insight {
    id: string;
    category: "documentation" | "architecture" | "code-quality" | "security" | "performance";
    severity: "info" | "warning" | "critical";
    title: string;
    description: string;
    affectedFiles: string[];
    suggestion: string;
    aiSuggestion?: string;
}
interface NavigationItem {
    title: string;
    path?: string;
    children?: NavigationItem[];
}
interface GenerationResult {
    pages: GeneratedPage[];
    navigation: NavigationItem[];
    mkdocsConfig: Record<string, unknown>;
}

/**
 * DocWalk AI Summarizer
 *
 * Generates human-readable summaries for modules and symbols
 * using LLM providers. Provider implementations live in ./providers/.
 *
 * This module contains:
 * - RateLimiter for API call throttling
 * - SummaryCache for content-hash-based caching
 * - summarizeModules() orchestrator
 * - createProvider() factory (re-exported from providers)
 */

/** Cache entry persisted alongside the manifest. */
interface SummaryCacheEntry {
    contentHash: string;
    summary: string;
    generatedAt: string;
}

/**
 * DocWalk Analysis Engine
 *
 * Orchestrates the multi-pass analysis pipeline:
 * 1. File discovery (glob matching)
 * 2. Language detection
 * 3. AST parsing via tree-sitter
 * 4. Symbol extraction
 * 5. Cross-file dependency resolution
 * 6. Optional AI summarization
 * 7. Manifest generation
 */

interface AnalysisOptions {
    source: SourceConfig;
    analysis: AnalysisConfig;
    repoRoot: string;
    commitSha: string;
    /** If provided, only analyze these files (for incremental sync) */
    targetFiles?: string[];
    /** Previous manifest for incremental merge */
    previousManifest?: AnalysisManifest;
    /** Progress callback */
    onProgress?: (current: number, total: number, file: string) => void;
    /** Previous AI summary cache for reuse */
    previousSummaryCache?: SummaryCacheEntry[];
    /** AI summarization progress callback */
    onAIProgress?: (current: number, total: number, message: string) => void;
    /** Hooks configuration for pre/post analyze */
    hooks?: HooksConfig;
}
declare function analyzeCodebase(options: AnalysisOptions): Promise<AnalysisManifest>;

/**
 * Language Detection
 *
 * Maps file extensions to language identifiers used by the analysis engine
 * and tree-sitter parser selection.
 */
type LanguageId = "typescript" | "javascript" | "python" | "go" | "rust" | "java" | "csharp" | "ruby" | "php" | "swift" | "kotlin" | "scala" | "elixir" | "dart" | "lua" | "zig" | "haskell" | "c" | "cpp" | "yaml" | "shell" | "hcl" | "sql" | "markdown" | "dockerfile" | "toml" | "json" | "xml";
/**
 * Detect the programming language from a file path.
 * Returns undefined for unrecognized extensions.
 */
declare function detectLanguage(filePath: string): LanguageId | undefined;
/**
 * Get all supported language IDs.
 */
declare function getSupportedLanguages(): LanguageId[];
/**
 * Get display name for a language ID.
 */
declare function getLanguageDisplayName(lang: LanguageId): string;

/**
 * File Discovery
 *
 * Discovers source files in a repository using fast-glob,
 * respecting include/exclude patterns from configuration.
 */

/**
 * Discover all source files matching the configured patterns.
 *
 * @param repoRoot - Absolute path to the repository root
 * @param source - Source configuration with include/exclude globs
 * @returns Array of file paths relative to repoRoot
 */
declare function discoverFiles(repoRoot: string, source: SourceConfig): Promise<string[]>;

/**
 * Parser Registry
 *
 * Defines the interface for language parsers and provides a
 * registry to look them up by language ID. Each parser uses
 * tree-sitter to parse source code and extract symbols.
 */

interface ParserResult {
    symbols: Symbol[];
    imports: ImportInfo[];
    exports: ExportInfo[];
    moduleDoc?: DocComment;
}
interface LanguageParser {
    /** Language this parser handles */
    language: LanguageId;
    /** Parse source code and extract structured information */
    parse(content: string, filePath: string): Promise<ParserResult>;
}
/**
 * Register a language parser.
 */
declare function registerParser(parser: LanguageParser): void;
/**
 * Get the parser for a given language.
 * Returns undefined if no parser is registered.
 */
declare function getParser(language: LanguageId): LanguageParser | undefined;
/**
 * Get all registered language IDs.
 */
declare function getRegisteredLanguages(): LanguageId[];

/**
 * DocWalk Sync Engine
 *
 * Implements the git-diff based incremental sync strategy.
 * Compares current HEAD against the last indexed commit SHA,
 * identifies changed files, runs targeted re-analysis, and
 * triggers incremental doc rebuild + deploy.
 *
 * Hardened to handle: corrupt state files, force pushes where the
 * previous commit no longer exists, file renames, recursive impact
 * analysis, and manual commit range diffing via --since.
 */

interface SyncOptions {
    repoRoot: string;
    source: SourceConfig;
    analysis: AnalysisConfig;
    sync: SyncConfig;
    dryRun?: boolean;
    /** Override the starting commit for diffing (--since flag). */
    since?: string;
    onProgress?: (message: string) => void;
}
/**
 * Run an incremental sync: diff -> re-analyze -> rebuild -> deploy.
 *
 * @param options - Sync configuration and callbacks
 * @returns Result with diff stats, pages affected, and timing
 */
declare function runSync(options: SyncOptions): Promise<SyncResult>;

/**
 * DocWalk Generator — Zensical (MkDocs-compatible)
 *
 * Transforms an AnalysisManifest into a complete documentation site:
 * Markdown pages, mkdocs.yml, navigation tree, and supporting assets.
 * Zensical reads mkdocs.yml natively, so the output format is unchanged.
 *
 * Page generators are split into individual modules under ./pages/.
 * Shared utilities live in ./utils.ts.
 */

interface GenerateOptions {
    manifest: AnalysisManifest;
    config: DocWalkConfig;
    outputDir: string;
    onProgress?: (message: string) => void;
    hooks?: HooksConfig;
    /** Function to read source files (for AI context building) */
    readFile?: (filePath: string) => Promise<string>;
    /** Try mode: limits pages and appends upsell banners */
    tryMode?: boolean;
}
/**
 * Generate a complete documentation site (Zensical / MkDocs-compatible).
 */
declare function generateDocs(options: GenerateOptions): Promise<void>;

/**
 * Theme Preset Definitions
 *
 * Provides styled presets so generated docs look polished out of the box.
 * Each preset defines colors, fonts, Material features, and custom CSS.
 */
interface ThemePreset {
    id: string;
    name: string;
    palette: {
        scheme: string;
        primary: string;
        accent: string;
        toggleScheme?: string;
    };
    cssVars: Record<string, string>;
    features: string[];
    fonts: {
        text: string;
        code: string;
    };
    customCss: string;
    customJs?: string;
}
/** Presets available in the open-source tier */
declare const FREE_PRESET_IDS: readonly ["corporate", "startup", "developer", "minimal"];
/** Presets that require a paid license */
declare const PREMIUM_PRESET_IDS: readonly ["api-reference", "knowledge-base"];
/**
 * Register external presets (used by premium theme packages).
 */
declare function registerPresets(presets: Record<string, ThemePreset>): void;
/**
 * Try to load the premium themes package if installed and licensed.
 * Returns silently if the package is not installed.
 */
declare function loadPremiumPresets(licenseKey?: string): Promise<void>;
/**
 * Resolve a preset by ID. Checks built-in presets first, then external.
 * Returns undefined for "custom" or unknown IDs.
 *
 * @param presetId - The preset identifier
 * @param options.requireLicense - If true, premium built-in presets require a license key
 * @param options.licenseKey - License key for premium preset access
 */
declare function resolvePreset(presetId: string, options?: {
    requireLicense?: boolean;
    licenseKey?: string;
}): ThemePreset | undefined;
/**
 * Get all available preset IDs (built-in + external).
 */
declare function getPresetIds(): string[];
/**
 * Get only free preset IDs.
 */
declare function getFreePresetIds(): string[];
/**
 * Get only premium preset IDs (built-in + external).
 */
declare function getPremiumPresetIds(): string[];
/**
 * Check if a preset ID is a premium preset.
 */
declare function isPremiumPreset(presetId: string): boolean;

/**
 * DocWalk Deploy Provider Interface
 *
 * Defines the contract for hosting providers and manages
 * the provider registry. Each provider handles:
 * - Project creation/configuration
 * - Build artifact upload
 * - Domain and SSL setup
 * - CI/CD pipeline generation
 */

interface DeployResult {
    url: string;
    previewUrl?: string;
    provider: string;
    projectId: string;
    domain?: string;
    ssl: boolean;
    ciConfigPath?: string;
}
interface DeployProvider {
    /** Provider identifier matching config enum */
    id: string;
    /** Human-readable name */
    name: string;
    /** Check if the provider CLI/API is available and authenticated */
    checkAuth(): Promise<{
        authenticated: boolean;
        message: string;
    }>;
    /** Create or configure the hosting project */
    setupProject(deploy: DeployConfig, domain: DomainConfig): Promise<{
        projectId: string;
    }>;
    /** Deploy built site to the provider */
    deploy(buildDir: string, deploy: DeployConfig, domain: DomainConfig): Promise<DeployResult>;
    /** Remove a deployment and clean up provider resources */
    undeploy(deploy: DeployConfig, domain: DomainConfig): Promise<{
        success: boolean;
        message: string;
    }>;
    /** Configure custom domain and SSL */
    configureDomain(domain: DomainConfig, deploy: DeployConfig): Promise<{
        configured: boolean;
        dnsRecords?: DNSRecord[];
    }>;
    /** Generate CI/CD configuration file (GitHub Actions, etc.) */
    generateCIConfig(deploy: DeployConfig, domain: DomainConfig): Promise<{
        path: string;
        content: string;
    }>;
    /** Generate PR preview deployment workflow */
    generatePreviewCIConfig(deploy: DeployConfig, domain: DomainConfig): Promise<{
        path: string;
        content: string;
    }>;
}
interface DNSRecord {
    type: "CNAME" | "A" | "AAAA" | "TXT";
    name: string;
    value: string;
    ttl?: number;
}
declare function registerProvider(provider: DeployProvider): void;
declare function getProvider(id: string): DeployProvider | undefined;
declare function getAvailableProviders(): DeployProvider[];

/**
 * Hash utilities for content fingerprinting and cache invalidation.
 */
/**
 * Compute a SHA-256 hash of file content.
 * Used to detect content changes independent of timestamps.
 */
declare function computeFileHash(content: string): string;

export { type AnalysisConfig, type AnalysisManifest, type AnalysisOptions, ConfigNotFoundError, ConfigValidationError, type DNSRecord, type DependencyGraph, type DeployConfig, type DeployProvider, type DeployResult, type DiffStatus, type DocWalkConfig, DocWalkConfigSchema, type DomainConfig, FREE_PRESET_IDS, type FileDiff, type GenerateOptions, type GeneratedPage, type GenerationResult, type HooksConfig, type LanguageId, type LanguageParser, type LoadConfigResult, type ModuleInfo, type NavigationItem, PREMIUM_PRESET_IDS, type ParserResult, type PluginConfig, type SourceConfig, type Symbol, type SymbolKind, type SyncConfig, type SyncOptions, type SyncResult, type SyncState, type ThemeConfig, type ThemePreset, type VersioningConfig, analyzeCodebase, computeFileHash, detectLanguage, discoverFiles, generateDocs, getAvailableProviders, getFreePresetIds, getLanguageDisplayName, getParser, getPremiumPresetIds, getPresetIds, getProvider, getRegisteredLanguages, getSupportedLanguages, isPremiumPreset, loadConfig, loadConfigFile, loadPremiumPresets, registerParser, registerPresets, registerProvider, resolvePreset, runSync };
