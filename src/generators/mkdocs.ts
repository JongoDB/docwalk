/**
 * DocWalk Generator — MkDocs Material
 *
 * Transforms an AnalysisManifest into a complete MkDocs Material
 * documentation site: Markdown pages, mkdocs.yml, navigation tree,
 * and supporting assets.
 */

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import simpleGit from "simple-git";
import type { DocWalkConfig, HooksConfig } from "../config/schema.js";
import { executeHooks } from "../utils/hooks.js";
import type {
  AnalysisManifest,
  ModuleInfo,
  Symbol,
  GeneratedPage,
  NavigationItem,
  DependencyEdge,
} from "../analysis/types.js";
import { getLanguageDisplayName, type LanguageId } from "../analysis/language-detect.js";
import { resolvePreset, type ThemePreset } from "./theme-presets.js";

export interface GenerateOptions {
  manifest: AnalysisManifest;
  config: DocWalkConfig;
  outputDir: string;
  onProgress?: (message: string) => void;
  hooks?: HooksConfig;
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
  pages.push(generateOverviewPage(manifest));

  // Getting Started
  pages.push(generateGettingStartedPage(manifest, config));

  // Architecture page
  if (config.analysis.dependency_graph) {
    onProgress?.("Generating architecture page...");
    pages.push(generateArchitecturePage(manifest));
  }

  // API Reference pages — one per module, grouped logically
  onProgress?.("Generating API reference pages...");
  const modulesByGroup = groupModulesLogically(manifest.modules);
  for (const [group, modules] of Object.entries(modulesByGroup)) {
    for (const mod of modules) {
      pages.push(generateModulePage(mod, group));
    }
  }

  // Changelog
  if (config.analysis.changelog) {
    onProgress?.("Generating changelog page...");
    const changelogPage = await generateChangelogPage(config);
    pages.push(changelogPage);
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
  const navigation = buildNavigation(pages);
  const mkdocsYml = generateMkdocsConfig(manifest, config, navigation);
  await writeFile(path.join(outputDir, "mkdocs.yml"), mkdocsYml);

  // ── Post-build hooks ───────────────────────────────────────────────────
  await executeHooks("post_build", hooks, { cwd: outputDir });

  onProgress?.(`Documentation generated: ${pages.length} pages`);
}

// ─── Page Generators ────────────────────────────────────────────────────────

function generateOverviewPage(manifest: AnalysisManifest): GeneratedPage {
  const { projectMeta: meta, stats } = manifest;

  // Mermaid pie chart for language breakdown
  const pieChart = meta.languages.length > 1
    ? `\`\`\`mermaid
pie title Language Distribution
${meta.languages.map((l) => `    "${getLanguageDisplayName(l.name as LanguageId)}" : ${l.fileCount}`).join("\n")}
\`\`\``
    : "";

  // Top 10 most-connected modules
  const connectionCounts = new Map<string, number>();
  for (const edge of manifest.dependencyGraph.edges) {
    connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
    connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
  }
  const topModules = [...connectionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const topModulesTable = topModules.length > 0
    ? `## Most Connected Modules\n\n| Module | Connections |\n|--------|------------|\n${topModules.map(([file, count]) => {
        const slug = file.replace(/\.[^.]+$/, "").replace(/\//g, "-");
        return `| [\`${path.basename(file)}\`](api/${slug}.md) | ${count} |`;
      }).join("\n")}\n`
    : "";

  const langTable = meta.languages
    .map((l) => `| ${getLanguageDisplayName(l.name as LanguageId)} | ${l.fileCount} | ${l.percentage}% |`)
    .join("\n");

  const content = `---
title: Overview
description: Documentation overview for ${meta.name}
---

# ${meta.name}

${meta.description || `Auto-generated documentation for the **${meta.name}** codebase.`}

## Project Summary

| Metric | Value |
|--------|-------|
| **Total Files** | ${stats.totalFiles} |
| **Total Symbols** | ${stats.totalSymbols} |
| **Total Lines** | ${stats.totalLines.toLocaleString()} |
| **Languages** | ${meta.languages.length} |

## Language Breakdown

${pieChart}

| Language | Files | Share |
|----------|-------|-------|
${langTable}

${topModulesTable}

## Entry Points

${meta.entryPoints.map((e) => {
  const slug = e.replace(/\.[^.]+$/, "").replace(/\//g, "-");
  return `- [\`${e}\`](api/${slug}.md)`;
}).join("\n")}

## Quick Links

- [Getting Started](getting-started.md) — Setup and usage guide
- [Architecture](architecture.md) — System design and dependency graph
- [API Reference](api/) — Complete API documentation

---

*Generated by [DocWalk](https://docwalk.dev) from commit \`${manifest.commitSha.slice(0, 8)}\`*
`;

  return {
    path: "index.md",
    title: "Overview",
    content,
    navGroup: "",
    navOrder: 0,
  };
}

function generateGettingStartedPage(
  manifest: AnalysisManifest,
  config: DocWalkConfig
): GeneratedPage {
  const meta = manifest.projectMeta;

  // Detect package manager from the project
  const pkgManager = detectPackageManager(manifest.modules);

  const installCmd = getInstallCommand(pkgManager);
  const runCmd = getRunCommand(pkgManager);

  const content = `---
title: Getting Started
description: Setup and installation guide for ${meta.name}
---

# Getting Started

## Prerequisites

${meta.languages.map((l) => `- ${getLanguageDisplayName(l.name as LanguageId)} development environment`).join("\n")}

## Installation

=== "${pkgManager.displayName}"

    \`\`\`bash
    # Clone the repository
    git clone ${meta.repository?.includes("/") ? `https://github.com/${meta.repository}` : "<repository-url>"}
    cd ${meta.name}

    # Install dependencies
    ${installCmd}
    \`\`\`

${pkgManager.id !== "npm" ? `=== "npm"

    \`\`\`bash
    git clone ${meta.repository?.includes("/") ? `https://github.com/${meta.repository}` : "<repository-url>"}
    cd ${meta.name}
    npm install
    \`\`\`
` : ""}

## Project Structure

\`\`\`
${generateDirectoryTree(manifest.modules)}
\`\`\`

## Entry Points

${meta.entryPoints.map((e) => {
  const slug = e.replace(/\.[^.]+$/, "").replace(/\//g, "-");
  return `- [\`${e}\`](api/${slug}.md)`;
}).join("\n")}

---

*Auto-generated by DocWalk. Update your source code and re-sync to keep this page current.*
`;

  return {
    path: "getting-started.md",
    title: "Getting Started",
    content,
    navGroup: "",
    navOrder: 1,
  };
}

function generateArchitecturePage(
  manifest: AnalysisManifest
): GeneratedPage {
  const { dependencyGraph } = manifest;

  // Cluster nodes by top-level directory
  const clusters = new Map<string, string[]>();
  for (const node of dependencyGraph.nodes) {
    const parts = node.split("/");
    const dir = parts.length > 2 ? parts.slice(0, 2).join("/") : parts[0];
    if (!clusters.has(dir)) clusters.set(dir, []);
    clusters.get(dir)!.push(node);
  }

  // Build connection count for each node to find top N
  const connectionCounts = new Map<string, number>();
  for (const edge of dependencyGraph.edges) {
    connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
    connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
  }

  // Limit to top 30 most-connected nodes for readability
  const topNodes = new Set(
    [...connectionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([node]) => node)
  );

  // If fewer than 30 total nodes, include all
  if (dependencyGraph.nodes.length <= 30) {
    for (const node of dependencyGraph.nodes) {
      topNodes.add(node);
    }
  }

  // Assign colors by directory cluster
  const dirColors = [":::blue", ":::green", ":::orange", ":::pink", ":::purple"];
  const dirColorMap = new Map<string, string>();
  let colorIdx = 0;
  for (const [dir] of clusters) {
    dirColorMap.set(dir, dirColors[colorIdx % dirColors.length]);
    colorIdx++;
  }

  // Build Mermaid graph with subgraphs
  let mermaidContent = "graph LR\n";

  // Add subgraphs for each directory
  for (const [dir, nodes] of clusters) {
    const filteredNodes = nodes.filter((n) => topNodes.has(n));
    if (filteredNodes.length === 0) continue;

    mermaidContent += `  subgraph ${sanitizeMermaidId(dir)}["${dir}"]\n`;
    for (const node of filteredNodes) {
      mermaidContent += `    ${sanitizeMermaidId(node)}["${path.basename(node)}"]\n`;
    }
    mermaidContent += "  end\n";
  }

  // Add edges (only between visible nodes)
  const visibleEdges = dependencyGraph.edges.filter(
    (e) => topNodes.has(e.from) && topNodes.has(e.to)
  );
  for (const edge of visibleEdges.slice(0, 100)) {
    const style = edge.isTypeOnly ? "-.->" : "-->";
    mermaidContent += `  ${sanitizeMermaidId(edge.from)} ${style} ${sanitizeMermaidId(edge.to)}\n`;
  }

  // Module relationship table sorted by connections
  const moduleRows = manifest.modules
    .map((m) => {
      const outgoing = dependencyGraph.edges.filter((e) => e.from === m.filePath).length;
      const incoming = dependencyGraph.edges.filter((e) => e.to === m.filePath).length;
      return { filePath: m.filePath, deps: outgoing, dependents: incoming, total: outgoing + incoming };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 30);

  const content = `---
title: Architecture
description: System architecture and dependency graph
---

# Architecture

## Dependency Graph

!!! info "Graph Legend"
    Solid arrows (\`→\`) are value imports. Dashed arrows (\`⇢\`) are type-only imports.
    Nodes are clustered by directory. Only the ${topNodes.size} most-connected modules are shown.

\`\`\`mermaid
${mermaidContent}\`\`\`

${dependencyGraph.nodes.length > 30 ? `\n!!! note "Showing ${topNodes.size} of ${dependencyGraph.nodes.length} modules"\n    The full graph has ${dependencyGraph.nodes.length} nodes and ${dependencyGraph.edges.length} edges.\n` : ""}

## Module Relationships

| Module | Dependencies | Dependents | Total |
|--------|:-----------:|:----------:|:-----:|
${moduleRows.map((r) => {
  const slug = r.filePath.replace(/\.[^.]+$/, "").replace(/\//g, "-");
  return `| [\`${r.filePath}\`](api/${slug}.md) | ${r.deps} | ${r.dependents} | **${r.total}** |`;
}).join("\n")}

## Statistics

| Metric | Value |
|--------|-------|
| Modules in graph | **${dependencyGraph.nodes.length}** |
| Dependency edges | **${dependencyGraph.edges.length}** |
| Type-only imports | **${dependencyGraph.edges.filter((e) => e.isTypeOnly).length}** |
| Avg dependencies/module | **${dependencyGraph.nodes.length > 0 ? (dependencyGraph.edges.length / dependencyGraph.nodes.length).toFixed(1) : "0"}** |

---

*Generated by DocWalk from commit \`${manifest.commitSha.slice(0, 8)}\`*
`;

  return {
    path: "architecture.md",
    title: "Architecture",
    content,
    navGroup: "",
    navOrder: 2,
  };
}

function generateModulePage(mod: ModuleInfo, group: string): GeneratedPage {
  const slug = mod.filePath
    .replace(/\.[^.]+$/, "")
    .replace(/\//g, "-");

  const publicSymbols = mod.symbols.filter((s) => s.exported);
  const privateSymbols = mod.symbols.filter((s) => !s.exported);
  const langTag = getLanguageTag(mod.language);

  let content = `---
title: "${path.basename(mod.filePath)}"
description: "${mod.moduleDoc?.summary || `API reference for ${mod.filePath}`}"
---

# ${path.basename(mod.filePath)}

\`${mod.filePath}\` · ${getLanguageDisplayName(mod.language as LanguageId)} · ${mod.lineCount} lines

${mod.moduleDoc?.summary || mod.aiSummary || ""}

${mod.moduleDoc?.description && mod.moduleDoc.description !== mod.moduleDoc.summary ? mod.moduleDoc.description : ""}

${mod.aiSummary && mod.moduleDoc?.summary ? `!!! abstract "AI Summary"\n    ${mod.aiSummary}\n` : ""}

`;

  // Exports summary table
  if (publicSymbols.length > 0) {
    content += `## Exports\n\n`;
    content += `| Name | Kind | Description |\n`;
    content += `|------|------|-------------|\n`;
    for (const sym of publicSymbols) {
      const kindBadge = getKindBadge(sym.kind);
      content += `| [\`${sym.name}\`](#${sym.name.toLowerCase()}) | ${kindBadge} | ${sym.docs?.summary || sym.aiSummary || ""} |\n`;
    }
    content += "\n";
  }

  // Detailed symbol docs
  if (publicSymbols.length > 0) {
    content += `## API\n\n`;
    for (const sym of publicSymbols) {
      content += renderSymbol(sym, langTag);
    }
  }

  // Imports
  if (mod.imports.length > 0) {
    content += `## Dependencies\n\n`;
    for (const imp of mod.imports) {
      const typeOnly = imp.isTypeOnly ? " *(type-only)*" : "";
      const names = imp.specifiers.map((s) => s.alias ? `${s.name} as ${s.alias}` : s.name).join(", ");
      content += `- \`${imp.source}\`${names ? ` — ${names}` : ""}${typeOnly}\n`;
    }
    content += "\n";
  }

  // Internal symbols (collapsible)
  if (privateSymbols.length > 0) {
    content += `## Internal\n\n`;
    content += `??? note "Show ${privateSymbols.length} internal symbols"\n\n`;
    for (const sym of privateSymbols) {
      const kindBadge = getKindBadge(sym.kind);
      content += `    - \`${sym.name}\` — ${kindBadge}${sym.docs?.summary ? ` — ${sym.docs.summary}` : ""}\n`;
    }
    content += "\n";
  }

  content += `---\n\n*Source: \`${mod.filePath}\` · Last analyzed: ${mod.analyzedAt}*\n`;

  return {
    path: `api/${slug}.md`,
    title: path.basename(mod.filePath),
    content,
    navGroup: group || "API Reference",
    navOrder: 10,
  };
}

/**
 * Generate changelog from git log, parsing conventional commits and
 * grouping by version tags.
 */
async function generateChangelogPage(config: DocWalkConfig): Promise<GeneratedPage> {
  let changelogContent = "";

  try {
    const repoRoot = config.source.provider === "local"
      ? path.resolve(config.source.repo)
      : process.cwd();

    const git = simpleGit(repoRoot);

    // Get tags for version grouping
    const tagsResult = await git.tags();
    const versionTags = tagsResult.all
      .filter((t) => /^v?\d+\.\d+/.test(t))
      .reverse();

    // Get recent commits
    const logResult = await git.log({
      maxCount: config.analysis.changelog_depth || 100,
      "--format": "%H|%s|%an|%aI",
    });

    if (logResult.all.length > 0) {
      // Group commits by type (conventional commits)
      const grouped: Record<string, Array<{ hash: string; message: string; author: string; date: string }>> = {};

      for (const commit of logResult.all) {
        const type = parseConventionalType(commit.message);
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push({
          hash: commit.hash,
          message: commit.message,
          author: commit.author_name,
          date: commit.date,
        });
      }

      // Version tags section
      if (versionTags.length > 0) {
        changelogContent += `## Versions\n\n`;
        for (const tag of versionTags.slice(0, 20)) {
          changelogContent += `- **${tag}**\n`;
        }
        changelogContent += "\n";
      }

      // Grouped by type
      const typeLabels: Record<string, string> = {
        feat: "Features",
        fix: "Bug Fixes",
        docs: "Documentation",
        refactor: "Refactoring",
        test: "Tests",
        chore: "Chores",
        perf: "Performance",
        ci: "CI/CD",
        style: "Style",
        build: "Build",
        other: "Other Changes",
      };

      for (const [type, label] of Object.entries(typeLabels)) {
        const commits = grouped[type];
        if (!commits || commits.length === 0) continue;

        changelogContent += `## ${label}\n\n`;
        for (const commit of commits.slice(0, 20)) {
          const shortHash = commit.hash.slice(0, 7);
          const cleanMsg = commit.message.replace(/^(feat|fix|docs|refactor|test|chore|perf|ci|style|build)(\([^)]*\))?:\s*/, "");
          const dateStr = commit.date ? new Date(commit.date).toLocaleDateString() : "";
          changelogContent += `- \`${shortHash}\` ${cleanMsg}${dateStr ? ` *(${dateStr})*` : ""}\n`;
        }
        changelogContent += "\n";
      }
    }
  } catch {
    changelogContent = "*Unable to generate changelog — not a git repository or git is not available.*\n";
  }

  if (!changelogContent) {
    changelogContent = "*No commits found.*\n";
  }

  const content = `---
title: Changelog
description: Project changelog generated from git history
---

# Changelog

${changelogContent}

---

*Auto-generated from git history by DocWalk. Updates on each sync.*
`;

  return {
    path: "changelog.md",
    title: "Changelog",
    content,
    navGroup: "",
    navOrder: 99,
  };
}

// ─── Symbol Renderer ────────────────────────────────────────────────────────

function renderSymbol(sym: Symbol, langTag: string): string {
  let md = `### \`${sym.name}\`\n\n`;

  // Deprecation warning
  if (sym.docs?.deprecated) {
    md += `!!! warning "Deprecated"\n    ${typeof sym.docs.deprecated === "string" ? sym.docs.deprecated : "This API is deprecated."}\n\n`;
  }

  // Signature with proper language tag
  if (sym.signature) {
    md += `\`\`\`${langTag}\n${sym.signature}\n\`\`\`\n\n`;
  }

  // Summary
  if (sym.docs?.summary) {
    md += `${sym.docs.summary}\n\n`;
  }

  // Extended description
  if (sym.docs?.description && sym.docs.description !== sym.docs.summary) {
    md += `${sym.docs.description}\n\n`;
  }

  // AI-generated summary
  if (sym.aiSummary && !sym.docs?.summary) {
    md += `${sym.aiSummary}\n\n`;
  }

  // Parameters (prefer extracted params, fall back to JSDoc)
  if (sym.parameters && sym.parameters.length > 0) {
    if (sym.parameters.length > 5) {
      // Collapsible for large parameter tables
      md += `??? info "Parameters (${sym.parameters.length})"\n\n`;
      md += `    | Name | Type | Default | Description |\n`;
      md += `    |------|------|---------|-------------|\n`;
      for (const param of sym.parameters) {
        const docDesc = sym.docs?.params?.[param.name] || param.description || "";
        const opt = param.optional ? "?" : "";
        const def = param.defaultValue ? `\`${param.defaultValue}\`` : "";
        md += `    | \`${param.name}${opt}\` | \`${param.type || "unknown"}\` | ${def} | ${docDesc} |\n`;
      }
      md += "\n";
    } else {
      md += `**Parameters:**\n\n`;
      md += `| Name | Type | Default | Description |\n`;
      md += `|------|------|---------|-------------|\n`;
      for (const param of sym.parameters) {
        const docDesc = sym.docs?.params?.[param.name] || param.description || "";
        const opt = param.optional ? "?" : "";
        const def = param.defaultValue ? `\`${param.defaultValue}\`` : "";
        md += `| \`${param.name}${opt}\` | \`${param.type || "unknown"}\` | ${def} | ${docDesc} |\n`;
      }
      md += "\n";
    }
  } else if (sym.docs?.params) {
    md += `**Parameters:**\n\n`;
    md += `| Name | Description |\n`;
    md += `|------|-------------|\n`;
    for (const [name, desc] of Object.entries(sym.docs.params)) {
      md += `| \`${name}\` | ${desc} |\n`;
    }
    md += "\n";
  }

  // Return type
  if (sym.returns?.type || sym.docs?.returns) {
    md += `**Returns:** ${sym.returns?.type ? `\`${sym.returns.type}\`` : ""} ${sym.docs?.returns || ""}\n\n`;
  }

  // Since tag
  if (sym.docs?.since) {
    md += `*Since: ${sym.docs.since}*\n\n`;
  }

  md += "---\n\n";
  return md;
}

// ─── Navigation Builder ─────────────────────────────────────────────────────

function buildNavigation(pages: GeneratedPage[]): NavigationItem[] {
  const nav: NavigationItem[] = [];

  // Top-level pages
  const topLevel = pages
    .filter((p) => !p.path.includes("/"))
    .sort((a, b) => a.navOrder - b.navOrder);

  for (const page of topLevel) {
    nav.push({ title: page.title, path: page.path });
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

// ─── MkDocs Config Generator ────────────────────────────────────────────────

function generateMkdocsConfig(
  manifest: AnalysisManifest,
  config: DocWalkConfig,
  navigation: NavigationItem[]
): string {
  const rawName = manifest.projectMeta.name;
  const siteName = rawName === "." ? path.basename(process.cwd()) : rawName;
  const theme = config.theme;
  const preset = resolvePreset(theme.preset ?? "developer");
  const isGitHubRepo = config.source.repo.includes("/");

  const navYaml = renderNavYaml(navigation, 0);

  // Resolve features: preset provides defaults, user overrides take precedence
  const features = (preset && theme.features.length === ThemeSchemaDefaults.features.length
    ? preset.features
    : theme.features
  ).map((f) => `      - ${f}`).join("\n");

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

  // Plugins
  let pluginsYaml = `plugins:
  - search:
      lang: en
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

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Detect logical groups from file paths (routes, models, services, etc.) */
const LOGICAL_SECTIONS: Record<string, string[]> = {
  "CLI": ["cli", "commands", "bin"],
  "Core": ["core", "engine", "kernel"],
  "Configuration": ["config", "configuration", "settings"],
  "Analysis": ["analysis", "parsers", "ast"],
  "Models": ["models", "entities", "schemas", "types"],
  "Services": ["services", "providers", "adapters"],
  "Routes": ["routes", "controllers", "handlers", "endpoints", "api"],
  "Components": ["components", "views", "pages", "layouts", "widgets"],
  "Hooks": ["hooks", "composables"],
  "Utilities": ["utils", "helpers", "lib", "common", "shared"],
  "Generators": ["generators", "templates", "renderers"],
  "Sync": ["sync", "replication"],
  "Deploy": ["deploy", "deployment", "providers"],
  "Tests": ["tests", "test", "__tests__", "spec"],
  "Middleware": ["middleware"],
  "Database": ["database", "db", "repositories", "dao"],
};

function groupModulesLogically(
  modules: ModuleInfo[]
): Record<string, ModuleInfo[]> {
  const groups: Record<string, ModuleInfo[]> = {};
  for (const mod of modules) {
    const section = detectLogicalSection(mod.filePath);
    if (!groups[section]) groups[section] = [];
    groups[section].push(mod);
  }
  return groups;
}

function detectLogicalSection(filePath: string): string {
  const parts = filePath.toLowerCase().split("/");

  for (const [section, keywords] of Object.entries(LOGICAL_SECTIONS)) {
    for (const part of parts) {
      if (keywords.includes(part)) return section;
    }
  }

  // Fall back to directory name
  const dirParts = filePath.split("/");
  if (dirParts.length > 1) {
    const dir = dirParts[dirParts.length - 2];
    return dir.charAt(0).toUpperCase() + dir.slice(1);
  }

  return "API Reference";
}

function groupByLogicalSection(
  pages: GeneratedPage[]
): Record<string, GeneratedPage[]> {
  const sections: Record<string, GeneratedPage[]> = {};
  for (const page of pages) {
    const section = page.navGroup || "API Reference";
    if (!sections[section]) sections[section] = [];
    sections[section].push(page);
  }
  return sections;
}

function renderNavYaml(items: NavigationItem[], depth: number): string {
  const indent = "  ".repeat(depth);
  let yaml = "";

  for (const item of items) {
    if (item.children && item.children.length > 0) {
      yaml += `${indent}  - "${item.title}":\n`;
      yaml += renderNavYaml(item.children, depth + 1);
    } else if (item.path) {
      yaml += `${indent}  - "${item.title}": ${item.path}\n`;
    }
  }

  return yaml;
}

interface PackageManager {
  id: string;
  displayName: string;
}

function detectPackageManager(modules: ModuleInfo[]): PackageManager {
  // Check file paths for lockfiles (they may not be in the module list,
  // but we can check common patterns from the file paths)
  const allPaths = modules.map((m) => m.filePath);

  // Check what language is dominant
  const hasGo = allPaths.some((p) => p.endsWith(".go"));
  const hasPython = allPaths.some((p) => p.endsWith(".py"));
  const hasRust = allPaths.some((p) => p.endsWith(".rs"));

  if (hasGo) return { id: "go", displayName: "Go" };
  if (hasPython) return { id: "pip", displayName: "pip" };
  if (hasRust) return { id: "cargo", displayName: "Cargo" };

  // Default to npm for JS/TS projects
  return { id: "npm", displayName: "npm" };
}

function getInstallCommand(pm: PackageManager): string {
  switch (pm.id) {
    case "yarn": return "yarn install";
    case "pnpm": return "pnpm install";
    case "go": return "go mod download";
    case "pip": return "pip install -r requirements.txt";
    case "cargo": return "cargo build";
    default: return "npm install";
  }
}

function getRunCommand(pm: PackageManager): string {
  switch (pm.id) {
    case "yarn": return "yarn";
    case "pnpm": return "pnpm";
    case "go": return "go run .";
    case "pip": return "python";
    case "cargo": return "cargo run";
    default: return "npm run";
  }
}

function generateDirectoryTree(modules: ModuleInfo[]): string {
  const dirs = new Set<string>();
  for (const mod of modules) {
    const parts = mod.filePath.split("/");
    for (let i = 1; i <= parts.length; i++) {
      dirs.add(parts.slice(0, i).join("/"));
    }
  }

  const sorted = [...dirs].sort();
  return sorted.slice(0, 40).map((d) => {
    const depth = d.split("/").length - 1;
    const indent = "  ".repeat(depth);
    const name = d.split("/").pop()!;
    const isFile = d.includes(".");
    return `${indent}${isFile ? "" : ""}${name}`;
  }).join("\n");
}

function sanitizeMermaidId(filePath: string): string {
  return filePath.replace(/[^a-zA-Z0-9]/g, "_");
}

function getLanguageTag(language: string): string {
  const map: Record<string, string> = {
    typescript: "typescript",
    javascript: "javascript",
    python: "python",
    go: "go",
    rust: "rust",
    java: "java",
    csharp: "csharp",
    ruby: "ruby",
    php: "php",
    swift: "swift",
    kotlin: "kotlin",
    scala: "scala",
    elixir: "elixir",
    dart: "dart",
    lua: "lua",
    zig: "zig",
    haskell: "haskell",
    c: "c",
    cpp: "cpp",
  };
  return map[language] || language;
}

function getKindBadge(kind: string): string {
  const badges: Record<string, string> = {
    function: ":material-function: function",
    class: ":material-cube-outline: class",
    interface: ":material-shape-outline: interface",
    type: ":material-tag: type",
    enum: ":material-format-list-bulleted: enum",
    constant: ":material-alpha-c-circle: constant",
    variable: ":material-variable: variable",
    method: ":material-function-variant: method",
    property: ":material-code-braces: property",
    module: ":material-package-variant: module",
    namespace: ":material-folder-outline: namespace",
  };
  return badges[kind] || kind;
}

function parseConventionalType(message: string): string {
  const match = message.match(/^(feat|fix|docs|refactor|test|chore|perf|ci|style|build)(\([^)]*\))?:/);
  return match ? match[1] : "other";
}
