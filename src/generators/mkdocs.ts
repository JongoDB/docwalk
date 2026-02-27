/**
 * DocWalk Generator — MkDocs Material
 *
 * Transforms an AnalysisManifest into a complete MkDocs Material
 * documentation site: Markdown pages, mkdocs.yml, navigation tree,
 * and supporting assets.
 *
 * Page generators are split into individual modules under ./pages/.
 * Shared utilities live in ./utils.ts.
 */

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { DocWalkConfig, HooksConfig } from "../config/schema.js";
import { executeHooks } from "../utils/hooks.js";
import type {
  AnalysisManifest,
  GeneratedPage,
  NavigationItem,
} from "../analysis/types.js";
import { resolvePreset } from "./theme-presets.js";
import {
  resolveProjectName,
  groupModulesLogically,
  groupByLogicalSection,
  buildSymbolPageMap,
  renderNavYaml,
} from "./utils.js";
import {
  generateOverviewPage,
  generateGettingStartedPage,
  generateArchitecturePage,
  generateTieredArchitecturePages,
  generateModulePage,
  generateConfigurationPage,
  generateTypesPage,
  generateDependenciesPage,
  generateSBOMPage,
  generateUsageGuidePage,
  generateChangelogPage,
  generateInsightsPage,
} from "./pages/index.js";
import type { ModulePageContext } from "./pages/index.js";

export interface GenerateOptions {
  manifest: AnalysisManifest;
  config: DocWalkConfig;
  outputDir: string;
  onProgress?: (message: string) => void;
  hooks?: HooksConfig;
}

/**
 * Safely execute a page generator, catching errors and returning a fallback
 * error page instead of crashing the entire pipeline.
 */
function safeGenerate(
  name: string,
  fn: () => GeneratedPage | GeneratedPage[],
  onProgress?: (message: string) => void
): GeneratedPage | GeneratedPage[] {
  try {
    return fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onProgress?.(`Warning: ${name} page generation failed: ${message}`);
    return {
      path: `${name.toLowerCase().replace(/\s+/g, "-")}-error.md`,
      title: name,
      content: `---\ntitle: ${name}\n---\n\n# ${name}\n\n!!! danger "Generation Error"\n    This page could not be generated: ${message}\n`,
      navGroup: "",
      navOrder: 99,
    };
  }
}

/** Async variant of safeGenerate for page generators that return promises */
async function safeGenerateAsync(
  name: string,
  fn: () => Promise<GeneratedPage>,
  onProgress?: (message: string) => void
): Promise<GeneratedPage> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onProgress?.(`Warning: ${name} page generation failed: ${message}`);
    return {
      path: `${name.toLowerCase().replace(/\s+/g, "-")}-error.md`,
      title: name,
      content: `---\ntitle: ${name}\n---\n\n# ${name}\n\n!!! danger "Generation Error"\n    This page could not be generated: ${message}\n`,
      navGroup: "",
      navOrder: 99,
    };
  }
}

/**
 * Generate a complete MkDocs Material documentation site.
 */
export async function generateDocs(options: GenerateOptions): Promise<void> {
  const { manifest, config, outputDir, onProgress, hooks } = options;

  // ── Pre-build hooks ────────────────────────────────────────────────────
  await executeHooks("pre_build", hooks, { cwd: outputDir });

  const docsDir = path.join(outputDir, "docs");
  await mkdir(docsDir, { recursive: true });

  // ── 1. Generate pages ──────────────────────────────────────────────────
  const pages: GeneratedPage[] = [];

  // Index / overview page
  onProgress?.("Generating overview page...");
  const overviewResult = safeGenerate("Overview", () => generateOverviewPage(manifest, config), onProgress);
  pages.push(...(Array.isArray(overviewResult) ? overviewResult : [overviewResult]));

  // Getting Started
  const gettingStartedResult = safeGenerate("Getting Started", () => generateGettingStartedPage(manifest, config), onProgress);
  pages.push(...(Array.isArray(gettingStartedResult) ? gettingStartedResult : [gettingStartedResult]));

  // Architecture pages (tiered or flat)
  if (config.analysis.dependency_graph) {
    onProgress?.("Generating architecture pages...");
    if (config.analysis.architecture_tiers !== false) {
      const archResult = safeGenerate("Architecture", () => generateTieredArchitecturePages(manifest), onProgress);
      pages.push(...(Array.isArray(archResult) ? archResult : [archResult]));
    } else {
      const archResult = safeGenerate("Architecture", () => generateArchitecturePage(manifest), onProgress);
      pages.push(...(Array.isArray(archResult) ? archResult : [archResult]));
    }
  }

  // Build symbol → page path lookup map for cross-references
  const symbolPageMap = buildSymbolPageMap(manifest.modules);

  const modulePageCtx: ModulePageContext = { config, manifest, symbolPageMap };

  // API Reference pages — one per module, grouped logically
  onProgress?.("Generating API reference pages...");
  const modulesByGroup = groupModulesLogically(manifest.modules);
  for (const [group, modules] of Object.entries(modulesByGroup)) {
    for (const mod of modules) {
      pages.push(generateModulePage(mod, group, modulePageCtx));
    }
  }

  // Configuration page
  if (config.analysis.config_docs) {
    onProgress?.("Generating configuration page...");
    const configResult = safeGenerate("Configuration", () => generateConfigurationPage(manifest, config), onProgress);
    pages.push(...(Array.isArray(configResult) ? configResult : [configResult]));
  }

  // Types page
  if (config.analysis.types_page) {
    onProgress?.("Generating types page...");
    const typesResult = safeGenerate("Types", () => generateTypesPage(manifest), onProgress);
    pages.push(...(Array.isArray(typesResult) ? typesResult : [typesResult]));
  }

  // Dependencies / SBOM page
  if (config.analysis.dependencies_page) {
    onProgress?.("Generating dependencies page...");
    if (config.analysis.sbom !== false) {
      const sbomResult = safeGenerate("SBOM", () => generateSBOMPage(manifest, config), onProgress);
      pages.push(...(Array.isArray(sbomResult) ? sbomResult : [sbomResult]));
    } else {
      const depsResult = safeGenerate("Dependencies", () => generateDependenciesPage(manifest), onProgress);
      pages.push(...(Array.isArray(depsResult) ? depsResult : [depsResult]));
    }
  }

  // Usage guide page
  if (config.analysis.usage_guide_page) {
    onProgress?.("Generating usage guide page...");
    const guideResult = safeGenerate("Usage Guide", () => generateUsageGuidePage(manifest, config), onProgress);
    pages.push(...(Array.isArray(guideResult) ? guideResult : [guideResult]));
  }

  // Changelog
  if (config.analysis.changelog) {
    onProgress?.("Generating changelog page...");
    const changelogPage = await safeGenerateAsync("Changelog", () => generateChangelogPage(config), onProgress);
    pages.push(changelogPage);
  }

  // Insights page
  if (config.analysis.insights !== false && manifest.insights && manifest.insights.length > 0) {
    onProgress?.("Generating insights page...");
    const insightsResult = safeGenerate("Insights", () => generateInsightsPage(manifest.insights!, config), onProgress);
    pages.push(...(Array.isArray(insightsResult) ? insightsResult : [insightsResult]));
  }

  // ── 2. Write all pages ─────────────────────────────────────────────────
  for (const page of pages) {
    const pagePath = path.join(docsDir, page.path);
    await mkdir(path.dirname(pagePath), { recursive: true });
    await writeFile(pagePath, page.content);
    onProgress?.(`Written: ${page.path}`);
  }

  // ── 3. Write preset CSS ──────────────────────────────────────────────
  const preset = resolvePreset(config.theme.preset ?? "developer");
  if (preset) {
    const stylesDir = path.join(docsDir, "stylesheets");
    await mkdir(stylesDir, { recursive: true });
    await writeFile(path.join(stylesDir, "preset.css"), preset.customCss);
    onProgress?.("Written: stylesheets/preset.css");
  }

  // ── 4. Generate mkdocs.yml ─────────────────────────────────────────────
  onProgress?.("Generating mkdocs.yml...");
  const audienceSeparation = resolveAudienceSeparation(config, manifest);
  const navigation = buildNavigation(pages, audienceSeparation);
  const mkdocsYml = generateMkdocsConfig(manifest, config, navigation);
  await writeFile(path.join(outputDir, "mkdocs.yml"), mkdocsYml);

  // ── Post-build hooks ───────────────────────────────────────────────────
  await executeHooks("post_build", hooks, { cwd: outputDir });

  onProgress?.(`Documentation generated: ${pages.length} pages`);
}

// ─── Navigation Builder ─────────────────────────────────────────────────────

function buildNavigation(pages: GeneratedPage[], audienceSeparation?: boolean): NavigationItem[] {
  if (audienceSeparation) {
    return buildAudienceNavigation(pages);
  }

  const nav: NavigationItem[] = [];

  // Top-level pages
  const topLevel = pages
    .filter((p) => !p.path.includes("/"))
    .sort((a, b) => a.navOrder - b.navOrder);

  for (const page of topLevel) {
    nav.push({ title: page.title, path: page.path });
  }

  // Architecture pages (tiered)
  const archIndex = pages.find((p) => p.path === "architecture/index.md");
  const archSubPages = pages.filter((p) => p.path.startsWith("architecture/") && p.path !== "architecture/index.md");

  if (archIndex || archSubPages.length > 0) {
    const archNav: NavigationItem = {
      title: "Architecture",
      children: [],
    };
    if (archIndex) {
      archNav.children!.push({ title: "System Overview", path: archIndex.path });
    }
    for (const page of archSubPages.sort((a, b) => a.navOrder - b.navOrder)) {
      archNav.children!.push({ title: page.title, path: page.path });
    }
    nav.push(archNav);
  }

  // Grouped pages — detect logical boundaries
  const apiPages = pages.filter((p) => p.path.startsWith("api/"));

  // Group by logical section
  const sections = groupByLogicalSection(apiPages);

  if (Object.keys(sections).length > 0) {
    const apiNav: NavigationItem = {
      title: "API Reference",
      children: [],
    };

    for (const [section, sectionPages] of Object.entries(sections)) {
      if (Object.keys(sections).length === 1) {
        // Only one section — flatten
        apiNav.children = sectionPages
          .sort((a, b) => a.title.localeCompare(b.title))
          .map((p) => ({ title: p.title, path: p.path }));
      } else {
        apiNav.children!.push({
          title: section,
          children: sectionPages
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((p) => ({ title: p.title, path: p.path })),
        });
      }
    }

    nav.push(apiNav);
  }

  return nav;
}

function buildAudienceNavigation(pages: GeneratedPage[]): NavigationItem[] {
  const userPages = pages.filter((p) => p.audience === "user" || p.audience === "both");
  const devPages = pages.filter((p) => p.audience === "developer" || p.audience === "both");
  // Pages with no audience set go to both
  const unassigned = pages.filter((p) => !p.audience);

  const userGuide: NavigationItem = {
    title: "User Guide",
    children: [],
  };

  const devRef: NavigationItem = {
    title: "Developer Reference",
    children: [],
  };

  // User Guide: Overview, Getting Started, Configuration, Types, Dependencies, Usage Guide, Changelog
  for (const page of [...userPages, ...unassigned].sort((a, b) => a.navOrder - b.navOrder)) {
    if (!page.path.startsWith("api/") && !page.path.startsWith("architecture/")) {
      userGuide.children!.push({ title: page.title, path: page.path });
    }
  }

  // Developer Reference: Architecture (tiered), Insights
  const archIndex = pages.find((p) => p.path === "architecture/index.md");
  const archSubPages = pages.filter((p) => p.path.startsWith("architecture/") && p.path !== "architecture/index.md");

  if (archIndex || archSubPages.length > 0) {
    const archNav: NavigationItem = {
      title: "Architecture",
      children: [],
    };
    if (archIndex) {
      archNav.children!.push({ title: "System Overview", path: archIndex.path });
    }
    for (const page of archSubPages.sort((a, b) => a.navOrder - b.navOrder)) {
      archNav.children!.push({ title: page.title, path: page.path });
    }
    devRef.children!.push(archNav);
  } else {
    // Non-tiered single architecture page
    const archPage = pages.find((p) => p.path === "architecture.md");
    if (archPage) {
      devRef.children!.push({ title: archPage.title, path: archPage.path });
    }
  }

  // Insights page
  for (const page of [...devPages, ...unassigned].sort((a, b) => a.navOrder - b.navOrder)) {
    if (page.path === "insights.md") {
      devRef.children!.push({ title: page.title, path: page.path });
    }
  }

  // API pages go under Developer Reference
  const apiPages = pages.filter((p) => p.path.startsWith("api/"));
  const sections = groupByLogicalSection(apiPages);
  if (Object.keys(sections).length > 0) {
    const apiNav: NavigationItem = {
      title: "API Reference",
      children: [],
    };
    for (const [section, sectionPages] of Object.entries(sections)) {
      if (Object.keys(sections).length === 1) {
        apiNav.children = sectionPages
          .sort((a, b) => a.title.localeCompare(b.title))
          .map((p) => ({ title: p.title, path: p.path }));
      } else {
        apiNav.children!.push({
          title: section,
          children: sectionPages
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((p) => ({ title: p.title, path: p.path })),
        });
      }
    }
    devRef.children!.push(apiNav);
  }

  return [userGuide, devRef];
}

// ─── MkDocs Config Generator ────────────────────────────────────────────────

function generateMkdocsConfig(
  manifest: AnalysisManifest,
  config: DocWalkConfig,
  navigation: NavigationItem[]
): string {
  const siteName = resolveProjectName(manifest);
  const theme = config.theme;
  const preset = resolvePreset(theme.preset ?? "developer");
  const isGitHubRepo = config.source.repo.includes("/");

  const navYaml = renderNavYaml(navigation, 0);

  // Resolve features: preset provides defaults, user overrides take precedence
  let resolvedFeatures = preset && theme.features.length === ThemeSchemaDefaults.features.length
    ? [...preset.features]
    : [...theme.features];

  // Apply layout overrides
  const layout = theme.layout ?? "tabs";
  if (layout === "sidebar") {
    resolvedFeatures = resolvedFeatures.filter(
      (f) => f !== "navigation.tabs" && f !== "navigation.tabs.sticky"
    );
    if (!resolvedFeatures.includes("toc.integrate")) {
      resolvedFeatures.push("toc.integrate");
    }
  } else if (layout === "tabs-sticky") {
    if (!resolvedFeatures.includes("navigation.tabs")) {
      resolvedFeatures.push("navigation.tabs");
    }
    if (!resolvedFeatures.includes("navigation.tabs.sticky")) {
      resolvedFeatures.push("navigation.tabs.sticky");
    }
  } else {
    // "tabs" (default) — ensure navigation.tabs present
    if (!resolvedFeatures.includes("navigation.tabs")) {
      resolvedFeatures.push("navigation.tabs");
    }
  }

  const features = resolvedFeatures.map((f) => `      - ${f}`).join("\n");

  // Resolve palette
  const scheme = preset ? preset.palette.scheme : theme.palette;
  const toggleScheme = preset?.palette.toggleScheme;

  // Build palette section
  let paletteYaml: string;
  if (toggleScheme) {
    paletteYaml = `  palette:
    - scheme: ${scheme}
      primary: custom
      accent: custom
      toggle:
        icon: material/brightness-${scheme === "slate" ? "4" : "7"}
        name: Switch to ${scheme === "slate" ? "light" : "dark"} mode
    - scheme: ${toggleScheme}
      primary: custom
      accent: custom
      toggle:
        icon: material/brightness-${toggleScheme === "slate" ? "4" : "7"}
        name: Switch to ${scheme === "slate" ? "dark" : "light"} mode`;
  } else {
    paletteYaml = `  palette:
    - scheme: ${scheme}
      primary: custom
      accent: custom
      toggle:
        icon: material/brightness-7
        name: Switch to dark mode
    - scheme: slate
      primary: custom
      accent: custom
      toggle:
        icon: material/brightness-4
        name: Switch to light mode`;
  }

  // Font section
  const fonts = preset?.fonts;
  const fontYaml = fonts
    ? `  font:\n    text: "${fonts.text}"\n    code: "${fonts.code}"`
    : "";

  // Build extra_css list
  const extraCss: string[] = [];
  if (preset) {
    extraCss.push("stylesheets/preset.css");
  }
  if (theme.custom_css) {
    extraCss.push(...theme.custom_css);
  }
  const extraCssYaml = extraCss.length > 0
    ? `\nextra_css:\n${extraCss.map((c) => `  - ${c}`).join("\n")}\n`
    : "";

  // Build extra_javascript list
  const extraJs = theme.custom_js ?? [];
  const extraJsYaml = extraJs.length > 0
    ? `\nextra_javascript:\n${extraJs.map((j) => `  - ${j}`).join("\n")}\n`
    : "";

  // Plugins — only include built-in plugins that ship with mkdocs-material.
  // Optional plugins (minify, glightbox) are added by CI/deploy pipelines.
  let pluginsYaml = `plugins:
  - search:
      lang: en`;

  // Versioning — add mike plugin
  if (config.versioning.enabled) {
    pluginsYaml += `\n  - mike:\n      alias_type: symlink\n      canonical_version: "${config.versioning.default_alias}"`;
  }

  // Extra section
  let extraYaml = `extra:
  generator: false
  social: []`;

  if (config.versioning.enabled) {
    extraYaml += `\n  version:\n    provider: mike\n    default: "${config.versioning.default_alias}"`;
  }

  return `# DocWalk Generated Configuration
# Do not edit manually — re-run 'docwalk generate' to update

site_name: "${siteName} Documentation"
site_description: "Auto-generated documentation for ${siteName}"
site_url: "${config.domain.custom ? `https://${config.domain.custom}${config.domain.base_path}` : ""}"

${isGitHubRepo ? `repo_url: "https://github.com/${config.source.repo}"\nrepo_name: "${config.source.repo}"` : `# repo_url: configure with your repository URL`}

theme:
  name: material
${paletteYaml}
${theme.logo ? `  logo: ${theme.logo}` : ""}
${theme.favicon ? `  favicon: ${theme.favicon}` : ""}
${fontYaml}
  features:
${features}

markdown_extensions:
  - admonition
  - pymdownx.details
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_code_format
  - pymdownx.highlight:
      anchor_linenums: true
  - pymdownx.tabbed:
      alternate_style: true
  - pymdownx.tasklist:
      custom_checkbox: true
  - tables
  - attr_list
  - md_in_html
  - toc:
      permalink: true

${pluginsYaml}
${extraCssYaml}${extraJsYaml}
nav:
${navYaml}

${extraYaml}
`;
}

/** Default feature list from ThemeSchema — used to detect if user has customized features */
const ThemeSchemaDefaults = {
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
};

// ─── Audience Separation ────────────────────────────────────────────────────

function resolveAudienceSeparation(config: DocWalkConfig, manifest: AnalysisManifest): boolean {
  const setting = config.analysis.audience;
  if (setting === "split") return true;
  if (setting === "unified") return false;

  // Auto-detect: check if it looks like a library
  return detectProjectType(manifest) === "library";
}

function detectProjectType(manifest: AnalysisManifest): "library" | "application" | "unknown" {
  if (manifest.projectMeta.projectType) return manifest.projectMeta.projectType;

  const allPaths = manifest.modules.map((m) => m.filePath);

  // Application indicators
  const hasPages = allPaths.some((p) => p.includes("pages/") || p.includes("app/"));
  const hasBin = allPaths.some((p) => p.includes("bin/") || p.includes("cli/"));
  const hasElectron = allPaths.some((p) => p.includes("electron") || p.includes("main.ts") || p.includes("main.js"));

  if (hasPages || hasElectron) return "application";

  // Library indicators: high export ratio
  const totalSymbols = manifest.modules.reduce((s, m) => s + m.symbols.length, 0);
  const exportedSymbols = manifest.modules.reduce(
    (s, m) => s + m.symbols.filter((sym) => sym.exported).length,
    0
  );

  if (totalSymbols > 0 && exportedSymbols / totalSymbols > 0.5) return "library";
  if (hasBin) return "application";

  return "unknown";
}
