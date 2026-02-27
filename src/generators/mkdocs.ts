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
import { resolveRepoRoot } from "../utils/index.js";
import type {
  AnalysisManifest,
  ModuleInfo,
  Symbol,
  GeneratedPage,
  NavigationItem,
  DependencyEdge,
  Insight,
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
  pages.push(generateOverviewPage(manifest, config));

  // Getting Started
  pages.push(generateGettingStartedPage(manifest, config));

  // Architecture pages (tiered or flat)
  if (config.analysis.dependency_graph) {
    onProgress?.("Generating architecture pages...");
    if (config.analysis.architecture_tiers !== false) {
      pages.push(...generateTieredArchitecturePages(manifest));
    } else {
      pages.push(generateArchitecturePage(manifest));
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
    pages.push(generateConfigurationPage(manifest, config));
  }

  // Types page
  if (config.analysis.types_page) {
    onProgress?.("Generating types page...");
    pages.push(generateTypesPage(manifest));
  }

  // Dependencies / SBOM page
  if (config.analysis.dependencies_page) {
    onProgress?.("Generating dependencies page...");
    if (config.analysis.sbom !== false) {
      pages.push(generateSBOMPage(manifest, config));
    } else {
      pages.push(generateDependenciesPage(manifest));
    }
  }

  // Usage guide page
  if (config.analysis.usage_guide_page) {
    onProgress?.("Generating usage guide page...");
    pages.push(generateUsageGuidePage(manifest, config));
  }

  // Changelog
  if (config.analysis.changelog) {
    onProgress?.("Generating changelog page...");
    const changelogPage = await generateChangelogPage(config);
    pages.push(changelogPage);
  }

  // Insights page
  if (config.analysis.insights !== false && manifest.insights && manifest.insights.length > 0) {
    onProgress?.("Generating insights page...");
    pages.push(generateInsightsPage(manifest.insights, config));
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

// ─── Page Generators ────────────────────────────────────────────────────────

function generateOverviewPage(manifest: AnalysisManifest, config: DocWalkConfig): GeneratedPage {
  const { projectMeta: meta, stats } = manifest;
  const projectName = meta.name === "." ? path.basename(process.cwd()) : meta.name;
  const archLink = config.analysis.architecture_tiers !== false ? "architecture/index.md" : "architecture.md";

  // Group modules by logical section for categorized navigation
  const modulesByGroup = groupModulesLogically(manifest.modules);
  const sectionLinks = Object.entries(modulesByGroup)
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([section, modules]) => {
      const topModule = modules[0];
      const slug = topModule.filePath.replace(/\.[^.]+$/, "").replace(/\//g, "-");
      return `| **[${section}](api/${slug}.md)** | ${modules.length} modules | ${modules.map((m) => `\`${path.basename(m.filePath)}\``).slice(0, 4).join(", ")}${modules.length > 4 ? `, +${modules.length - 4} more` : ""} |`;
    })
    .join("\n");

  // Top connected modules for the architecture overview
  const connectionCounts = new Map<string, number>();
  for (const edge of manifest.dependencyGraph.edges) {
    connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
    connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
  }
  const topModules = [...connectionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const coreModulesSection = topModules.length > 0
    ? `## Core Modules\n\nThe most interconnected modules in the codebase:\n\n${topModules.map(([file, count]) => {
        const slug = file.replace(/\.[^.]+$/, "").replace(/\//g, "-");
        const mod = manifest.modules.find((m) => m.filePath === file);
        const desc = mod?.moduleDoc?.summary || "";
        return `- **[\`${path.basename(file)}\`](api/${slug}.md)** — ${desc || `${count} connections`}`;
      }).join("\n")}\n`
    : "";

  const langList = meta.languages
    .map((l) => `**${getLanguageDisplayName(l.name as LanguageId)}** (${l.fileCount} files, ${l.percentage}%)`)
    .join(" · ");

  const content = `---
title: ${projectName} Documentation
description: Technical documentation for ${projectName}
---

# ${projectName}

${meta.description || `Technical documentation for the **${projectName}** project. This reference covers the full API surface, architecture, and module structure.`}

!!! info "About This Documentation"
    This documentation is auto-generated from source code analysis. It covers **${stats.totalFiles} source files** containing **${stats.totalSymbols} symbols** across **${stats.totalLines.toLocaleString()} lines** of code.
    Last generated from commit \`${manifest.commitSha.slice(0, 8)}\`.

---

## Getting Started

New to this project? Start here:

- **[Getting Started](getting-started.md)** — Prerequisites, installation, and project structure
- **[Architecture](${archLink})** — System design, dependency graph, and module relationships
- **[API Reference](#api-by-section)** — Complete reference organized by component
${config.analysis.config_docs ? `- **[Configuration](configuration.md)** — Configuration schemas and settings\n` : ""}${config.analysis.types_page ? `- **[Types & Interfaces](types.md)** — All exported types, interfaces, and enums\n` : ""}${config.analysis.dependencies_page ? `- **[Dependencies](dependencies.md)** — External packages and their usage\n` : ""}${config.analysis.usage_guide_page ? `- **[Usage Guide](guide.md)** — How to navigate and use these docs\n` : ""}

---

## Languages

${langList}

---

${coreModulesSection}

---

## API by Section

| Section | Modules | Key Files |
|---------|:-------:|-----------|
${sectionLinks}

---

## Entry Points

${meta.entryPoints.map((e) => {
  const slug = e.replace(/\.[^.]+$/, "").replace(/\//g, "-");
  return `- [\`${e}\`](api/${slug}.md)`;
}).join("\n")}

---

*Generated by [DocWalk](https://docwalk.dev)*
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
  const projectName = meta.name === "." ? path.basename(process.cwd()) : meta.name;
  const archLink = config.analysis.architecture_tiers !== false ? "architecture/index.md" : "architecture.md";

  // Detect package manager from the project
  const pkgManager = detectPackageManager(manifest.modules);

  const installCmd = getInstallCommand(pkgManager);

  // Build grouped structure overview
  const modulesByGroup = groupModulesLogically(manifest.modules);
  const structureOverview = Object.entries(modulesByGroup)
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([section, modules]) => {
      const files = modules.map((m) => `\`${path.basename(m.filePath)}\``).slice(0, 5).join(", ");
      return `| **${section}** | ${modules.length} | ${files}${modules.length > 5 ? " ..." : ""} |`;
    })
    .join("\n");

  const repoUrl = meta.repository?.includes("/")
    ? `https://github.com/${meta.repository}`
    : "<repository-url>";

  const content = `---
title: Getting Started
description: Setup and installation guide for ${projectName}
---

# Getting Started

This guide covers the prerequisites, installation, and project structure for **${projectName}**.

---

## Prerequisites

${meta.languages.map((l) => `- ${getLanguageDisplayName(l.name as LanguageId)} development environment`).join("\n")}

---

## Installation

\`\`\`bash
# Clone the repository
git clone ${repoUrl}
cd ${projectName}

# Install dependencies
${installCmd}
\`\`\`

---

## Project Structure

\`\`\`text
${generateDirectoryTree(manifest.modules)}
\`\`\`

### Module Overview

| Section | Files | Key Modules |
|---------|:-----:|-------------|
${structureOverview}

---

## Entry Points

The primary entry points into the codebase:

${meta.entryPoints.map((e) => {
  const slug = e.replace(/\.[^.]+$/, "").replace(/\//g, "-");
  const mod = manifest.modules.find((m) => m.filePath === e);
  const desc = mod?.moduleDoc?.summary || "";
  return `- **[\`${e}\`](api/${slug}.md)**${desc ? ` — ${desc}` : ""}`;
}).join("\n")}

---

## Next Steps

- **[Architecture](${archLink})** — Understand the system design and dependency graph
- **[API Reference](index.md#api-by-section)** — Browse the full API organized by component

---

*Auto-generated by DocWalk. Re-run \`docwalk generate\` to update.*
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

  // Guard: no nodes in dependency graph
  if (dependencyGraph.nodes.length === 0) {
    const content = `---
title: Architecture
description: System architecture and dependency graph
---

# Architecture

## Dependency Graph

!!! info "Architecture diagram unavailable"
    No dependency relationships were detected between analyzed files.
    This can happen when files don't import from each other or when
    the project uses non-standard import patterns.

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

interface ModulePageContext {
  config: DocWalkConfig;
  manifest: AnalysisManifest;
  symbolPageMap: Map<string, string>;
}

function generateModulePage(mod: ModuleInfo, group: string, ctx?: ModulePageContext): GeneratedPage {
  const slug = mod.filePath
    .replace(/\.[^.]+$/, "")
    .replace(/\//g, "-");

  const publicSymbols = mod.symbols.filter((s) => s.exported);
  const privateSymbols = mod.symbols.filter((s) => !s.exported);
  const langTag = getLanguageTag(mod.language);

  const summary = mod.moduleDoc?.summary || mod.aiSummary || "";
  const description = mod.moduleDoc?.description && mod.moduleDoc.description !== mod.moduleDoc.summary
    ? mod.moduleDoc.description
    : "";

  const config = ctx?.config;
  const manifest = ctx?.manifest;
  const isGitHubRepo = config?.source.repo.includes("/") ?? false;
  const repoUrl = isGitHubRepo ? config!.source.repo : undefined;
  const branch = config?.source.branch ?? "main";
  const sourceLinksEnabled = config?.analysis.source_links !== false && isGitHubRepo;

  const renderOpts: RenderSymbolOptions = {
    repoUrl,
    branch,
    sourceLinks: sourceLinksEnabled,
    symbolPageMap: ctx?.symbolPageMap,
  };

  let content = `---
title: "${path.basename(mod.filePath)}"
description: "${mod.moduleDoc?.summary || `API reference for ${mod.filePath}`}"
---

# ${path.basename(mod.filePath)}

${summary}

${description}

`;

  // Collapsible source files section
  if (sourceLinksEnabled && repoUrl) {
    const sourceUrl = `https://github.com/${repoUrl}/blob/${branch}/${mod.filePath}`;
    const depFiles = mod.imports
      .filter((imp) => imp.source.startsWith(".") || imp.source.startsWith("@/"))
      .map((imp) => imp.source)
      .slice(0, 5);
    content += `??? info "Relevant source files"\n`;
    content += `    - [\`${mod.filePath}\`](${sourceUrl}) (${mod.lineCount} lines)\n`;
    if (depFiles.length > 0) {
      content += `    - Dependencies: ${depFiles.map((d) => `\`${d}\``).join(", ")}\n`;
    }
    content += "\n";
  }

  content += `| | |\n|---|---|\n`;
  content += `| **Source** | \`${mod.filePath}\` |\n`;
  content += `| **Language** | ${getLanguageDisplayName(mod.language as LanguageId)} |\n`;
  content += `| **Lines** | ${mod.lineCount} |\n`;
  if (publicSymbols.length > 0) content += `| **Exports** | ${publicSymbols.length} |\n`;
  content += "\n";

  if (mod.aiSummary && mod.moduleDoc?.summary) {
    content += `!!! abstract "AI Summary"\n    ${mod.aiSummary}\n\n`;
  }

  // Exports summary table
  if (publicSymbols.length > 0) {
    content += `---\n\n## Exports\n\n`;
    content += `| Name | Kind | Description |\n`;
    content += `|------|------|-------------|\n`;
    for (const sym of publicSymbols) {
      const kindBadge = getKindBadge(sym.kind);
      const symAnchor = sym.name.toLowerCase().replace(/[^a-z0-9-_]/g, "");
      content += `| [\`${sym.name}\`](#${symAnchor}) | ${kindBadge} | ${sym.docs?.summary || sym.aiSummary || ""} |\n`;
    }
    content += "\n";
  }

  // Detailed symbol docs
  if (publicSymbols.length > 0) {
    content += `---\n\n## API Reference\n\n`;
    for (const sym of publicSymbols) {
      content += renderSymbol(sym, langTag, renderOpts);
    }
  }

  // Architecture Context (mini dependency diagram for this module)
  if (manifest) {
    const upstream = manifest.dependencyGraph.edges
      .filter((e) => e.to === mod.filePath)
      .map((e) => e.from);
    const downstream = manifest.dependencyGraph.edges
      .filter((e) => e.from === mod.filePath)
      .map((e) => e.to);

    if (upstream.length > 0 || downstream.length > 0) {
      content += `---\n\n## Architecture Context\n\n`;
      content += `\`\`\`mermaid\ngraph LR\n`;
      const thisId = sanitizeMermaidId(mod.filePath);
      content += `  ${thisId}["${path.basename(mod.filePath)}"]\n`;
      content += `  style ${thisId} fill:#5de4c7,color:#000\n`;
      for (const up of upstream.slice(0, 8)) {
        const upId = sanitizeMermaidId(up);
        content += `  ${upId}["${path.basename(up)}"] --> ${thisId}\n`;
      }
      for (const down of downstream.slice(0, 8)) {
        const downId = sanitizeMermaidId(down);
        content += `  ${thisId} --> ${downId}["${path.basename(down)}"]\n`;
      }
      content += `\`\`\`\n\n`;
    }
  }

  // Referenced By section
  if (manifest) {
    const referencedBy = manifest.dependencyGraph.edges
      .filter((e) => e.to === mod.filePath)
      .map((e) => e.from);
    if (referencedBy.length > 0) {
      content += `---\n\n## Referenced By\n\n`;
      content += `This module is imported by **${referencedBy.length}** other module${referencedBy.length > 1 ? "s" : ""}:\n\n`;
      for (const ref of referencedBy.sort()) {
        const refSlug = ref.replace(/\.[^.]+$/, "").replace(/\//g, "-");
        content += `- [\`${ref}\`](${refSlug}.md)\n`;
      }
      content += "\n";
    }
  }

  // Dependencies
  if (mod.imports.length > 0) {
    content += `---\n\n## Dependencies\n\n`;
    const typeImports = mod.imports.filter((imp) => imp.isTypeOnly);
    const valueImports = mod.imports.filter((imp) => !imp.isTypeOnly);

    if (valueImports.length > 0) {
      for (const imp of valueImports) {
        const names = imp.specifiers.map((s) => s.alias ? `${s.name} as ${s.alias}` : s.name).join(", ");
        content += `- \`${imp.source}\`${names ? ` — ${names}` : ""}\n`;
      }
    }

    if (typeImports.length > 0) {
      content += `\n??? note "Type-only imports (${typeImports.length})"\n\n`;
      for (const imp of typeImports) {
        const names = imp.specifiers.map((s) => s.alias ? `${s.name} as ${s.alias}` : s.name).join(", ");
        content += `    - \`${imp.source}\`${names ? ` — ${names}` : ""}\n`;
      }
    }
    content += "\n";
  }

  // Internal symbols (collapsible)
  if (privateSymbols.length > 0) {
    content += `---\n\n## Internal\n\n`;
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
 * grouping by version tags with expand/collapse per release.
 */
async function generateChangelogPage(config: DocWalkConfig): Promise<GeneratedPage> {
  let changelogContent = "";

  try {
    const repoRoot = resolveRepoRoot(config.source);

    const git = simpleGit(repoRoot);

    // Get tags sorted by creation date (newest first)
    const tagsResult = await git.tags(["--sort=-creatordate"]);
    const versionTags = tagsResult.all
      .filter((t) => /^v?\d+\.\d+/.test(t));

    // Get recent commits
    const logResult = await git.log({
      maxCount: config.analysis.changelog_depth || 100,
    });

    if (logResult.all.length === 0) {
      changelogContent = "*No commits found.*\n";
    } else if (versionTags.length > 0) {
      // ── Version-grouped changelog ──────────────────────────────
      // Get tag dates for display
      const tagDates = new Map<string, string>();
      for (const tag of versionTags) {
        try {
          const tagLog = await git.log({ maxCount: 1, from: undefined, to: tag } as any);
          if (tagLog.latest) {
            tagDates.set(tag, new Date(tagLog.latest.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }));
          }
        } catch {
          // skip
        }
      }

      // All commits as a list with hashes
      const allCommits = logResult.all.map((c) => ({
        hash: c.hash,
        message: c.message,
        author: c.author_name,
        date: c.date,
        type: parseConventionalType(c.message),
      }));

      // Build commit hash set for each tag
      const tagCommitSets: Array<{ tag: string; commits: typeof allCommits }> = [];
      for (let i = 0; i < versionTags.length; i++) {
        const tag = versionTags[i];
        const prevTag = versionTags[i + 1];
        try {
          const range = prevTag ? `${prevTag}..${tag}` : tag;
          const rangeLog = await git.log({ from: prevTag, to: tag, maxCount: 50 } as any);
          tagCommitSets.push({
            tag,
            commits: rangeLog.all.map((c) => ({
              hash: c.hash,
              message: c.message,
              author: c.author_name,
              date: c.date,
              type: parseConventionalType(c.message),
            })),
          });
        } catch {
          tagCommitSets.push({ tag, commits: [] });
        }
      }

      // Unreleased commits (after latest tag)
      if (versionTags.length > 0) {
        try {
          const unreleasedLog = await git.log({ from: versionTags[0], maxCount: 50 } as any);
          if (unreleasedLog.all.length > 0) {
            changelogContent += `## Unreleased\n\n`;
            for (const commit of unreleasedLog.all) {
              const shortHash = commit.hash.slice(0, 7);
              const cleanMsg = commit.message.replace(/^(feat|fix|docs|refactor|test|chore|perf|ci|style|build)(\([^)]*\))?:\s*/, "");
              changelogContent += `- \`${shortHash}\` ${parseConventionalType(commit.message)}: ${cleanMsg}\n`;
            }
            changelogContent += "\n";
          }
        } catch {
          // no unreleased commits
        }
      }

      // Each version as expandable block
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

      for (let i = 0; i < tagCommitSets.length; i++) {
        const { tag, commits } = tagCommitSets[i];
        const dateStr = tagDates.get(tag) || "";
        const admonType = i === 0 ? "success" : "note";

        if (commits.length === 0) {
          changelogContent += `??? ${admonType} "${tag}${dateStr ? ` — ${dateStr}` : ""}"\n    No commits in this release.\n\n`;
          continue;
        }

        changelogContent += `??? ${admonType} "${tag}${dateStr ? ` — ${dateStr}` : ""} (${commits.length} change${commits.length > 1 ? "s" : ""})"\n`;

        // Group by type
        const grouped: Record<string, typeof commits> = {};
        for (const commit of commits) {
          if (!grouped[commit.type]) grouped[commit.type] = [];
          grouped[commit.type].push(commit);
        }

        for (const [type, label] of Object.entries(typeLabels)) {
          const typeCommits = grouped[type];
          if (!typeCommits || typeCommits.length === 0) continue;

          changelogContent += `    ### ${label}\n`;
          for (const commit of typeCommits) {
            const shortHash = commit.hash.slice(0, 7);
            const cleanMsg = commit.message.replace(/^(feat|fix|docs|refactor|test|chore|perf|ci|style|build)(\([^)]*\))?:\s*/, "");
            changelogContent += `    - \`${shortHash}\` ${cleanMsg}${commit.author ? ` *(${commit.author})*` : ""}\n`;
          }
          changelogContent += "\n";
        }
      }
    } else {
      // ── No version tags — flat conventional grouping ───────────
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

    // Check for CHANGELOG.md or RELEASE_NOTES.md in repo root
    try {
      const { readFile: readFs } = await import("fs/promises");
      for (const notesFile of ["CHANGELOG.md", "RELEASE_NOTES.md"]) {
        try {
          const notesPath = path.join(repoRoot, notesFile);
          const notesContent = await readFs(notesPath, "utf-8");
          if (notesContent.trim()) {
            changelogContent += `---\n\n## Project Release Notes\n\n`;
            changelogContent += `??? note "From ${notesFile}"\n`;
            for (const line of notesContent.split("\n").slice(0, 50)) {
              changelogContent += `    ${line}\n`;
            }
            changelogContent += "\n";
            break;
          }
        } catch {
          // file not found
        }
      }
    } catch {
      // fs import failed
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

// ─── New Page Generators ─────────────────────────────────────────────────────

function generateConfigurationPage(
  manifest: AnalysisManifest,
  config: DocWalkConfig
): GeneratedPage {
  const meta = manifest.projectMeta;
  const projectName = meta.name === "." ? path.basename(process.cwd()) : meta.name;

  // Find config-pattern files
  const configModules = manifest.modules.filter((mod) => {
    const basename = path.basename(mod.filePath).toLowerCase();
    return (
      basename.includes("config") ||
      basename.includes("settings") ||
      basename.includes("schema") ||
      /\.(config|rc)\.[^.]+$/.test(basename)
    );
  });

  let configFilesSection = "";
  if (configModules.length > 0) {
    configFilesSection += `## Configuration Files\n\n`;
    configFilesSection += `| File | Language | Exports | Description |\n`;
    configFilesSection += `|------|----------|:-------:|-------------|\n`;
    for (const mod of configModules) {
      const publicSymbols = mod.symbols.filter((s) => s.exported);
      const slug = mod.filePath.replace(/\.[^.]+$/, "").replace(/\//g, "-");
      const desc = mod.moduleDoc?.summary || "";
      configFilesSection += `| [\`${mod.filePath}\`](api/${slug}.md) | ${getLanguageDisplayName(mod.language as LanguageId)} | ${publicSymbols.length} | ${desc} |\n`;
    }
    configFilesSection += "\n";

    // Render exported symbols from config files
    for (const mod of configModules) {
      const publicSymbols = mod.symbols.filter((s) => s.exported);
      if (publicSymbols.length === 0) continue;

      const langTag = getLanguageTag(mod.language);
      configFilesSection += `### ${path.basename(mod.filePath)}\n\n`;
      configFilesSection += `Source: \`${mod.filePath}\`\n\n`;
      for (const sym of publicSymbols) {
        configFilesSection += renderSymbol(sym, langTag);
      }
    }
  } else {
    configFilesSection += `!!! note "No configuration files detected"\n    No files matching config patterns (\`*.config.*\`, \`config.*\`, \`settings.*\`, \`schema.*\`) were found in the analyzed source.\n\n`;
  }

  // Project config summary
  const langSummary = meta.languages
    .map((l) => `${getLanguageDisplayName(l.name as LanguageId)} (${l.fileCount} files)`)
    .join(", ");

  const analysisOptions = [
    `Depth: **${config.analysis.depth}**`,
    `Dependency graph: **${config.analysis.dependency_graph ? "enabled" : "disabled"}**`,
    `AI summaries: **${config.analysis.ai_summaries ? "enabled" : "disabled"}**`,
    `Changelog: **${config.analysis.changelog ? "enabled" : "disabled"}**`,
  ].join(" · ");

  const content = `---
title: Configuration
description: Configuration reference for ${projectName}
---

# Configuration

This page documents configuration schemas and settings found in **${projectName}**.

---

${configFilesSection}

---

## Project Configuration Summary

| Setting | Value |
|---------|-------|
| Languages detected | ${langSummary} |
| Total files analyzed | **${manifest.stats.totalFiles}** |
| Analysis options | ${analysisOptions} |

---

*Generated by DocWalk from commit \`${manifest.commitSha.slice(0, 8)}\`*
`;

  return {
    path: "configuration.md",
    title: "Configuration",
    content,
    navGroup: "",
    navOrder: 3,
  };
}

function generateTypesPage(manifest: AnalysisManifest): GeneratedPage {
  // Collect all exported types, interfaces, and enums across modules
  const typeSymbols: Array<{ symbol: Symbol; module: ModuleInfo; group: string }> = [];
  const modulesByGroup = groupModulesLogically(manifest.modules);

  for (const [group, modules] of Object.entries(modulesByGroup)) {
    for (const mod of modules) {
      for (const sym of mod.symbols) {
        if (
          sym.exported &&
          (sym.kind === "interface" || sym.kind === "type" || sym.kind === "enum")
        ) {
          typeSymbols.push({ symbol: sym, module: mod, group });
        }
      }
    }
  }

  // Master summary table
  let masterTable = "";
  if (typeSymbols.length > 0) {
    masterTable += `| Name | Kind | Module | Description |\n`;
    masterTable += `|------|------|--------|-------------|\n`;
    for (const { symbol: sym, module: mod } of typeSymbols) {
      const kindBadge = getKindBadge(sym.kind);
      const desc = sym.docs?.summary || sym.aiSummary || "";
      const symAnchor = sym.name.toLowerCase().replace(/[^a-z0-9-_]/g, "");
      masterTable += `| [\`${sym.name}\`](#${symAnchor}) | ${kindBadge} | \`${path.basename(mod.filePath)}\` | ${desc} |\n`;
    }
    masterTable += "\n";
  }

  // Detailed sections grouped by logical section
  let detailedSections = "";
  const groupedTypes = new Map<string, Array<{ symbol: Symbol; module: ModuleInfo }>>();
  for (const entry of typeSymbols) {
    if (!groupedTypes.has(entry.group)) groupedTypes.set(entry.group, []);
    groupedTypes.get(entry.group)!.push(entry);
  }

  for (const [group, entries] of groupedTypes) {
    detailedSections += `## ${group}\n\n`;
    for (const { symbol: sym, module: mod } of entries) {
      const langTag = getLanguageTag(mod.language);
      detailedSections += renderSymbol(sym, langTag);
    }
  }

  const content = `---
title: Types & Interfaces
description: Aggregate type definitions, interfaces, and enums
---

# Types & Interfaces

All exported types, interfaces, and enums across the codebase.

!!! info "Summary"
    **${typeSymbols.length}** type definitions found across **${new Set(typeSymbols.map((t) => t.module.filePath)).size}** modules.

---

${masterTable ? `## Overview\n\n${masterTable}---\n\n` : ""}${detailedSections || "!!! note \"No exported types found\"\n    No exported interfaces, types, or enums were detected in the analyzed source.\n"}

---

*Generated by DocWalk from commit \`${manifest.commitSha.slice(0, 8)}\`*
`;

  return {
    path: "types.md",
    title: "Types & Interfaces",
    content,
    navGroup: "",
    navOrder: 4,
  };
}

function generateDependenciesPage(manifest: AnalysisManifest): GeneratedPage {
  // Collect external imports (source doesn't start with . or /)
  const externalDeps = new Map<string, { modules: Set<string>; typeOnly: boolean }>();

  for (const mod of manifest.modules) {
    for (const imp of mod.imports) {
      if (imp.source.startsWith(".") || imp.source.startsWith("/")) continue;

      // Extract package name (handle scoped packages like @scope/pkg)
      const parts = imp.source.split("/");
      const pkgName = imp.source.startsWith("@") && parts.length >= 2
        ? `${parts[0]}/${parts[1]}`
        : parts[0];

      if (!externalDeps.has(pkgName)) {
        externalDeps.set(pkgName, { modules: new Set(), typeOnly: true });
      }
      const entry = externalDeps.get(pkgName)!;
      entry.modules.add(mod.filePath);
      if (!imp.isTypeOnly) entry.typeOnly = false;
    }
  }

  // Sort by usage frequency
  const sorted = [...externalDeps.entries()]
    .sort((a, b) => b[1].modules.size - a[1].modules.size);

  let tableContent = "";
  if (sorted.length > 0) {
    tableContent += `| Package | Used By | Import Type |\n`;
    tableContent += `|---------|:-------:|:-----------:|\n`;
    for (const [pkg, info] of sorted) {
      const importType = info.typeOnly ? ":material-tag: type-only" : ":material-package-variant: value";
      tableContent += `| \`${pkg}\` | ${info.modules.size} module${info.modules.size > 1 ? "s" : ""} | ${importType} |\n`;
    }
    tableContent += "\n";
  }

  // Detailed usage per package
  let detailedContent = "";
  for (const [pkg, info] of sorted.slice(0, 30)) {
    detailedContent += `### \`${pkg}\`\n\n`;
    detailedContent += `Used by ${info.modules.size} module${info.modules.size > 1 ? "s" : ""}:\n\n`;
    for (const modPath of [...info.modules].sort()) {
      const slug = modPath.replace(/\.[^.]+$/, "").replace(/\//g, "-");
      detailedContent += `- [\`${modPath}\`](api/${slug}.md)\n`;
    }
    detailedContent += "\n";
  }

  const content = `---
title: Dependencies
description: External dependencies and their usage
---

# Dependencies

External packages imported across the codebase.

!!! info "Summary"
    **${sorted.length}** external packages detected across **${manifest.modules.length}** modules.

---

## Package Overview

${tableContent || "*No external dependencies detected.*\n"}

---

## Usage Details

${detailedContent || "*No external dependencies to detail.*\n"}

---

*Generated by DocWalk from commit \`${manifest.commitSha.slice(0, 8)}\`*
`;

  return {
    path: "dependencies.md",
    title: "Dependencies",
    content,
    navGroup: "",
    navOrder: 5,
  };
}

function generateUsageGuidePage(
  manifest: AnalysisManifest,
  config: DocWalkConfig
): GeneratedPage {
  const meta = manifest.projectMeta;
  const projectName = meta.name === "." ? path.basename(process.cwd()) : meta.name;
  const modulesByGroup = groupModulesLogically(manifest.modules);
  const sectionCount = Object.keys(modulesByGroup).length;
  const archLink = config.analysis.architecture_tiers !== false ? "architecture/index.md" : "architecture.md";

  const content = `---
title: Usage Guide
description: How to navigate and use this documentation
---

# Usage Guide

Welcome to the **${projectName}** documentation. This guide explains how to navigate and get the most out of this site.

---

## About This Site

This documentation covers **${manifest.stats.totalFiles} files** across **${sectionCount} sections** with **${manifest.stats.totalSymbols} symbols** documented.

It was auto-generated by [DocWalk](https://docwalk.dev) from source code analysis and is kept in sync with the repository.

---

## Keyboard Shortcuts

MkDocs Material provides keyboard shortcuts for fast navigation:

| Shortcut | Action |
|----------|--------|
| \`/\` or \`s\` | Open search |
| \`n\` | Next search result |
| \`p\` | Previous search result |
| \`Enter\` | Follow selected result |
| \`Esc\` | Close search / dialog |

---

## Navigation

### Tabs

The top navigation bar organizes content by major section. Click a tab to browse its pages.

### Sidebar

The left sidebar shows the full page tree within the current section. Expandable sections let you drill into sub-topics.

### Table of Contents

The right sidebar (on wider screens) shows headings within the current page for quick jumping.

### Search

The search bar supports fuzzy matching and highlights results in context. Use \`/\` to focus it instantly.

---

## Dark / Light Mode

Click the :material-brightness-4: icon in the header to toggle between dark and light themes. Your preference is saved in your browser.

---

## Page Types

This documentation includes several types of pages:

| Page | Description |
|------|-------------|
| **[Overview](index.md)** | Project summary, statistics, and quick links |
| **[Getting Started](getting-started.md)** | Prerequisites, installation, and project structure |
| **[Architecture](${archLink})** | Dependency graph and module relationships |
| **[Configuration](configuration.md)** | Configuration schemas and settings reference |
| **[Types & Interfaces](types.md)** | Aggregate view of all exported types |
| **[Dependencies](dependencies.md)** | External packages and their usage across modules |
| **API Reference** | Per-module documentation organized by section |${config.analysis.changelog !== false ? `
| **[Changelog](changelog.md)** | Recent changes from git history |` : ""}

---

## API Reference Organization

API Reference pages are grouped by logical section based on directory structure:

${Object.entries(modulesByGroup)
  .sort(([, a], [, b]) => b.length - a.length)
  .map(([section, modules]) => `- **${section}** — ${modules.length} module${modules.length > 1 ? "s" : ""}`)
  .join("\n")}

Each module page includes:

- Module summary and metadata
- Exports table with kind badges
- Detailed API reference with signatures, parameters, and return types
- Dependency list (internal and external imports)
- Internal (non-exported) symbols in a collapsible section

---

## Tips

- Use the **search** (\`/\`) to quickly find any function, class, or type by name
- **Code blocks** have a copy button in the top-right corner — click to copy
- **Collapsible sections** (marked with ►) can be expanded for additional detail
- **Mermaid diagrams** on the Architecture page are interactive — hover over nodes for details

---

*Generated by [DocWalk](https://docwalk.dev)*
`;

  return {
    path: "guide.md",
    title: "Usage Guide",
    content,
    navGroup: "",
    navOrder: 6,
  };
}

// ─── Symbol Renderer ────────────────────────────────────────────────────────

interface RenderSymbolOptions {
  repoUrl?: string;
  branch?: string;
  sourceLinks?: boolean;
  symbolPageMap?: Map<string, string>;
}

function renderSymbol(sym: Symbol, langTag: string, opts?: RenderSymbolOptions): string {
  const anchor = sym.name.toLowerCase().replace(/[^a-z0-9-_]/g, "");

  // Badges for async/generator/static
  const badges: string[] = [];
  if (sym.async) badges.push(":material-sync: async");
  if (sym.generator) badges.push(":material-repeat: generator");
  if (sym.visibility === "protected") badges.push(":material-shield-half-full: protected");

  // attr_list { #id } MUST be at end of heading line
  let md = `### \`${sym.name}\``;
  if (badges.length > 0) md += ` ${badges.join(" · ")}`;
  md += ` { #${anchor} }`;
  md += "\n\n";

  // Decorators
  if (sym.decorators && sym.decorators.length > 0) {
    const hasDeprecated = sym.decorators.some((d) => d.toLowerCase().includes("deprecated"));
    for (const dec of sym.decorators) {
      if (!dec.toLowerCase().includes("deprecated")) {
        md += `\`@${dec}\` `;
      }
    }
    if (sym.decorators.some((d) => !d.toLowerCase().includes("deprecated"))) {
      md += "\n\n";
    }
    if (hasDeprecated && !sym.docs?.deprecated) {
      md += `!!! warning "Deprecated"\n    This symbol is deprecated.\n\n`;
    }
  }

  // Deprecation warning (from docs)
  if (sym.docs?.deprecated) {
    md += `!!! warning "Deprecated"\n    ${typeof sym.docs.deprecated === "string" ? sym.docs.deprecated : "This API is deprecated."}\n\n`;
  }

  // Signature with proper language tag
  if (sym.signature) {
    md += `\`\`\`${langTag}\n${sym.signature}\n\`\`\`\n\n`;
  }

  // Source link
  if (opts?.sourceLinks && opts.repoUrl && sym.location?.line) {
    const filePath = sym.location.file;
    const branch = opts.branch || "main";
    const lineRange = sym.location.endLine
      ? `#L${sym.location.line}-L${sym.location.endLine}`
      : `#L${sym.location.line}`;
    md += `:material-github: [View source](https://github.com/${opts.repoUrl}/blob/${branch}/${filePath}${lineRange})\n\n`;
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

  // Class hierarchy
  if (sym.kind === "class" && (sym.extends || (sym.implements && sym.implements.length > 0))) {
    md += `**Hierarchy:**\n\n\`\`\`mermaid\nclassDiagram\n`;
    if (sym.extends) {
      md += `    ${sanitizeMermaidId(sym.extends)} <|-- ${sanitizeMermaidId(sym.name)}\n`;
    }
    if (sym.implements) {
      for (const iface of sym.implements) {
        md += `    ${sanitizeMermaidId(iface)} <|.. ${sanitizeMermaidId(sym.name)}\n`;
      }
    }
    md += `\`\`\`\n\n`;
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
        const typeStr = renderTypeWithLinks(param.type || "unknown", opts?.symbolPageMap);
        md += `    | \`${param.name}${opt}\` | ${typeStr} | ${def} | ${docDesc} |\n`;
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
        const typeStr = renderTypeWithLinks(param.type || "unknown", opts?.symbolPageMap);
        md += `| \`${param.name}${opt}\` | ${typeStr} | ${def} | ${docDesc} |\n`;
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
    const retType = sym.returns?.type ? renderTypeWithLinks(sym.returns.type, opts?.symbolPageMap) : "";
    md += `**Returns:** ${retType} ${sym.docs?.returns || ""}\n\n`;
  }

  // Example blocks
  if (sym.docs?.examples && sym.docs.examples.length > 0) {
    for (const example of sym.docs.examples) {
      md += `**Example:**\n\n\`\`\`${langTag}\n${example}\n\`\`\`\n\n`;
    }
  }

  // Since tag
  if (sym.docs?.since) {
    md += `*Since: ${sym.docs.since}*\n\n`;
  }

  md += "---\n\n";
  return md;
}

/** Replace type names with links to their pages if found in the symbol map */
function renderTypeWithLinks(typeStr: string, symbolPageMap?: Map<string, string>): string {
  if (!symbolPageMap || symbolPageMap.size === 0) return `\`${typeStr}\``;

  let result = typeStr;
  for (const [symName, pagePath] of symbolPageMap) {
    // Only replace whole-word matches
    const regex = new RegExp(`\\b${symName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (regex.test(result)) {
      const symAnchor = symName.toLowerCase().replace(/[^a-z0-9-_]/g, "");
      result = result.replace(regex, `[${symName}](../${pagePath}#${symAnchor})`);
      break; // Link the first match only to keep it readable
    }
  }
  if (result !== typeStr) return result;
  return `\`${typeStr}\``;
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
  const rawName = manifest.projectMeta.name;
  const siteName = rawName === "." ? path.basename(process.cwd()) : rawName;
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
  const allPaths = modules.map((m) => m.filePath);

  // Check for specific config files that indicate the project type
  const hasPackageJson = allPaths.some((p) => p === "package.json" || p.endsWith("/package.json"));
  const hasGoMod = allPaths.some((p) => p === "go.mod" || p.endsWith("/go.mod"));
  const hasCargoToml = allPaths.some((p) => p === "Cargo.toml" || p.endsWith("/Cargo.toml"));
  const hasRequirementsTxt = allPaths.some((p) => p === "requirements.txt" || p.endsWith("/requirements.txt"));
  const hasPyprojectToml = allPaths.some((p) => p === "pyproject.toml" || p.endsWith("/pyproject.toml"));
  const hasGemfile = allPaths.some((p) => p === "Gemfile" || p.endsWith("/Gemfile"));
  const hasMakefile = allPaths.some((p) => p === "Makefile" || p.endsWith("/Makefile"));

  // Check what languages are present
  const hasGo = allPaths.some((p) => p.endsWith(".go"));
  const hasPython = allPaths.some((p) => p.endsWith(".py"));
  const hasRust = allPaths.some((p) => p.endsWith(".rs"));
  const hasRuby = allPaths.some((p) => p.endsWith(".rb"));
  const hasJS = allPaths.some((p) => p.endsWith(".js") || p.endsWith(".ts") || p.endsWith(".jsx") || p.endsWith(".tsx"));
  const hasHCL = allPaths.some((p) => p.endsWith(".tf") || p.endsWith(".hcl"));
  const hasYAML = allPaths.some((p) => p.endsWith(".yml") || p.endsWith(".yaml"));
  const hasShell = allPaths.some((p) => p.endsWith(".sh") || p.endsWith(".bash"));

  // Prioritize config-file detection over language detection
  if (hasGoMod || (hasGo && !hasJS)) return { id: "go", displayName: "Go" };
  if (hasCargoToml || (hasRust && !hasJS)) return { id: "cargo", displayName: "Cargo" };
  if (hasPyprojectToml) return { id: "poetry", displayName: "Poetry" };
  if (hasRequirementsTxt || (hasPython && !hasJS)) return { id: "pip", displayName: "pip" };
  if (hasGemfile || (hasRuby && !hasJS)) return { id: "bundler", displayName: "Bundler" };
  if (hasPackageJson || hasJS) return { id: "npm", displayName: "npm" };
  if (hasMakefile) return { id: "make", displayName: "Make" };

  // Infrastructure-as-code repos
  if (hasHCL) return { id: "terraform", displayName: "Terraform" };
  if (hasYAML && !hasJS) return { id: "generic", displayName: "generic" };
  if (hasShell) return { id: "generic", displayName: "generic" };

  return { id: "generic", displayName: "generic" };
}

function getInstallCommand(pm: PackageManager): string {
  switch (pm.id) {
    case "yarn": return "yarn install";
    case "pnpm": return "pnpm install";
    case "go": return "go mod download";
    case "pip": return "pip install -r requirements.txt";
    case "poetry": return "poetry install";
    case "cargo": return "cargo build";
    case "bundler": return "bundle install";
    case "make": return "make";
    case "terraform": return "terraform init";
    case "generic": return "# See project README for setup instructions";
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

// ─── Symbol Cross-Reference Map ─────────────────────────────────────────────

function buildSymbolPageMap(modules: ModuleInfo[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const mod of modules) {
    const slug = mod.filePath.replace(/\.[^.]+$/, "").replace(/\//g, "-");
    const pagePath = `api/${slug}.md`;
    for (const sym of mod.symbols) {
      if (sym.exported && (sym.kind === "interface" || sym.kind === "type" || sym.kind === "class" || sym.kind === "enum")) {
        map.set(sym.name, pagePath);
      }
    }
  }
  return map;
}

// ─── Tiered Architecture Pages ──────────────────────────────────────────────

function generateTieredArchitecturePages(manifest: AnalysisManifest): GeneratedPage[] {
  const pages: GeneratedPage[] = [];
  const { dependencyGraph } = manifest;

  // Guard: no nodes in dependency graph
  if (dependencyGraph.nodes.length === 0) {
    pages.push({
      path: "architecture/index.md",
      title: "Architecture",
      content: `---
title: Architecture
description: System architecture overview
---

# Architecture

## System Overview

!!! info "Architecture diagram unavailable"
    No dependency relationships were detected between analyzed files.
    This can happen when files don't import from each other or when
    the project uses non-standard import patterns.

---

*Generated by DocWalk from commit \`${manifest.commitSha.slice(0, 8)}\`*
`,
      navGroup: "Architecture",
      navOrder: 2,
    });
    return pages;
  }

  // Cluster nodes by top-level directory
  const packageMap = new Map<string, string[]>();
  for (const node of dependencyGraph.nodes) {
    const parts = node.split("/");
    const dir = parts.length > 2 ? parts.slice(0, 2).join("/") : parts[0];
    if (!packageMap.has(dir)) packageMap.set(dir, []);
    packageMap.get(dir)!.push(node);
  }

  // ── Tier 1: System Overview ────────────────────────────────────────────
  let t1Content = `---
title: Architecture
description: System architecture overview
---

# Architecture

## System Overview

High-level view of the project's package/directory structure and their relationships.

\`\`\`mermaid
graph LR
`;

  // Package-level subgraphs
  for (const [dir, nodes] of packageMap) {
    const dirId = sanitizeMermaidId(dir);
    t1Content += `  ${dirId}["${dir} (${nodes.length} files)"]\n`;
  }

  // Cross-package edges
  const crossPkgEdges = new Set<string>();
  for (const edge of dependencyGraph.edges) {
    const fromParts = edge.from.split("/");
    const toParts = edge.to.split("/");
    const fromDir = fromParts.length > 2 ? fromParts.slice(0, 2).join("/") : fromParts[0];
    const toDir = toParts.length > 2 ? toParts.slice(0, 2).join("/") : toParts[0];
    if (fromDir !== toDir) {
      const key = `${fromDir}|${toDir}`;
      if (!crossPkgEdges.has(key)) {
        crossPkgEdges.add(key);
        const style = edge.isTypeOnly ? "-.->" : "-->";
        t1Content += `  ${sanitizeMermaidId(fromDir)} ${style} ${sanitizeMermaidId(toDir)}\n`;
      }
    }
  }

  t1Content += `\`\`\`

## Packages

| Package | Files | Symbols | Key Exports |
|---------|:-----:|:-------:|-------------|
`;

  for (const [dir, nodes] of packageMap) {
    const dirSlug = dir.replace(/\//g, "-");
    const modulesInDir = manifest.modules.filter((m) => nodes.includes(m.filePath));
    const totalSymbols = modulesInDir.reduce((s, m) => s + m.symbols.length, 0);
    const keyExports = modulesInDir
      .flatMap((m) => m.symbols.filter((s) => s.exported))
      .slice(0, 3)
      .map((s) => `\`${s.name}\``)
      .join(", ");
    t1Content += `| [**${dir}**](${dirSlug}.md) | ${nodes.length} | ${totalSymbols} | ${keyExports || "—"} |\n`;
  }

  t1Content += `
---

## Statistics

| Metric | Value |
|--------|-------|
| Total packages | **${packageMap.size}** |
| Total modules | **${dependencyGraph.nodes.length}** |
| Total edges | **${dependencyGraph.edges.length}** |
| Cross-package edges | **${crossPkgEdges.size}** |

---

*Generated by DocWalk from commit \`${manifest.commitSha.slice(0, 8)}\`*
`;

  pages.push({
    path: "architecture/index.md",
    title: "Architecture",
    content: t1Content,
    navGroup: "",
    navOrder: 2,
  });

  // ── Tier 2: Package Detail — one per directory ─────────────────────────
  for (const [dir, nodes] of packageMap) {
    const dirSlug = dir.replace(/\//g, "-");
    const modulesInDir = manifest.modules.filter((m) => nodes.includes(m.filePath));

    let t2Content = `---
title: "${dir}"
description: "Architecture detail for ${dir}"
---

# ${dir}

## Module Graph

\`\`\`mermaid
graph LR
`;

    for (const node of nodes) {
      const nodeId = sanitizeMermaidId(node);
      const isEntry = node.includes("index.") || node.includes("main.");
      t2Content += `  ${nodeId}["${path.basename(node)}"]${isEntry ? "\n  style " + nodeId + " fill:#5de4c7,color:#000" : ""}\n`;
    }

    const nodesSet = new Set(nodes);
    for (const edge of dependencyGraph.edges) {
      if (nodesSet.has(edge.from) && nodesSet.has(edge.to)) {
        const style = edge.isTypeOnly ? "-.->" : "-->";
        t2Content += `  ${sanitizeMermaidId(edge.from)} ${style} ${sanitizeMermaidId(edge.to)}\n`;
      }
    }

    t2Content += `\`\`\`

## Modules

| Module | Dependencies | Dependents | Exports |
|--------|:-----------:|:----------:|:-------:|
`;

    for (const mod of modulesInDir) {
      const deps = dependencyGraph.edges.filter((e) => e.from === mod.filePath).length;
      const dependents = dependencyGraph.edges.filter((e) => e.to === mod.filePath).length;
      const exports = mod.symbols.filter((s) => s.exported).length;
      const modSlug = mod.filePath.replace(/\.[^.]+$/, "").replace(/\//g, "-");
      t2Content += `| [\`${path.basename(mod.filePath)}\`](../api/${modSlug}.md) | ${deps} | ${dependents} | ${exports} |\n`;
    }

    t2Content += `
---

*Part of the [Architecture](index.md) overview*
`;

    pages.push({
      path: `architecture/${dirSlug}.md`,
      title: dir,
      content: t2Content,
      navGroup: "Architecture",
      navOrder: 2,
    });
  }

  return pages;
}

// ─── SBOM Page ──────────────────────────────────────────────────────────────

function generateSBOMPage(manifest: AnalysisManifest, config: DocWalkConfig): GeneratedPage {
  // Collect external imports (source doesn't start with . or /)
  const externalDeps = new Map<string, { modules: Set<string>; typeOnly: boolean }>();

  for (const mod of manifest.modules) {
    for (const imp of mod.imports) {
      if (imp.source.startsWith(".") || imp.source.startsWith("/")) continue;

      const parts = imp.source.split("/");
      const pkgName = imp.source.startsWith("@") && parts.length >= 2
        ? `${parts[0]}/${parts[1]}`
        : parts[0];

      if (!externalDeps.has(pkgName)) {
        externalDeps.set(pkgName, { modules: new Set(), typeOnly: true });
      }
      const entry = externalDeps.get(pkgName)!;
      entry.modules.add(mod.filePath);
      if (!imp.isTypeOnly) entry.typeOnly = false;
    }
  }

  const sorted = [...externalDeps.entries()]
    .sort((a, b) => b[1].modules.size - a[1].modules.size);

  // Categorize into runtime vs dev vs peer (heuristic: type-only = dev)
  const runtime = sorted.filter(([, info]) => !info.typeOnly);
  const devOnly = sorted.filter(([, info]) => info.typeOnly);

  let tableContent = "";
  if (sorted.length > 0) {
    tableContent += `| Package | Version | License | Used By | Category |\n`;
    tableContent += `|---------|---------|---------|:-------:|:---------:|\n`;
    for (const [pkg, info] of sorted) {
      const category = info.typeOnly ? ":material-wrench: Dev" : ":material-package-variant: Runtime";
      tableContent += `| \`${pkg}\` | — | — | ${info.modules.size} module${info.modules.size > 1 ? "s" : ""} | ${category} |\n`;
    }
    tableContent += "\n";
  }

  // Detailed usage per package
  let detailedContent = "";
  for (const [pkg, info] of sorted.slice(0, 30)) {
    detailedContent += `### \`${pkg}\`\n\n`;
    detailedContent += `Used by ${info.modules.size} module${info.modules.size > 1 ? "s" : ""}:\n\n`;
    for (const modPath of [...info.modules].sort()) {
      const slug = modPath.replace(/\.[^.]+$/, "").replace(/\//g, "-");
      detailedContent += `- [\`${modPath}\`](api/${slug}.md)\n`;
    }
    detailedContent += "\n";
  }

  const content = `---
title: Software Bill of Materials
description: Dependencies, versions, and licenses
---

# Software Bill of Materials

External packages imported across the codebase with categorization.

!!! info "Summary"
    **${sorted.length}** external packages detected: **${runtime.length}** runtime, **${devOnly.length}** dev/type-only.

---

## Dependency Overview

${tableContent || "*No external dependencies detected.*\n"}

---

## Runtime Dependencies

${runtime.length > 0 ? runtime.map(([pkg, info]) => `- \`${pkg}\` — ${info.modules.size} module${info.modules.size > 1 ? "s" : ""}`).join("\n") : "*None detected.*"}

---

## Dev / Type-only Dependencies

${devOnly.length > 0 ? devOnly.map(([pkg, info]) => `- \`${pkg}\` — ${info.modules.size} module${info.modules.size > 1 ? "s" : ""}`).join("\n") : "*None detected.*"}

---

## Usage Details

${detailedContent || "*No external dependencies to detail.*\n"}

---

*Generated by DocWalk from commit \`${manifest.commitSha.slice(0, 8)}\`*
`;

  return {
    path: "dependencies.md",
    title: "Software Bill of Materials",
    content,
    navGroup: "",
    navOrder: 5,
  };
}

// ─── Insights Page ──────────────────────────────────────────────────────────

function generateInsightsPage(insights: Insight[], config: DocWalkConfig): GeneratedPage {
  const byCategory = new Map<string, Insight[]>();
  const bySeverity = { info: 0, warning: 0, critical: 0 };

  for (const insight of insights) {
    if (!byCategory.has(insight.category)) byCategory.set(insight.category, []);
    byCategory.get(insight.category)!.push(insight);
    bySeverity[insight.severity]++;
  }

  const categoryLabels: Record<string, string> = {
    documentation: "Documentation",
    architecture: "Architecture",
    "code-quality": "Code Quality",
    security: "Security",
    performance: "Performance",
  };

  const severityAdmonition: Record<string, string> = {
    critical: "danger",
    warning: "warning",
    info: "info",
  };

  let categorySections = "";
  for (const [category, catInsights] of byCategory) {
    categorySections += `## ${categoryLabels[category] || category}\n\n`;
    for (const insight of catInsights) {
      const admonType = severityAdmonition[insight.severity] || "info";
      categorySections += `!!! ${admonType} "${insight.title}"\n`;
      categorySections += `    ${insight.description}\n\n`;
      if (insight.affectedFiles.length > 0) {
        categorySections += `    **Affected files:** ${insight.affectedFiles.map((f) => `\`${f}\``).join(", ")}\n\n`;
      }
      categorySections += `    **Suggestion:** ${insight.suggestion}\n\n`;
    }
  }

  const hasAiInsights = config.analysis.insights_ai;

  const content = `---
title: Code Insights
description: Automated code quality analysis and improvement suggestions
---

# Code Insights

Automated analysis findings and improvement suggestions.

## Summary

| Severity | Count |
|----------|:-----:|
| :material-alert-circle: Critical | **${bySeverity.critical}** |
| :material-alert: Warning | **${bySeverity.warning}** |
| :material-information: Info | **${bySeverity.info}** |
| **Total** | **${insights.length}** |

---

${categorySections}
${!hasAiInsights ? `---

!!! tip "Unlock AI-Powered Insights"
    Get AI-powered architecture review, security scanning, and API design suggestions with DocWalk Pro.
` : ""}
---

*Generated by DocWalk from static analysis*
`;

  return {
    path: "insights.md",
    title: "Code Insights",
    content,
    navGroup: "",
    navOrder: 7,
    audience: "developer",
  };
}

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
