import path from "path";
import type { DocWalkConfig } from "../../config/schema.js";
import type { AnalysisManifest, GeneratedPage } from "../../analysis/types.js";
import type { AIProvider } from "../../analysis/providers/base.js";
import { getLanguageDisplayName, type LanguageId } from "../../analysis/language-detect.js";
import { resolveProjectName, groupModulesLogically } from "../utils.js";
import { generateOverviewNarrative, renderCitations } from "../narrative-engine.js";

export function generateOverviewPage(manifest: AnalysisManifest, config: DocWalkConfig): GeneratedPage {
  const { projectMeta: meta, stats } = manifest;
  const projectName = resolveProjectName(manifest);
  const archLink = config.analysis.architecture_tiers !== false ? "architecture/index.md" : "architecture.md";

  // Group modules by logical section for categorized navigation
  const modulesByGroup = groupModulesLogically(manifest.modules);

  // Top connected modules for the architecture overview
  const connectionCounts = new Map<string, number>();
  for (const edge of manifest.dependencyGraph.edges) {
    connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
    connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
  }
  const topModules = [...connectionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const langList = meta.languages
    .map((l) => `**${getLanguageDisplayName(l.name as LanguageId)}** (${l.fileCount} files, ${l.percentage}%)`)
    .join(" · ");

  const primaryLang = meta.languages[0]
    ? getLanguageDisplayName(meta.languages[0].name as LanguageId)
    : "software";
  const projectDescription = meta.description
    || meta.readmeDescription
    || `A ${primaryLang} project. This reference covers the full API surface, architecture, and module structure.`;

  // Stats cards
  const langCount = meta.languages.length;
  const statsCards = `<div class="grid cards" markdown>

-   :material-file-document-outline:{ .lg .middle } **${stats.totalFiles} Files**

    ---

    Source files analyzed across the codebase

-   :material-code-tags:{ .lg .middle } **${stats.totalSymbols} Symbols**

    ---

    Functions, classes, types, and interfaces

-   :material-text-long:{ .lg .middle } **${stats.totalLines.toLocaleString()} Lines**

    ---

    Total lines of source code

-   :material-translate:{ .lg .middle } **${langCount} Language${langCount !== 1 ? "s" : ""}**

    ---

    ${langList}

</div>`;

  // Getting started cards
  let gettingStartedCards = `<div class="grid cards" markdown>

-   :material-rocket-launch:{ .lg .middle } **[Getting Started](getting-started.md)**

    ---

    Prerequisites, installation, and project structure

-   :material-sitemap:{ .lg .middle } **[Architecture](${archLink})**

    ---

    System design, dependency graph, and module relationships

-   :material-book-open-variant:{ .lg .middle } **[API Reference](#api-by-section)**

    ---

    Complete reference organized by component
`;
  if (config.analysis.config_docs) {
    gettingStartedCards += `
-   :material-cog:{ .lg .middle } **[Configuration](configuration.md)**

    ---

    Configuration schemas and settings
`;
  }
  if (config.analysis.types_page) {
    gettingStartedCards += `
-   :material-shape-outline:{ .lg .middle } **[Types & Interfaces](types.md)**

    ---

    All exported types, interfaces, and enums
`;
  }
  if (config.analysis.dependencies_page) {
    gettingStartedCards += `
-   :material-package-variant:{ .lg .middle } **[Dependencies](dependencies.md)**

    ---

    External packages and their usage
`;
  }
  gettingStartedCards += `\n</div>`;

  // API by Section cards
  const sectionCards = Object.entries(modulesByGroup)
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([section, modules]) => {
      const topModule = modules[0];
      const slug = topModule.filePath.replace(/\.[^.]+$/, "");
      const keyFiles = modules.map((m) => `\`${path.basename(m.filePath)}\``).slice(0, 4).join(", ");
      const extra = modules.length > 4 ? ` +${modules.length - 4} more` : "";
      return `-   :material-folder-outline:{ .lg .middle } **[${section}](api/${slug}.md)**

    ---

    ${modules.length} module${modules.length !== 1 ? "s" : ""} · ${keyFiles}${extra}
`;
    })
    .join("\n");

  // Core modules cards
  let coreModulesSection = "";
  if (topModules.length > 0) {
    const coreCards = topModules.map(([file, count]) => {
      const slug = file.replace(/\.[^.]+$/, "");
      const mod = manifest.modules.find((m) => m.filePath === file);
      const desc = mod?.moduleDoc?.summary || `${count} connections`;
      return `-   :material-star:{ .lg .middle } **[\`${path.basename(file)}\`](api/${slug}.md)**

    ---

    ${desc}
`;
    }).join("\n");

    coreModulesSection = `## Core Modules

The most interconnected modules in the codebase:

<div class="grid cards" markdown>

${coreCards}
</div>
`;
  }

  const content = `---
title: ${projectName} Documentation
description: Technical documentation for ${projectName}
---

# ${projectName}

${projectDescription}

---

${statsCards}

---

## Getting Started

New to this project? Start here:

${gettingStartedCards}

---

${coreModulesSection}

---

## API by Section

<div class="grid cards" markdown>

${sectionCards}
</div>

---

## Entry Points

${meta.entryPoints.map((e) => {
  const slug = e.replace(/\.[^.]+$/, "");
  return `- [\`${e}\`](api/${slug}.md)`;
}).join("\n")}

---

!!! info "About This Documentation"
    This documentation is auto-generated from source code analysis. It covers **${stats.totalFiles} source files** containing **${stats.totalSymbols} symbols** across **${stats.totalLines.toLocaleString()} lines** of code.
    Last generated from commit \`${manifest.commitSha.slice(0, 8)}\`.

---

*Generated by [DocWalk](https://docwalk.dev)*
`;

  return {
    path: "index.md",
    title: "Overview",
    content,
    navGroup: "",
    navOrder: 0,
    audience: "developer",
  };
}

/**
 * Generate an AI-enhanced overview page with narrative prose.
 */
export async function generateOverviewPageNarrative(
  manifest: AnalysisManifest,
  config: DocWalkConfig,
  provider: AIProvider,
  readFile: (filePath: string) => Promise<string>
): Promise<GeneratedPage> {
  const basePage = generateOverviewPage(manifest, config);

  try {
    const narrative = await generateOverviewNarrative({
      provider,
      manifest,
      readFile,
    });

    const repoUrl = config.source.repo.includes("/") ? config.source.repo : undefined;
    const prose = renderCitations(narrative.prose, narrative.citations, repoUrl, config.source.branch);

    // Insert narrative prose after the title, before the template content
    const projectName = resolveProjectName(manifest);
    const narrativeContent = `---
title: ${projectName} Documentation
description: Technical documentation for ${projectName}
---

# ${projectName}

${prose}

---

${basePage.content.split("---\n").slice(2).join("---\n")}`;

    return {
      ...basePage,
      content: narrativeContent,
    };
  } catch {
    // Fallback to template-based page on AI failure
    return basePage;
  }
}
