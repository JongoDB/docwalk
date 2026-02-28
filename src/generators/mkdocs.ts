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
import { generateOverviewPageNarrative } from "./pages/overview.js";
import { generateGettingStartedPageNarrative } from "./pages/getting-started.js";
import { generateArchitecturePageNarrative } from "./pages/architecture.js";
import type { AIProvider } from "../analysis/providers/base.js";
import { createProvider, resolveApiKey } from "../analysis/providers/index.js";

export interface GenerateOptions {
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
 * Generate a complete documentation site (Zensical / MkDocs-compatible).
 */
export async function generateDocs(options: GenerateOptions): Promise<void> {
  const { manifest, config, outputDir, onProgress, hooks, readFile, tryMode } = options;

  // ── Pre-build hooks ────────────────────────────────────────────────────
  await executeHooks("pre_build", hooks, { cwd: outputDir });

  const docsDir = path.join(outputDir, "docs");
  await mkdir(docsDir, { recursive: true });

  // ── Resolve AI provider for narrative generation ──────────────────────
  let aiProvider: AIProvider | undefined;
  if (config.analysis.ai_summaries && config.analysis.ai_provider) {
    aiProvider = createProvider(config.analysis.ai_provider) as AIProvider | undefined;
  }
  const useNarrative = !!(config.analysis.ai_narrative && aiProvider && readFile);

  // ── 0. Optional: AI-driven structure analysis ──────────────────────────
  let structurePlan: import("../analysis/structure-advisor.js").StructurePlan | undefined;
  if (config.analysis.ai_structure && aiProvider) {
    try {
      onProgress?.("Analyzing codebase structure...");
      const { analyzeStructure } = await import("../analysis/structure-advisor.js");
      structurePlan = await analyzeStructure(manifest, aiProvider);
    } catch {
      // Structure analysis failure is non-fatal
    }
  }

  // ── 1. Generate pages ──────────────────────────────────────────────────
  const pages: GeneratedPage[] = [];

  // Launch narrative pages in parallel when AI is enabled
  if (useNarrative) {
    onProgress?.("Generating narrative pages (overview, getting started, architecture)...");
    const narrativePromises: Array<Promise<GeneratedPage>> = [];

    narrativePromises.push(
      safeGenerateAsync("Overview",
        () => generateOverviewPageNarrative(manifest, config, aiProvider!, readFile!), onProgress)
    );
    narrativePromises.push(
      safeGenerateAsync("Getting Started",
        () => generateGettingStartedPageNarrative(manifest, config, aiProvider!, readFile!), onProgress)
    );

    if (config.analysis.dependency_graph && config.analysis.architecture_tiers === false) {
      const repoUrl = config.source.repo.includes("/") ? config.source.repo : undefined;
      narrativePromises.push(
        safeGenerateAsync("Architecture",
          () => generateArchitecturePageNarrative(manifest, aiProvider!, readFile!, repoUrl, config.source.branch), onProgress)
      );
    }

    const narrativeResults = await Promise.all(narrativePromises);
    pages.push(...narrativeResults);

    // Add non-narrative architecture pages if not already handled
    if (config.analysis.dependency_graph && config.analysis.architecture_tiers !== false) {
      const archResult = safeGenerate("Architecture", () => generateTieredArchitecturePages(manifest), onProgress);
      pages.push(...(Array.isArray(archResult) ? archResult : [archResult]));
    }
  } else {
    // Non-narrative fallback (sequential, no LLM calls)
    const overviewResult = safeGenerate("Overview", () => generateOverviewPage(manifest, config), onProgress);
    pages.push(...(Array.isArray(overviewResult) ? overviewResult : [overviewResult]));

    const gettingStartedResult = safeGenerate("Getting Started", () => generateGettingStartedPage(manifest, config), onProgress);
    pages.push(...(Array.isArray(gettingStartedResult) ? gettingStartedResult : [gettingStartedResult]));

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

  // ── End-user documentation pages ──────────────────────────────────────
  if (config.analysis.user_docs !== false && !tryMode) {
    onProgress?.("Generating end-user documentation...");
    const userDocsConfig = config.analysis.user_docs_config;
    const { generateUserGuidePage, generateUserGettingStartedPage, generateFeaturesPage,
            generateTroubleshootingPage, generateFAQPage,
            generateUserGuidePageNarrative, generateUserGettingStartedPageNarrative,
            generateFeaturesPageNarrative, generateTroubleshootingPageNarrative,
            generateFAQPageNarrative } = await import("./pages/index.js");

    if (useNarrative) {
      // Launch all user doc narrative pages in parallel
      const userDocPromises: Array<Promise<GeneratedPage>> = [];

      if (userDocsConfig?.overview !== false) {
        userDocPromises.push(safeGenerateAsync("User Guide",
          () => generateUserGuidePageNarrative(manifest, config, aiProvider!), onProgress));
      }
      if (userDocsConfig?.getting_started !== false) {
        userDocPromises.push(safeGenerateAsync("User Getting Started",
          () => generateUserGettingStartedPageNarrative(manifest, config, aiProvider!), onProgress));
      }
      if (userDocsConfig?.features !== false) {
        userDocPromises.push(safeGenerateAsync("Features",
          () => generateFeaturesPageNarrative(manifest, config, aiProvider!), onProgress));
      }
      if (userDocsConfig?.troubleshooting !== false) {
        userDocPromises.push(safeGenerateAsync("Troubleshooting",
          () => generateTroubleshootingPageNarrative(manifest, config, aiProvider!), onProgress));
      }
      if (userDocsConfig?.faq !== false) {
        userDocPromises.push(safeGenerateAsync("FAQ",
          () => generateFAQPageNarrative(manifest, config, aiProvider!), onProgress));
      }

      const userDocResults = await Promise.all(userDocPromises);
      pages.push(...userDocResults);
    } else {
      if (userDocsConfig?.overview !== false) {
        const result = safeGenerate("User Guide", () => generateUserGuidePage(manifest, config), onProgress);
        pages.push(...(Array.isArray(result) ? result : [result]));
      }
      if (userDocsConfig?.getting_started !== false) {
        const result = safeGenerate("User Getting Started", () => generateUserGettingStartedPage(manifest, config), onProgress);
        pages.push(...(Array.isArray(result) ? result : [result]));
      }
      if (userDocsConfig?.features !== false) {
        const result = safeGenerate("Features", () => generateFeaturesPage(manifest, config), onProgress);
        pages.push(...(Array.isArray(result) ? result : [result]));
      }
      if (userDocsConfig?.troubleshooting !== false) {
        const result = safeGenerate("Troubleshooting", () => generateTroubleshootingPage(manifest, config), onProgress);
        pages.push(...(Array.isArray(result) ? result : [result]));
      }
      if (userDocsConfig?.faq !== false) {
        const result = safeGenerate("FAQ", () => generateFAQPage(manifest, config), onProgress);
        pages.push(...(Array.isArray(result) ? result : [result]));
      }
    }
  }

  // Insights page
  if (config.analysis.insights !== false && manifest.insights && manifest.insights.length > 0) {
    onProgress?.("Generating insights page...");
    const insightsResult = safeGenerate("Insights", () => generateInsightsPage(manifest.insights!, config), onProgress);
    pages.push(...(Array.isArray(insightsResult) ? insightsResult : [insightsResult]));
  }

  // ── AI-driven concept pages ───────────────────────────────────────────
  if (structurePlan && structurePlan.conceptPages.length > 0 && aiProvider && readFile) {
    onProgress?.("Generating concept pages...");
    const { generateConceptPage } = await import("./pages/concept.js");
    const repoUrl = config.source.repo.includes("/") ? config.source.repo : undefined;

    for (const suggestion of structurePlan.conceptPages) {
      const page = await safeGenerateAsync(suggestion.title,
        () => generateConceptPage(suggestion, manifest, aiProvider!, readFile!, repoUrl, config.source.branch),
        onProgress);
      pages.push(page);
    }
  }

  // ── Try mode: append upsell banners ───────────────────────────────────
  if (tryMode) {
    const totalModules = manifest.modules.length;
    for (const page of pages) {
      page.content += `\n\n!!! tip "Unlock Full Documentation"\n    This is a preview. DocWalk Pro includes complete API reference for all ${totalModules} modules, AI-powered narratives, end-user guides, and more.\n`;
    }
  }

  // ── 2. Write all pages ─────────────────────────────────────────────────
  for (const page of pages) {
    const pagePath = path.join(docsDir, page.path);
    await mkdir(path.dirname(pagePath), { recursive: true });
    await writeFile(pagePath, page.content);
    onProgress?.(`Written: ${page.path}`);
  }

  // ── 2b. Build Q&A index if enabled ──────────────────────────────────
  if (config.analysis.qa_widget && config.analysis.qa_config) {
    onProgress?.("Building Q&A index...");
    try {
      const { buildQAIndex } = await import("../qa/index.js");
      const qaProviderName = config.analysis.qa_config.provider || "openai";
      const qaKeyEnv = config.analysis.qa_config.api_key_env
        || config.analysis.ai_provider?.api_key_env
        || "DOCWALK_AI_KEY";
      const qaApiKey = resolveApiKey(qaProviderName, qaKeyEnv) || "";
      const qaIndex = await buildQAIndex({
        pages,
        embedder: {
          provider: qaProviderName,
          model: config.analysis.qa_config.embedding_model,
          apiKey: qaApiKey,
          base_url: config.analysis.qa_config.base_url,
        },
        onProgress,
      });

      // Write index
      const qaDir = path.join(docsDir, "_docwalk");
      await mkdir(qaDir, { recursive: true });
      await writeFile(
        path.join(qaDir, "qa-index.json"),
        JSON.stringify(qaIndex.serialized)
      );
      onProgress?.(`Q&A index built: ${qaIndex.chunkCount} chunks from ${qaIndex.pageCount} pages`);

      // Inject widget assets
      const { injectQAWidget } = await import("./qa-widget/inject.js");
      await injectQAWidget(outputDir, config.analysis.qa_config, "https://qa.docwalk.dev/api/ask");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onProgress?.(`Warning: Q&A index build failed: ${msg}`);
    }
  }

  // ── 3. Write preset CSS ──────────────────────────────────────────────
  const preset = resolvePreset(config.theme.preset ?? "developer");
  if (preset) {
    const stylesDir = path.join(docsDir, "stylesheets");
    await mkdir(stylesDir, { recursive: true });
    await writeFile(path.join(stylesDir, "preset.css"), preset.customCss);
    onProgress?.("Written: stylesheets/preset.css");

    // Write preset JS if defined
    if (preset.customJs) {
      const jsDir = path.join(docsDir, "javascripts");
      await mkdir(jsDir, { recursive: true });
      await writeFile(path.join(jsDir, "preset.js"), preset.customJs);
      onProgress?.("Written: javascripts/preset.js");
    }
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
    return buildTabbedNavigation(pages);
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

function buildTabbedNavigation(pages: GeneratedPage[]): NavigationItem[] {
  const userPages = pages.filter((p) => p.audience === "user" || p.audience === "both");
  const devPages = pages.filter((p) => p.audience === "developer" || p.audience === "both");
  // Pages with no audience set go to developer section
  const unassigned = pages.filter((p) => !p.audience);

  // ── User Docs tab ────────────────────────────────────────────────────
  const userDocs: NavigationItem = {
    title: "User Docs",
    children: [],
  };

  // Flat list sorted by navOrder
  for (const page of userPages.sort((a, b) => a.navOrder - b.navOrder)) {
    userDocs.children!.push({ title: page.title, path: page.path });
  }

  // ── Developer Docs tab ───────────────────────────────────────────────
  const devDocs: NavigationItem = {
    title: "Developer Docs",
    children: [],
  };

  // Top-level developer pages (non-api, non-architecture) sorted by navOrder
  const devTopLevel = [...devPages, ...unassigned]
    .filter((p) => !p.path.startsWith("api/") && !p.path.startsWith("architecture/") && !p.path.startsWith("concepts/"))
    .sort((a, b) => a.navOrder - b.navOrder);

  for (const page of devTopLevel) {
    devDocs.children!.push({ title: page.title, path: page.path });
  }

  // Architecture sub-nav
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
    devDocs.children!.push(archNav);
  } else {
    // Non-tiered single architecture page
    const archPage = pages.find((p) => p.path === "architecture.md");
    if (archPage) {
      devDocs.children!.push({ title: archPage.title, path: archPage.path });
    }
  }

  // API Reference sub-nav
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
    devDocs.children!.push(apiNav);
  }

  // Concept pages sub-nav
  const conceptPages = pages.filter((p) => p.path.startsWith("concepts/"));
  if (conceptPages.length > 0) {
    const conceptNav: NavigationItem = {
      title: "Concepts",
      children: conceptPages
        .sort((a, b) => a.navOrder - b.navOrder)
        .map((p) => ({ title: p.title, path: p.path })),
    };
    devDocs.children!.push(conceptNav);
  }

  return [userDocs, devDocs];
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
  const extraJs: string[] = [];
  if (preset?.customJs) {
    extraJs.push("javascripts/preset.js");
  }
  if (theme.custom_js) {
    extraJs.push(...theme.custom_js);
  }
  const extraJsYaml = extraJs.length > 0
    ? `\nextra_javascript:\n${extraJs.map((j) => `  - ${j}`).join("\n")}\n`
    : "";

  let pluginsYaml = `plugins:
  - search:
      lang: en
  - glightbox:
      touchNavigation: true
      loop: false
      effect: zoom
      slide_effect: slide
      width: 100%
      height: auto
      zoomable: true
      draggable: true
  - minify:
      minify_html: true`;

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
  - abbr
  - def_list
  - footnotes
  - pymdownx.emoji:
      emoji_index: !!python/name:material.extensions.emoji.twemoji
      emoji_generator: !!python/name:material.extensions.emoji.to_svg
  - pymdownx.inlinehilite
  - pymdownx.mark
  - pymdownx.keys

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
