import {
  generateArchitectureNarrative,
  generateGettingStartedNarrative,
  generateModuleNarrative,
  generateOverviewNarrative,
  renderCitations
} from "./chunk-WZW77HOO.js";
import {
  detectPackageManager,
  generateDirectoryTree,
  getAlternativeInstallCommands,
  getInstallCommand,
  getKindBadge,
  getLanguageTag,
  groupModulesLogically,
  parseConventionalType,
  renderSymbol,
  resolveProjectName,
  sanitizeMermaidId
} from "./chunk-D4RNNKFF.js";
import {
  getLanguageDisplayName
} from "./chunk-KPWUZIKC.js";
import {
  resolveRepoRoot
} from "./chunk-BAPW5PUT.js";

// src/generators/pages/overview.ts
import path from "path";
function generateOverviewPage(manifest, config) {
  const { projectMeta: meta, stats } = manifest;
  const projectName = resolveProjectName(manifest);
  const archLink = config.analysis.architecture_tiers !== false ? "architecture/index.md" : "architecture.md";
  const modulesByGroup = groupModulesLogically(manifest.modules);
  const connectionCounts = /* @__PURE__ */ new Map();
  for (const edge of manifest.dependencyGraph.edges) {
    connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
    connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
  }
  const topModules = [...connectionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const langList = meta.languages.map((l) => `**${getLanguageDisplayName(l.name)}** (${l.fileCount} files, ${l.percentage}%)`).join(" \xB7 ");
  const primaryLang = meta.languages[0] ? getLanguageDisplayName(meta.languages[0].name) : "software";
  const projectDescription = meta.description || meta.readmeDescription || `A ${primaryLang} project. This reference covers the full API surface, architecture, and module structure.`;
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
  gettingStartedCards += `
</div>`;
  const sectionCards = Object.entries(modulesByGroup).sort(([, a], [, b]) => b.length - a.length).map(([section, modules]) => {
    const topModule = modules[0];
    const slug = topModule.filePath.replace(/\.[^.]+$/, "");
    const keyFiles = modules.map((m) => `\`${path.basename(m.filePath)}\``).slice(0, 4).join(", ");
    const extra = modules.length > 4 ? ` +${modules.length - 4} more` : "";
    return `-   :material-folder-outline:{ .lg .middle } **[${section}](api/${slug}.md)**

    ---

    ${modules.length} module${modules.length !== 1 ? "s" : ""} \xB7 ${keyFiles}${extra}
`;
  }).join("\n");
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
    audience: "developer"
  };
}
async function generateOverviewPageNarrative(manifest, config, provider, readFile) {
  const basePage = generateOverviewPage(manifest, config);
  try {
    const narrative = await generateOverviewNarrative({
      provider,
      manifest,
      readFile
    });
    const repoUrl = config.source.repo.includes("/") ? config.source.repo : void 0;
    const prose = renderCitations(narrative.prose, narrative.citations, repoUrl, config.source.branch);
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
      content: narrativeContent
    };
  } catch {
    return basePage;
  }
}

// src/generators/pages/getting-started.ts
import path2 from "path";
function generateGettingStartedPage(manifest, config) {
  const meta = manifest.projectMeta;
  const projectName = resolveProjectName(manifest);
  const archLink = config.analysis.architecture_tiers !== false ? "architecture/index.md" : "architecture.md";
  const pkgManager = detectPackageManager(manifest.modules);
  const installCmd = getInstallCommand(pkgManager);
  const altInstalls = getAlternativeInstallCommands(pkgManager);
  const modulesByGroup = groupModulesLogically(manifest.modules);
  const structureOverview = Object.entries(modulesByGroup).sort(([, a], [, b]) => b.length - a.length).map(([section, modules]) => {
    const files = modules.map((m) => `\`${path2.basename(m.filePath)}\``).slice(0, 5).join(", ");
    return `| **${section}** | ${modules.length} | ${files}${modules.length > 5 ? " ..." : ""} |`;
  }).join("\n");
  const repoUrl = meta.repository?.includes("/") ? `https://github.com/${meta.repository}` : "<repository-url>";
  const readmeIntro = meta.readmeDescription ? `${meta.readmeDescription}

---

` : "";
  const prerequisites = meta.languages.map(
    (l) => `- [x] ${getLanguageDisplayName(l.name)} development environment`
  ).join("\n");
  let installSection;
  if (altInstalls) {
    installSection = `\`\`\`bash
# Clone the repository
git clone ${repoUrl}
cd ${projectName}
\`\`\`

${altInstalls.map((alt) => `=== "${alt.label}"

    \`\`\`bash
    ${alt.command}
    \`\`\``).join("\n\n")}`;
  } else {
    installSection = `\`\`\`bash
# Clone the repository
git clone ${repoUrl}
cd ${projectName}

# Install dependencies
${installCmd}
\`\`\``;
  }
  const content = `---
title: Getting Started
description: Setup and installation guide for ${projectName}
---

# Getting Started

${readmeIntro}This guide covers the prerequisites, installation, and project structure for **${projectName}**.

---

## Prerequisites

${prerequisites}

---

## Installation

${installSection}

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
    const slug = e.replace(/\.[^.]+$/, "");
    const mod = manifest.modules.find((m) => m.filePath === e);
    const desc = mod?.moduleDoc?.summary || "";
    return `- **[\`${e}\`](api/${slug}.md)**${desc ? ` \u2014 ${desc}` : ""}`;
  }).join("\n")}

---

## Next Steps

<div class="grid cards" markdown>

-   :material-sitemap:{ .lg .middle } **[Architecture](${archLink})**

    ---

    Understand the system design and dependency graph

-   :material-book-open-variant:{ .lg .middle } **[API Reference](index.md#api-by-section)**

    ---

    Browse the full API organized by component

</div>

---

*Auto-generated by DocWalk. Re-run \`docwalk generate\` to update.*
`;
  return {
    path: "getting-started.md",
    title: "Getting Started",
    content,
    navGroup: "",
    navOrder: 1,
    audience: "developer"
  };
}
async function generateGettingStartedPageNarrative(manifest, config, provider, readFile) {
  const basePage = generateGettingStartedPage(manifest, config);
  try {
    const narrative = await generateGettingStartedNarrative({
      provider,
      manifest,
      readFile
    });
    const repoUrl = config.source.repo.includes("/") ? config.source.repo : void 0;
    const prose = renderCitations(narrative.prose, narrative.citations, repoUrl, config.source.branch);
    const projectName = resolveProjectName(manifest);
    const narrativeContent = `---
title: Getting Started
description: Setup and installation guide for ${projectName}
---

# Getting Started

${prose}

---

*Auto-generated by DocWalk with AI narrative. Re-run \`docwalk generate\` to update.*
`;
    return {
      ...basePage,
      content: narrativeContent
    };
  } catch {
    return basePage;
  }
}

// src/generators/pages/architecture.ts
import path3 from "path";
function generateArchitecturePage(manifest) {
  const { dependencyGraph } = manifest;
  const clusters = /* @__PURE__ */ new Map();
  for (const node of dependencyGraph.nodes) {
    const parts = node.split("/");
    const dir = parts.length > 2 ? parts.slice(0, 2).join("/") : parts[0];
    if (!clusters.has(dir)) clusters.set(dir, []);
    clusters.get(dir).push(node);
  }
  const connectionCounts = /* @__PURE__ */ new Map();
  for (const edge of dependencyGraph.edges) {
    connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
    connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
  }
  const topNodes = new Set(
    [...connectionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([node]) => node)
  );
  if (dependencyGraph.nodes.length <= 30) {
    for (const node of dependencyGraph.nodes) {
      topNodes.add(node);
    }
  }
  if (dependencyGraph.nodes.length === 0) {
    const content2 = `---
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
      content: content2,
      navGroup: "",
      navOrder: 2
    };
  }
  const dirColors = [":::blue", ":::green", ":::orange", ":::pink", ":::purple"];
  const dirColorMap = /* @__PURE__ */ new Map();
  let colorIdx = 0;
  for (const [dir] of clusters) {
    dirColorMap.set(dir, dirColors[colorIdx % dirColors.length]);
    colorIdx++;
  }
  const graphDirection = topNodes.size > 15 ? "TD" : "LR";
  let mermaidContent = `graph ${graphDirection}
`;
  for (const [dir, nodes] of clusters) {
    const filteredNodes = nodes.filter((n) => topNodes.has(n));
    if (filteredNodes.length === 0) continue;
    mermaidContent += `  subgraph ${sanitizeMermaidId(dir)}["${dir}"]
`;
    for (const node of filteredNodes) {
      mermaidContent += `    ${sanitizeMermaidId(node)}["${path3.basename(node)}"]
`;
    }
    mermaidContent += "  end\n";
  }
  const visibleEdges = dependencyGraph.edges.filter(
    (e) => topNodes.has(e.from) && topNodes.has(e.to)
  );
  for (const edge of visibleEdges.slice(0, 100)) {
    const style = edge.isTypeOnly ? "-.->" : "-->";
    mermaidContent += `  ${sanitizeMermaidId(edge.from)} ${style} ${sanitizeMermaidId(edge.to)}
`;
  }
  const moduleRows = manifest.modules.map((m) => {
    const outgoing = dependencyGraph.edges.filter((e) => e.from === m.filePath).length;
    const incoming = dependencyGraph.edges.filter((e) => e.to === m.filePath).length;
    return { filePath: m.filePath, deps: outgoing, dependents: incoming, total: outgoing + incoming };
  }).sort((a, b) => b.total - a.total).slice(0, 30);
  const content = `---
title: Architecture
description: System architecture and dependency graph
---

# Architecture

## Dependency Graph

!!! info "Graph Legend"
    Solid arrows (\`\u2192\`) are value imports. Dashed arrows (\`\u21E2\`) are type-only imports.
    Nodes are clustered by directory. Only the ${topNodes.size} most-connected modules are shown.

\`\`\`mermaid
${mermaidContent}\`\`\`

${dependencyGraph.nodes.length > 30 ? `
!!! note "Showing ${topNodes.size} of ${dependencyGraph.nodes.length} modules"
    The full graph has ${dependencyGraph.nodes.length} nodes and ${dependencyGraph.edges.length} edges.
` : ""}

## Module Relationships

| Module | Dependencies | Dependents | Total |
|--------|:-----------:|:----------:|:-----:|
${moduleRows.map((r) => {
    const slug = r.filePath.replace(/\.[^.]+$/, "");
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
    audience: "developer"
  };
}
function generateTieredArchitecturePages(manifest) {
  const pages = [];
  const { dependencyGraph } = manifest;
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
      audience: "developer"
    });
    return pages;
  }
  const packageMap = /* @__PURE__ */ new Map();
  for (const node of dependencyGraph.nodes) {
    const parts = node.split("/");
    const dir = parts.length > 2 ? parts.slice(0, 2).join("/") : parts[0];
    if (!packageMap.has(dir)) packageMap.set(dir, []);
    packageMap.get(dir).push(node);
  }
  let t1Content = `---
title: Architecture
description: System architecture overview
---

# Architecture

## System Overview

High-level view of the project's package/directory structure and their relationships.

\`\`\`mermaid
graph ${packageMap.size > 15 ? "TD" : "LR"}
`;
  for (const [dir, nodes] of packageMap) {
    const dirId = sanitizeMermaidId(dir);
    t1Content += `  ${dirId}["${dir} (${nodes.length} files)"]
`;
  }
  const crossPkgEdges = /* @__PURE__ */ new Set();
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
        t1Content += `  ${sanitizeMermaidId(fromDir)} ${style} ${sanitizeMermaidId(toDir)}
`;
      }
    }
  }
  t1Content += `\`\`\`

## Packages

| Package | Files | Symbols | Key Exports |
|---------|:-----:|:-------:|-------------|
`;
  for (const [dir, nodes] of packageMap) {
    const dirSlug = dir;
    const modulesInDir = manifest.modules.filter((m) => nodes.includes(m.filePath));
    const totalSymbols = modulesInDir.reduce((s, m) => s + m.symbols.length, 0);
    const keyExports = modulesInDir.flatMap((m) => m.symbols.filter((s) => s.exported)).slice(0, 3).map((s) => `\`${s.name}\``).join(", ");
    t1Content += `| [**${dir}**](${dirSlug}.md) | ${nodes.length} | ${totalSymbols} | ${keyExports || "\u2014"} |
`;
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
    audience: "developer"
  });
  for (const [dir, nodes] of packageMap) {
    const dirSlug = dir;
    const modulesInDir = manifest.modules.filter((m) => nodes.includes(m.filePath));
    let t2Content = `---
title: "${dir}"
description: "Architecture detail for ${dir}"
---

# ${dir}

## Module Graph

\`\`\`mermaid
graph ${nodes.length > 15 ? "TD" : "LR"}
`;
    for (const node of nodes) {
      const nodeId = sanitizeMermaidId(node);
      const isEntry = node.includes("index.") || node.includes("main.");
      t2Content += `  ${nodeId}["${path3.basename(node)}"]${isEntry ? "\n  style " + nodeId + " fill:#5de4c7,color:#000" : ""}
`;
    }
    const nodesSet = new Set(nodes);
    for (const edge of dependencyGraph.edges) {
      if (nodesSet.has(edge.from) && nodesSet.has(edge.to)) {
        const style = edge.isTypeOnly ? "-.->" : "-->";
        t2Content += `  ${sanitizeMermaidId(edge.from)} ${style} ${sanitizeMermaidId(edge.to)}
`;
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
      const modSlug = mod.filePath.replace(/\.[^.]+$/, "");
      t2Content += `| [\`${path3.basename(mod.filePath)}\`](../api/${modSlug}.md) | ${deps} | ${dependents} | ${exports} |
`;
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
      audience: "developer"
    });
  }
  return pages;
}
async function generateArchitecturePageNarrative(manifest, provider, readFile, repoUrl, branch) {
  const basePage = generateArchitecturePage(manifest);
  try {
    const narrative = await generateArchitectureNarrative({
      provider,
      manifest,
      readFile
    });
    const prose = renderCitations(narrative.prose, narrative.citations, repoUrl, branch);
    const diagramSections = narrative.suggestedDiagrams.map((d) => `### ${d.title}

\`\`\`mermaid
${d.mermaidCode}
\`\`\`
`).join("\n");
    const narrativeSection = `
## Architecture Overview

${prose}

${diagramSections ? `## AI-Generated Diagrams

${diagramSections}` : ""}`;
    const insertPoint = basePage.content.indexOf("## Module Relationships");
    if (insertPoint > 0) {
      const content = basePage.content.slice(0, insertPoint) + narrativeSection + "\n" + basePage.content.slice(insertPoint);
      return { ...basePage, content };
    }
    return { ...basePage, content: basePage.content + narrativeSection };
  } catch {
    return basePage;
  }
}

// src/generators/pages/module.ts
import path4 from "path";
function generateModulePage(mod, group, ctx) {
  const slug = mod.filePath.replace(/\.[^.]+$/, "");
  const publicSymbols = mod.symbols.filter((s) => s.exported);
  const privateSymbols = mod.symbols.filter((s) => !s.exported);
  const langTag = getLanguageTag(mod.language);
  const summary = mod.moduleDoc?.summary || mod.aiSummary || "";
  const description = mod.moduleDoc?.description && mod.moduleDoc.description !== mod.moduleDoc.summary ? mod.moduleDoc.description : "";
  const config = ctx?.config;
  const manifest = ctx?.manifest;
  const isGitHubRepo = config?.source.repo.includes("/") ?? false;
  const repoUrl = isGitHubRepo ? config.source.repo : void 0;
  const branch = config?.source.branch ?? "main";
  const sourceLinksEnabled = config?.analysis.source_links !== false && isGitHubRepo;
  const renderOpts = {
    repoUrl,
    branch,
    sourceLinks: sourceLinksEnabled,
    symbolPageMap: ctx?.symbolPageMap
  };
  let content = `---
title: "${path4.basename(mod.filePath)}"
description: "${mod.moduleDoc?.summary || `API reference for ${mod.filePath}`}"
---

# ${path4.basename(mod.filePath)}

${summary}

${description}

`;
  {
    const baseUrl = sourceLinksEnabled && repoUrl ? `https://github.com/${repoUrl}/blob/${branch}/` : "";
    const sourceUrl = baseUrl ? `${baseUrl}${mod.filePath}` : "";
    const relatedFiles = [];
    if (manifest) {
      for (const imp of mod.imports) {
        if (imp.source.startsWith(".") || imp.source.startsWith("@/")) {
          const matchedMod = manifest.modules.find(
            (m) => m.filePath.endsWith(imp.source.replace(/^\.\//, "").replace(/^@\//, "src/") + ".ts") || m.filePath.endsWith(imp.source.replace(/^\.\//, "").replace(/^@\//, "src/") + ".js") || m.filePath === imp.source.replace(/^\.\//, "").replace(/^@\//, "src/")
          );
          if (matchedMod) relatedFiles.push(matchedMod.filePath);
        }
      }
    }
    content += `<details>
<summary>Relevant source files</summary>

`;
    content += `The following files were used as context for this page:

`;
    if (sourceUrl) {
      content += `- [\`${mod.filePath}\`](${sourceUrl}) \u2014 this module (${mod.lineCount} lines)
`;
    } else {
      content += `- \`${mod.filePath}\` \u2014 this module (${mod.lineCount} lines)
`;
    }
    for (const rf of relatedFiles.slice(0, 8)) {
      if (baseUrl) {
        content += `- [\`${rf}\`](${baseUrl}${rf})
`;
      } else {
        const rfSlug = rf.replace(/\.[^.]+$/, "");
        content += `- [\`${rf}\`](${rfSlug}.md)
`;
      }
    }
    content += `
</details>

`;
  }
  content += `| | |
|---|---|
`;
  content += `| **Source** | \`${mod.filePath}\` |
`;
  content += `| **Language** | ${getLanguageDisplayName(mod.language)} |
`;
  content += `| **Lines** | ${mod.lineCount} |
`;
  if (publicSymbols.length > 0) content += `| **Exports** | ${publicSymbols.length} |
`;
  content += "\n";
  if (mod.aiSummary && mod.moduleDoc?.summary) {
    content += `!!! abstract "AI Summary"
    ${mod.aiSummary}

`;
  }
  const useTabs = publicSymbols.length > 0 && privateSymbols.length > 0;
  if (publicSymbols.length > 0) {
    content += `---

## Exports

`;
    if (useTabs) {
      content += `=== "Exports (${publicSymbols.length})"

`;
      content += `    | Name | Kind | Description |
`;
      content += `    |------|------|-------------|
`;
      for (const sym of publicSymbols) {
        const kindBadge = getKindBadge(sym.kind);
        const symAnchor = sym.name.toLowerCase().replace(/[^a-z0-9-_]/g, "");
        const deprecated = sym.docs?.deprecated || sym.decorators?.some((d) => d.toLowerCase().includes("deprecated"));
        const nameDisplay = deprecated ? `==\`${sym.name}\`== :material-alert: deprecated` : `[\`${sym.name}\`](#${symAnchor})`;
        content += `    | ${nameDisplay} | ${kindBadge} | ${sym.docs?.summary || sym.aiSummary || ""} |
`;
      }
      content += "\n";
      content += `=== "Internal (${privateSymbols.length})"

`;
      for (const sym of privateSymbols) {
        const kindBadge = getKindBadge(sym.kind);
        content += `    - \`${sym.name}\` \u2014 ${kindBadge}${sym.docs?.summary ? ` \u2014 ${sym.docs.summary}` : ""}
`;
      }
      content += "\n";
    } else {
      content += `| Name | Kind | Description |
`;
      content += `|------|------|-------------|
`;
      for (const sym of publicSymbols) {
        const kindBadge = getKindBadge(sym.kind);
        const symAnchor = sym.name.toLowerCase().replace(/[^a-z0-9-_]/g, "");
        const deprecated = sym.docs?.deprecated || sym.decorators?.some((d) => d.toLowerCase().includes("deprecated"));
        const nameDisplay = deprecated ? `==\`${sym.name}\`== :material-alert: deprecated` : `[\`${sym.name}\`](#${symAnchor})`;
        content += `| ${nameDisplay} | ${kindBadge} | ${sym.docs?.summary || sym.aiSummary || ""} |
`;
      }
      content += "\n";
    }
  }
  if (publicSymbols.length > 0) {
    content += `---

## API Reference

`;
    for (const sym of publicSymbols) {
      content += renderSymbol(sym, langTag, renderOpts);
    }
  }
  if (manifest) {
    const upstream = manifest.dependencyGraph.edges.filter((e) => e.to === mod.filePath).map((e) => e.from);
    const downstream = manifest.dependencyGraph.edges.filter((e) => e.from === mod.filePath).map((e) => e.to);
    if (upstream.length > 0 || downstream.length > 0) {
      content += `---

## Architecture Context

`;
      content += `\`\`\`mermaid
flowchart TD
`;
      const thisId = sanitizeMermaidId(mod.filePath);
      content += `  ${thisId}["${path4.basename(mod.filePath)}"]
`;
      content += `  style ${thisId} fill:#5de4c7,color:#000
`;
      if (upstream.length > 0) {
        content += `  subgraph Imported_By["Imported by"]
`;
        for (const up of upstream.slice(0, 8)) {
          const upId = sanitizeMermaidId(up);
          content += `    ${upId}["${path4.basename(up)}"]
`;
        }
        content += `  end
`;
        for (const up of upstream.slice(0, 8)) {
          const upId = sanitizeMermaidId(up);
          content += `  ${upId} --> ${thisId}
`;
        }
      }
      if (downstream.length > 0) {
        content += `  subgraph Dependencies["Dependencies"]
`;
        for (const down of downstream.slice(0, 8)) {
          const downId = sanitizeMermaidId(down);
          content += `    ${downId}["${path4.basename(down)}"]
`;
        }
        content += `  end
`;
        for (const down of downstream.slice(0, 8)) {
          const downId = sanitizeMermaidId(down);
          content += `  ${thisId} --> ${downId}
`;
        }
      }
      content += `\`\`\`

`;
    }
  }
  if (manifest) {
    const referencedBy = manifest.dependencyGraph.edges.filter((e) => e.to === mod.filePath).map((e) => e.from);
    if (referencedBy.length > 0) {
      content += `---

## Referenced By

`;
      content += `This module is imported by **${referencedBy.length}** other module${referencedBy.length > 1 ? "s" : ""}:

`;
      for (const ref of referencedBy.sort()) {
        const refSlug = ref.replace(/\.[^.]+$/, "");
        content += `- [\`${ref}\`](/api/${refSlug}.md)
`;
      }
      content += "\n";
    }
  }
  if (mod.imports.length > 0) {
    content += `---

## Dependencies

`;
    const typeImports = mod.imports.filter((imp) => imp.isTypeOnly);
    const valueImports = mod.imports.filter((imp) => !imp.isTypeOnly);
    if (valueImports.length > 0) {
      for (const imp of valueImports) {
        const names = imp.specifiers.map((s) => s.alias ? `${s.name} as ${s.alias}` : s.name).join(", ");
        content += `- \`${imp.source}\`${names ? ` \u2014 ${names}` : ""}
`;
      }
    }
    if (typeImports.length > 0) {
      content += `
??? note "Type-only imports (${typeImports.length})"

`;
      for (const imp of typeImports) {
        const names = imp.specifiers.map((s) => s.alias ? `${s.name} as ${s.alias}` : s.name).join(", ");
        content += `    - \`${imp.source}\`${names ? ` \u2014 ${names}` : ""}
`;
      }
    }
    content += "\n";
  }
  if (privateSymbols.length > 0 && !useTabs) {
    content += `---

## Internal

`;
    content += `??? note "Show ${privateSymbols.length} internal symbols"

`;
    for (const sym of privateSymbols) {
      const kindBadge = getKindBadge(sym.kind);
      content += `    - \`${sym.name}\` \u2014 ${kindBadge}${sym.docs?.summary ? ` \u2014 ${sym.docs.summary}` : ""}
`;
    }
    content += "\n";
  }
  content += `---

*Source: \`${mod.filePath}\` \xB7 Last analyzed: ${mod.analyzedAt}*
`;
  return {
    path: `api/${slug}.md`,
    title: path4.basename(mod.filePath),
    content,
    navGroup: group || "API Reference",
    navOrder: 10,
    audience: "developer"
  };
}
async function generateModulePageNarrative(mod, group, ctx, provider, readFile) {
  const basePage = generateModulePage(mod, group, ctx);
  try {
    const narrative = await generateModuleNarrative(mod, {
      provider,
      manifest: ctx.manifest,
      readFile
    });
    const repoUrl = ctx.config.source.repo.includes("/") ? ctx.config.source.repo : void 0;
    const prose = renderCitations(narrative.prose, narrative.citations, repoUrl, ctx.config.source.branch);
    const insertPoint = basePage.content.indexOf("---\n\n## Exports");
    if (insertPoint > 0) {
      const content = basePage.content.slice(0, insertPoint) + `
## Overview

${prose}

` + basePage.content.slice(insertPoint);
      return { ...basePage, content };
    }
    return basePage;
  } catch {
    return basePage;
  }
}

// src/generators/pages/configuration.ts
import path5 from "path";
function generateConfigurationPage(manifest, config) {
  const meta = manifest.projectMeta;
  const projectName = resolveProjectName(manifest);
  const configModules = manifest.modules.filter((mod) => {
    const basename = path5.basename(mod.filePath).toLowerCase();
    return basename.includes("config") || basename.includes("settings") || basename.includes("schema") || /\.(config|rc)\.[^.]+$/.test(basename);
  });
  let configFilesSection = "";
  if (configModules.length > 0) {
    configFilesSection += `## Configuration Files

`;
    configFilesSection += `| File | Language | Exports | Description |
`;
    configFilesSection += `|------|----------|:-------:|-------------|
`;
    for (const mod of configModules) {
      const publicSymbols = mod.symbols.filter((s) => s.exported);
      const slug = mod.filePath.replace(/\.[^.]+$/, "");
      const desc = mod.moduleDoc?.summary || "";
      configFilesSection += `| [\`${mod.filePath}\`](api/${slug}.md) | ${getLanguageDisplayName(mod.language)} | ${publicSymbols.length} | ${desc} |
`;
    }
    configFilesSection += "\n";
    for (const mod of configModules) {
      const publicSymbols = mod.symbols.filter((s) => s.exported);
      if (publicSymbols.length === 0) continue;
      const langTag = getLanguageTag(mod.language);
      configFilesSection += `### ${path5.basename(mod.filePath)}

`;
      configFilesSection += `Source: \`${mod.filePath}\`

`;
      for (const sym of publicSymbols) {
        configFilesSection += renderSymbol(sym, langTag);
      }
    }
  } else {
    configFilesSection += `!!! note "No configuration files detected"
    No files matching config patterns (\`*.config.*\`, \`config.*\`, \`settings.*\`, \`schema.*\`) were found in the analyzed source.

`;
  }
  const langSummary = meta.languages.map((l) => `${getLanguageDisplayName(l.name)} (${l.fileCount} files)`).join(", ");
  const analysisOptions = [
    `Depth: **${config.analysis.depth}**`,
    `Dependency graph: **${config.analysis.dependency_graph ? "enabled" : "disabled"}**`,
    `AI summaries: **${config.analysis.ai_summaries ? "enabled" : "disabled"}**`,
    `Changelog: **${config.analysis.changelog ? "enabled" : "disabled"}**`
  ].join(" \xB7 ");
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
    audience: "developer"
  };
}

// src/generators/pages/types.ts
import path6 from "path";
function generateTypesPage(manifest) {
  const typeSymbols = [];
  const modulesByGroup = groupModulesLogically(manifest.modules);
  for (const [group, modules] of Object.entries(modulesByGroup)) {
    for (const mod of modules) {
      for (const sym of mod.symbols) {
        if (sym.exported && (sym.kind === "interface" || sym.kind === "type" || sym.kind === "enum")) {
          typeSymbols.push({ symbol: sym, module: mod, group });
        }
      }
    }
  }
  let masterTable = "";
  if (typeSymbols.length > 0) {
    masterTable += `| Name | Kind | Module | Description |
`;
    masterTable += `|------|------|--------|-------------|
`;
    for (const { symbol: sym, module: mod } of typeSymbols) {
      const kindBadge = getKindBadge(sym.kind);
      const desc = sym.docs?.summary || sym.aiSummary || "";
      const symAnchor = sym.name.toLowerCase().replace(/[^a-z0-9-_]/g, "");
      masterTable += `| [\`${sym.name}\`](#${symAnchor}) | ${kindBadge} | \`${path6.basename(mod.filePath)}\` | ${desc} |
`;
    }
    masterTable += "\n";
  }
  let detailedSections = "";
  const groupedTypes = /* @__PURE__ */ new Map();
  for (const entry of typeSymbols) {
    if (!groupedTypes.has(entry.group)) groupedTypes.set(entry.group, []);
    groupedTypes.get(entry.group).push(entry);
  }
  for (const [group, entries] of groupedTypes) {
    detailedSections += `## ${group}

`;
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

${masterTable ? `## Overview

${masterTable}---

` : ""}${detailedSections || '!!! note "No exported types found"\n    No exported interfaces, types, or enums were detected in the analyzed source.\n'}

---

*Generated by DocWalk from commit \`${manifest.commitSha.slice(0, 8)}\`*
`;
  return {
    path: "types.md",
    title: "Types & Interfaces",
    content,
    navGroup: "",
    navOrder: 4,
    audience: "developer"
  };
}

// src/generators/pages/dependencies.ts
function generateDependenciesPage(manifest) {
  const externalDeps = /* @__PURE__ */ new Map();
  for (const mod of manifest.modules) {
    for (const imp of mod.imports) {
      if (imp.source.startsWith(".") || imp.source.startsWith("/")) continue;
      const parts = imp.source.split("/");
      const pkgName = imp.source.startsWith("@") && parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
      if (!externalDeps.has(pkgName)) {
        externalDeps.set(pkgName, { modules: /* @__PURE__ */ new Set(), typeOnly: true });
      }
      const entry = externalDeps.get(pkgName);
      entry.modules.add(mod.filePath);
      if (!imp.isTypeOnly) entry.typeOnly = false;
    }
  }
  const sorted = [...externalDeps.entries()].sort((a, b) => b[1].modules.size - a[1].modules.size);
  let tableContent = "";
  if (sorted.length > 0) {
    tableContent += `| Package | Used By | Import Type |
`;
    tableContent += `|---------|:-------:|:-----------:|
`;
    for (const [pkg, info] of sorted) {
      const importType = info.typeOnly ? ":material-tag: type-only" : ":material-package-variant: value";
      tableContent += `| \`${pkg}\` | ${info.modules.size} module${info.modules.size > 1 ? "s" : ""} | ${importType} |
`;
    }
    tableContent += "\n";
  }
  let detailedContent = "";
  for (const [pkg, info] of sorted.slice(0, 30)) {
    detailedContent += `### \`${pkg}\`

`;
    detailedContent += `Used by ${info.modules.size} module${info.modules.size > 1 ? "s" : ""}:

`;
    for (const modPath of [...info.modules].sort()) {
      const slug = modPath.replace(/\.[^.]+$/, "");
      detailedContent += `- [\`${modPath}\`](api/${slug}.md)
`;
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
    audience: "developer"
  };
}
function generateSBOMPage(manifest, config) {
  const externalDeps = /* @__PURE__ */ new Map();
  for (const mod of manifest.modules) {
    for (const imp of mod.imports) {
      if (imp.source.startsWith(".") || imp.source.startsWith("/")) continue;
      const parts = imp.source.split("/");
      const pkgName = imp.source.startsWith("@") && parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
      if (!externalDeps.has(pkgName)) {
        externalDeps.set(pkgName, { modules: /* @__PURE__ */ new Set(), typeOnly: true });
      }
      const entry = externalDeps.get(pkgName);
      entry.modules.add(mod.filePath);
      if (!imp.isTypeOnly) entry.typeOnly = false;
    }
  }
  const sorted = [...externalDeps.entries()].sort((a, b) => b[1].modules.size - a[1].modules.size);
  const runtime = sorted.filter(([, info]) => !info.typeOnly);
  const devOnly = sorted.filter(([, info]) => info.typeOnly);
  let tableContent = "";
  if (sorted.length > 0) {
    tableContent += `| Package | Version | License | Used By | Category |
`;
    tableContent += `|---------|---------|---------|:-------:|:---------:|
`;
    for (const [pkg, info] of sorted) {
      const category = info.typeOnly ? ":material-wrench: Dev" : ":material-package-variant: Runtime";
      tableContent += `| \`${pkg}\` | \u2014 | \u2014 | ${info.modules.size} module${info.modules.size > 1 ? "s" : ""} | ${category} |
`;
    }
    tableContent += "\n";
  }
  let detailedContent = "";
  for (const [pkg, info] of sorted.slice(0, 30)) {
    detailedContent += `### \`${pkg}\`

`;
    detailedContent += `Used by ${info.modules.size} module${info.modules.size > 1 ? "s" : ""}:

`;
    for (const modPath of [...info.modules].sort()) {
      const slug = modPath.replace(/\.[^.]+$/, "");
      detailedContent += `- [\`${modPath}\`](api/${slug}.md)
`;
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

${runtime.length > 0 ? runtime.map(([pkg, info]) => `- \`${pkg}\` \u2014 ${info.modules.size} module${info.modules.size > 1 ? "s" : ""}`).join("\n") : "*None detected.*"}

---

## Dev / Type-only Dependencies

${devOnly.length > 0 ? devOnly.map(([pkg, info]) => `- \`${pkg}\` \u2014 ${info.modules.size} module${info.modules.size > 1 ? "s" : ""}`).join("\n") : "*None detected.*"}

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
    audience: "developer"
  };
}

// src/generators/pages/usage-guide.ts
function generateUsageGuidePage(manifest, config) {
  const meta = manifest.projectMeta;
  const projectName = resolveProjectName(manifest);
  const modulesByGroup = groupModulesLogically(manifest.modules);
  const sectionCount = Object.keys(modulesByGroup).length;
  const archLink = config.analysis.architecture_tiers !== false ? "architecture/index.md" : "architecture.md";
  const connectionCounts = /* @__PURE__ */ new Map();
  for (const edge of manifest.dependencyGraph.edges) {
    connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
    connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
  }
  const topConnected = [...connectionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const primaryLang = meta.languages[0] ? getLanguageDisplayName(meta.languages[0].name) : "";
  const langDesc = primaryLang ? `a ${primaryLang} project` : "this project";
  const sectionList = Object.entries(modulesByGroup).sort(([, a], [, b]) => b.length - a.length).map(([section, modules]) => `- **${section}** \u2014 ${modules.length} module${modules.length > 1 ? "s" : ""}`).join("\n");
  let keyModulesSection = "";
  if (topConnected.length > 0) {
    keyModulesSection = `### Key Modules

The most interconnected modules \u2014 good starting points:

`;
    keyModulesSection += topConnected.map(([file, count]) => {
      const slug = file.replace(/\.[^.]+$/, "");
      return `- [\`${file}\`](api/${slug}.md) \u2014 ${count} connections`;
    }).join("\n");
    keyModulesSection += "\n";
  }
  const content = `---
title: Usage Guide
description: How to navigate and use the ${projectName} documentation
---

# Usage Guide

This documentation covers **${projectName}**, ${langDesc} with **${manifest.stats.totalFiles} files** across **${sectionCount} sections** and **${manifest.stats.totalSymbols} documented symbols**.

It is auto-generated by [DocWalk](https://docwalk.dev) and stays in sync with the repository.

---

## API Reference Organization

API Reference pages are grouped by logical section based on directory structure:

${sectionList}

Each module page includes:

- Module summary and metadata
- Exports table with kind badges
- Detailed API reference with signatures, parameters, and return types
- Architecture context diagram
- Dependency list (internal and external imports)

---

## Quick Start

| Page | Description |
|------|-------------|
| **[Overview](index.md)** | Project summary, statistics, and quick links |
| **[Getting Started](getting-started.md)** | Prerequisites, installation, and project structure |
| **[Architecture](${archLink})** | Dependency graph and module relationships |
${config.analysis.config_docs ? `| **[Configuration](configuration.md)** | Configuration schemas and settings reference |
` : ""}${config.analysis.types_page ? `| **[Types & Interfaces](types.md)** | Aggregate view of all exported types |
` : ""}${config.analysis.dependencies_page ? `| **[Dependencies](dependencies.md)** | External packages and their usage across modules |
` : ""}${config.analysis.changelog !== false ? `| **[Changelog](changelog.md)** | Recent changes from git history |
` : ""}
${keyModulesSection}

---

## Regenerating These Docs

To regenerate this documentation after code changes:

\`\`\`bash
npx docwalk generate
\`\`\`

DocWalk will re-analyze the codebase and rebuild all pages. For incremental updates, use:

\`\`\`bash
npx docwalk sync
\`\`\`

---

## Tips

- Use the **search** (\`/\`) to quickly find any function, class, or type by name
- **Code blocks** have a copy button \u2014 click to copy snippets
- **Collapsible sections** (marked with \u25BA) expand for additional detail
- **Mermaid diagrams** on Architecture pages are interactive \u2014 hover for details

---

*Generated by [DocWalk](https://docwalk.dev)*
`;
  return {
    path: "guide.md",
    title: "Usage Guide",
    content,
    navGroup: "",
    navOrder: 6,
    audience: "developer"
  };
}

// src/generators/pages/changelog.ts
import path7 from "path";
import simpleGit from "simple-git";
async function generateChangelogPage(config) {
  let changelogContent = "";
  try {
    const repoRoot = resolveRepoRoot(config.source);
    const git = simpleGit(repoRoot);
    const tagsResult = await git.tags(["--sort=-creatordate"]);
    const versionTags = tagsResult.all.filter((t) => /^v?\d+\.\d+/.test(t));
    const logResult = await git.log({
      maxCount: config.analysis.changelog_depth || 100
    });
    if (logResult.all.length === 0) {
      changelogContent = "*No commits found.*\n";
    } else if (versionTags.length > 0) {
      const tagDates = /* @__PURE__ */ new Map();
      for (const tag of versionTags) {
        try {
          const tagLog = await git.log({ maxCount: 1, from: void 0, to: tag });
          if (tagLog.latest) {
            tagDates.set(tag, new Date(tagLog.latest.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }));
          }
        } catch {
        }
      }
      const allCommits = logResult.all.map((c) => ({
        hash: c.hash,
        message: c.message,
        author: c.author_name,
        date: c.date,
        type: parseConventionalType(c.message)
      }));
      const tagCommitSets = [];
      for (let i = 0; i < versionTags.length; i++) {
        const tag = versionTags[i];
        const prevTag = versionTags[i + 1];
        try {
          const range = prevTag ? `${prevTag}..${tag}` : tag;
          const rangeLog = await git.log({ from: prevTag, to: tag, maxCount: 50 });
          tagCommitSets.push({
            tag,
            commits: rangeLog.all.map((c) => ({
              hash: c.hash,
              message: c.message,
              author: c.author_name,
              date: c.date,
              type: parseConventionalType(c.message)
            }))
          });
        } catch {
          tagCommitSets.push({ tag, commits: [] });
        }
      }
      if (versionTags.length > 0) {
        try {
          const unreleasedLog = await git.log({ from: versionTags[0], maxCount: 50 });
          if (unreleasedLog.all.length > 0) {
            changelogContent += `## Unreleased

`;
            for (const commit of unreleasedLog.all) {
              const shortHash = commit.hash.slice(0, 7);
              const cleanMsg = commit.message.replace(/^(feat|fix|docs|refactor|test|chore|perf|ci|style|build)(\([^)]*\))?:\s*/, "");
              changelogContent += `- \`${shortHash}\` ${parseConventionalType(commit.message)}: ${cleanMsg}
`;
            }
            changelogContent += "\n";
          }
        } catch {
        }
      }
      const typeLabels = {
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
        other: "Other Changes"
      };
      for (let i = 0; i < tagCommitSets.length; i++) {
        const { tag, commits } = tagCommitSets[i];
        const dateStr = tagDates.get(tag) || "";
        const admonType = i === 0 ? "success" : "note";
        if (commits.length === 0) {
          changelogContent += `??? ${admonType} "${tag}${dateStr ? ` \u2014 ${dateStr}` : ""}"
    No commits in this release.

`;
          continue;
        }
        changelogContent += `??? ${admonType} "${tag}${dateStr ? ` \u2014 ${dateStr}` : ""} (${commits.length} change${commits.length > 1 ? "s" : ""})"
`;
        const grouped = {};
        for (const commit of commits) {
          if (!grouped[commit.type]) grouped[commit.type] = [];
          grouped[commit.type].push(commit);
        }
        for (const [type, label] of Object.entries(typeLabels)) {
          const typeCommits = grouped[type];
          if (!typeCommits || typeCommits.length === 0) continue;
          changelogContent += `    ### ${label}
`;
          for (const commit of typeCommits) {
            const shortHash = commit.hash.slice(0, 7);
            const cleanMsg = commit.message.replace(/^(feat|fix|docs|refactor|test|chore|perf|ci|style|build)(\([^)]*\))?:\s*/, "");
            changelogContent += `    - \`${shortHash}\` ${cleanMsg}${commit.author ? ` *(${commit.author})*` : ""}
`;
          }
          changelogContent += "\n";
        }
      }
    } else {
      const typeLabels = {
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
        other: "Other Changes"
      };
      const grouped = {};
      for (const commit of logResult.all) {
        const type = parseConventionalType(commit.message);
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push({
          hash: commit.hash,
          message: commit.message,
          author: commit.author_name,
          date: commit.date
        });
      }
      for (const [type, label] of Object.entries(typeLabels)) {
        const commits = grouped[type];
        if (!commits || commits.length === 0) continue;
        changelogContent += `## ${label}

`;
        for (const commit of commits.slice(0, 20)) {
          const shortHash = commit.hash.slice(0, 7);
          const cleanMsg = commit.message.replace(/^(feat|fix|docs|refactor|test|chore|perf|ci|style|build)(\([^)]*\))?:\s*/, "");
          const dateStr = commit.date ? new Date(commit.date).toLocaleDateString() : "";
          changelogContent += `- \`${shortHash}\` ${cleanMsg}${dateStr ? ` *(${dateStr})*` : ""}
`;
        }
        changelogContent += "\n";
      }
    }
    try {
      const { readFile: readFs } = await import("fs/promises");
      for (const notesFile of ["CHANGELOG.md", "RELEASE_NOTES.md"]) {
        try {
          const notesPath = path7.join(repoRoot, notesFile);
          const notesContent = await readFs(notesPath, "utf-8");
          if (notesContent.trim()) {
            changelogContent += `---

## Project Release Notes

`;
            changelogContent += `??? note "From ${notesFile}"
`;
            for (const line of notesContent.split("\n").slice(0, 50)) {
              changelogContent += `    ${line}
`;
            }
            changelogContent += "\n";
            break;
          }
        } catch {
        }
      }
    } catch {
    }
  } catch {
    changelogContent = "*Unable to generate changelog \u2014 not a git repository or git is not available.*\n";
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
    audience: "developer"
  };
}

// src/generators/pages/insights.ts
function generateInsightsPage(insights, config) {
  const byCategory = /* @__PURE__ */ new Map();
  const bySeverity = { info: 0, warning: 0, critical: 0 };
  for (const insight of insights) {
    if (!byCategory.has(insight.category)) byCategory.set(insight.category, []);
    byCategory.get(insight.category).push(insight);
    bySeverity[insight.severity]++;
  }
  const categoryLabels = {
    documentation: "Documentation",
    architecture: "Architecture",
    "code-quality": "Code Quality",
    security: "Security",
    performance: "Performance"
  };
  const severityAdmonition = {
    critical: "danger",
    warning: "warning",
    info: "info"
  };
  let categorySections = "";
  for (const [category, catInsights] of byCategory) {
    categorySections += `## ${categoryLabels[category] || category}

`;
    for (const insight of catInsights) {
      const admonType = severityAdmonition[insight.severity] || "info";
      categorySections += `!!! ${admonType} "${insight.title}"
`;
      categorySections += `    ${insight.description}

`;
      if (insight.affectedFiles.length > 0) {
        categorySections += `    **Affected files:** ${insight.affectedFiles.map((f) => `\`${f}\``).join(", ")}

`;
      }
      categorySections += `    **Suggestion:** ${insight.suggestion}

`;
      if (insight.aiSuggestion) {
        categorySections += `    ??? tip "AI Analysis"
`;
        const indented = insight.aiSuggestion.split("\n").map((line) => `        ${line}`).join("\n");
        categorySections += `${indented}

`;
      }
    }
  }
  const hasAiInsights = config.analysis.insights_ai || insights.some((i) => i.aiSuggestion);
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
    audience: "developer"
  };
}

// src/generators/user-content-extractor.ts
function extractUserContent(manifest) {
  const signals = {
    cliCommands: [],
    routes: [],
    configOptions: [],
    errorTypes: [],
    components: []
  };
  for (const mod of manifest.modules) {
    if (isCLIModule(mod)) {
      signals.cliCommands.push(...extractCLICommands(mod));
    }
    if (isRouteModule(mod)) {
      signals.routes.push(...extractRoutes(mod));
    }
    if (isConfigModule(mod)) {
      signals.configOptions.push(...extractConfigOptions(mod));
    }
    signals.errorTypes.push(...extractErrorTypes(mod));
    if (isComponentModule(mod)) {
      signals.components.push(...extractComponents(mod));
    }
    if (mod.filePath.toLowerCase().includes("readme")) {
      signals.readmeContent = mod.moduleDoc?.summary || mod.moduleDoc?.description;
    }
  }
  return signals;
}
function isCLIModule(mod) {
  const pathLower = mod.filePath.toLowerCase();
  if (pathLower.includes("commands/") || pathLower.includes("bin/") || pathLower.includes("cmd/")) {
    return true;
  }
  if (pathLower.includes("cli/") && !pathLower.includes("flows/") && !pathLower.includes("utils/")) {
    const fileName = pathLower.split("/").pop() || "";
    return fileName === "index.ts" || fileName === "index.js" || fileName === "main.ts" || fileName === "main.js";
  }
  return false;
}
function isRouteModule(mod) {
  const pathLower = mod.filePath.toLowerCase();
  return pathLower.includes("routes/") || pathLower.includes("controllers/") || pathLower.includes("handlers/") || pathLower.includes("endpoints/");
}
function isConfigModule(mod) {
  const pathLower = mod.filePath.toLowerCase();
  return pathLower.includes("config") || pathLower.includes("schema") || pathLower.includes("settings");
}
function isComponentModule(mod) {
  const pathLower = mod.filePath.toLowerCase();
  return pathLower.includes("components/") || pathLower.includes("views/") || pathLower.includes("widgets/") || mod.filePath.endsWith(".tsx") || mod.filePath.endsWith(".jsx") || mod.filePath.endsWith(".vue") || mod.filePath.endsWith(".svelte");
}
function toKebabCase(name) {
  return name.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2").toLowerCase();
}
function filterUsefulOptions(params) {
  if (!params) return void 0;
  const generic = /* @__PURE__ */ new Set(["options", "opts", "args", "config", "ctx", "context", "req", "res", "next"]);
  const useful = params.filter((p) => !generic.has(p.toLowerCase()));
  return useful.length > 0 ? useful : void 0;
}
function extractCLICommands(mod) {
  const commands = [];
  const fullDesc = mod.moduleDoc?.description || "";
  const descLines = fullDesc.split("\n").map((l) => l.trim()).filter(Boolean);
  const headerPattern = /^[\w\s]+(?:CLI|cli)\s*[—–-]/i;
  const usefulLines = descLines.length > 1 && headerPattern.test(descLines[0]) ? descLines.slice(1) : descLines;
  const cleanModuleDesc = usefulLines.join(" ").trim();
  for (const sym of mod.symbols) {
    if (sym.exported && (sym.kind === "function" || sym.kind === "variable" || sym.kind === "constant")) {
      if (sym.name.toLowerCase().includes("command") || sym.name.toLowerCase().includes("cmd") || sym.docs?.summary?.toLowerCase().includes("command")) {
        const rawName = sym.name.replace(/(?:command|cmd)$/i, "").replace(/^register/i, "");
        const description = sym.docs?.summary || (cleanModuleDesc || void 0);
        commands.push({
          name: toKebabCase(rawName),
          description,
          filePath: mod.filePath,
          options: filterUsefulOptions(sym.parameters?.map((p) => p.name))
        });
      }
    }
  }
  return commands;
}
function extractRoutes(mod) {
  const routes = [];
  for (const sym of mod.symbols) {
    const methods = ["get", "post", "put", "delete", "patch"];
    const nameLower = sym.name.toLowerCase();
    for (const method of methods) {
      if (nameLower.startsWith(method) || sym.decorators?.some((d) => d.toLowerCase().includes(method))) {
        routes.push({
          method: method.toUpperCase(),
          path: `/${sym.name.replace(/^(get|post|put|delete|patch)/i, "").replace(/^[A-Z]/, (c) => c.toLowerCase()).replace(/([A-Z])/g, "/$1").toLowerCase()}`,
          description: sym.docs?.summary,
          filePath: mod.filePath
        });
        break;
      }
    }
  }
  return routes;
}
function extractConfigOptions(mod) {
  const options = [];
  for (const sym of mod.symbols) {
    if (sym.exported && (sym.kind === "interface" || sym.kind === "type" || sym.kind === "constant")) {
      const children = mod.symbols.filter((s) => s.parentId === sym.id);
      for (const child of children) {
        if (child.typeAnnotation || child.docs?.summary) {
          options.push({
            name: `${sym.name}.${child.name}`,
            type: child.typeAnnotation,
            description: child.docs?.summary,
            defaultValue: child.parameters?.[0]?.defaultValue,
            filePath: mod.filePath
          });
        }
      }
    }
  }
  return options;
}
function extractErrorTypes(mod) {
  const errors = [];
  for (const sym of mod.symbols) {
    if (sym.kind === "class" && (sym.extends === "Error" || sym.extends?.endsWith("Error") || sym.name.endsWith("Error") || sym.name.endsWith("Exception"))) {
      errors.push({
        name: sym.name,
        description: sym.docs?.summary,
        filePath: mod.filePath,
        extends: sym.extends
      });
    }
  }
  return errors;
}
function extractComponents(mod) {
  const components = [];
  for (const sym of mod.symbols) {
    if (sym.exported && (sym.kind === "component" || sym.kind === "function" || sym.kind === "class") && // Heuristic: PascalCase names in component directories are likely components
    /^[A-Z]/.test(sym.name)) {
      components.push({
        name: sym.name,
        description: sym.docs?.summary,
        filePath: mod.filePath,
        props: sym.parameters?.map((p) => p.name)
      });
    }
  }
  return components;
}

// src/generators/pages/user-guide.ts
function generateUserGuidePage(manifest, config) {
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const sectionTitle = config.analysis.user_docs_config?.section_title || "User Guide";
  let content = `---
title: ${projectName} \u2014 ${sectionTitle}
description: User guide for ${projectName}
---

# ${projectName}

`;
  if (signals.readmeContent) {
    content += `${signals.readmeContent}

---

`;
  } else if (manifest.projectMeta.description) {
    content += `${manifest.projectMeta.description}

---

`;
  } else if (manifest.projectMeta.readmeDescription) {
    content += `${manifest.projectMeta.readmeDescription}

---

`;
  }
  content += `## What You Can Do

`;
  if (signals.cliCommands.length > 0) {
    content += `### Commands

`;
    content += `${projectName} provides the following commands:

`;
    for (const cmd of signals.cliCommands) {
      content += `- **${cmd.name}**${cmd.description ? ` \u2014 ${cmd.description}` : ""}
`;
    }
    content += "\n";
  }
  if (signals.routes.length > 0) {
    content += `### API Endpoints

`;
    content += `| Method | Path | Description |
`;
    content += `|--------|------|-------------|
`;
    for (const route of signals.routes) {
      content += `| \`${route.method}\` | \`${route.path}\` | ${route.description || ""} |
`;
    }
    content += "\n";
  }
  if (signals.components.length > 0) {
    content += `### Components

`;
    for (const comp of signals.components.slice(0, 15)) {
      content += `- **${comp.name}**${comp.description ? ` \u2014 ${comp.description}` : ""}
`;
    }
    content += "\n";
  }
  if (signals.cliCommands.length === 0 && signals.routes.length === 0 && signals.components.length === 0) {
    content += `${projectName} is a ${manifest.projectMeta.languages[0]?.name || "software"} project with ${manifest.stats.totalFiles} source files.

`;
  }
  content += `---

`;
  content += `## Quick Links

`;
  content += `- [Getting Started](user-getting-started.md) \u2014 Install and set up ${projectName}
`;
  content += `- [Features](features.md) \u2014 Detailed feature documentation
`;
  content += `- [Troubleshooting](troubleshooting.md) \u2014 Common issues and solutions
`;
  content += `- [FAQ](faq.md) \u2014 Frequently asked questions
`;
  content += `
---

*Generated by [DocWalk](https://docwalk.dev)*
`;
  return {
    path: "user-guide.md",
    title: "Overview",
    content,
    navGroup: sectionTitle,
    navOrder: 0,
    audience: "user"
  };
}
async function generateUserGuidePageNarrative(manifest, config, provider) {
  const basePage = generateUserGuidePage(manifest, config);
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const signalsSummary = [
    signals.cliCommands.length > 0 ? `CLI commands: ${signals.cliCommands.map((c) => c.name).join(", ")}` : "",
    signals.routes.length > 0 ? `API routes: ${signals.routes.length}` : "",
    signals.components.length > 0 ? `Components: ${signals.components.map((c) => c.name).slice(0, 10).join(", ")}` : "",
    signals.configOptions.length > 0 ? `Config options: ${signals.configOptions.length}` : ""
  ].filter(Boolean).join("\n");
  const prompt = `Write a user-friendly overview page for "${projectName}". This is documentation for END USERS, not developers.

PROJECT SIGNALS:
${signalsSummary}
${signals.readmeContent ? `README: ${signals.readmeContent}` : ""}
Languages: ${manifest.projectMeta.languages.map((l) => l.name).join(", ")}

INSTRUCTIONS:
1. Explain what this software does in plain language
2. Who is it for? What problems does it solve?
3. List the main capabilities/features
4. Keep it friendly and accessible \u2014 avoid jargon
5. Write 3-5 paragraphs in Markdown format`;
  try {
    const prose = await provider.generate(prompt, {
      maxTokens: 1024,
      temperature: 0.4,
      systemPrompt: "You write clear, friendly documentation for end users. Avoid developer jargon."
    });
    const sectionTitle = config.analysis.user_docs_config?.section_title || "User Guide";
    const content = `---
title: ${projectName} \u2014 ${sectionTitle}
description: User guide for ${projectName}
---

# ${projectName}

${prose}

---

## Quick Links

- [Getting Started](user-getting-started.md) \u2014 Install and set up ${projectName}
- [Features](features.md) \u2014 Detailed feature documentation
- [Troubleshooting](troubleshooting.md) \u2014 Common issues and solutions
- [FAQ](faq.md) \u2014 Frequently asked questions

---

*Generated by [DocWalk](https://docwalk.dev)*
`;
    return { ...basePage, content };
  } catch {
    return basePage;
  }
}

// src/generators/pages/user-getting-started.ts
function generateUserGettingStartedPage(manifest, config) {
  const projectName = resolveProjectName(manifest);
  const pkgManager = detectPackageManager(manifest.modules);
  const installCmd = getInstallCommand(pkgManager);
  const signals = extractUserContent(manifest);
  const sectionTitle = config.analysis.user_docs_config?.section_title || "User Guide";
  let content = `---
title: Getting Started with ${projectName}
description: Installation and first-use guide for ${projectName}
---

# Getting Started

This guide will help you install and start using **${projectName}**.

---

## Installation

\`\`\`bash
${installCmd}
\`\`\`

`;
  if (signals.cliCommands.length > 0) {
    content += `---

## Quick Start

`;
    content += `After installation, you can use the following commands:

`;
    content += `| Command | Description |
`;
    content += `|---------|-------------|
`;
    for (const cmd of signals.cliCommands.slice(0, 10)) {
      const desc = cmd.description || "";
      content += `| \`${projectName} ${cmd.name}\` | ${desc} |
`;
    }
    content += "\n";
  }
  if (signals.routes.length > 0) {
    content += `---

## API Quick Start

`;
    content += `${projectName} exposes the following endpoints:

`;
    for (const route of signals.routes.slice(0, 5)) {
      content += `- \`${route.method} ${route.path}\`${route.description ? ` \u2014 ${route.description}` : ""}
`;
    }
    content += "\n";
  }
  const usefulConfigOpts = signals.configOptions.filter((o) => o.type || o.description);
  if (usefulConfigOpts.length > 0) {
    content += `---

## Configuration

`;
    content += `Key configuration options:

`;
    content += `| Option | Type | Description |
`;
    content += `|--------|------|-------------|
`;
    for (const opt of usefulConfigOpts.slice(0, 10)) {
      content += `| \`${opt.name}\` | ${opt.type || "\u2014"} | ${opt.description || ""} |
`;
    }
    content += "\n";
  }
  content += `---

## Next Steps

`;
  content += `- [Features](features.md) \u2014 Explore all features in detail
`;
  content += `- [Troubleshooting](troubleshooting.md) \u2014 Solutions to common problems
`;
  content += `- [FAQ](faq.md) \u2014 Frequently asked questions
`;
  content += `
---

*Generated by [DocWalk](https://docwalk.dev)*
`;
  return {
    path: "user-getting-started.md",
    title: "Getting Started",
    content,
    navGroup: sectionTitle,
    navOrder: 1,
    audience: "user"
  };
}
async function generateUserGettingStartedPageNarrative(manifest, config, provider) {
  const basePage = generateUserGettingStartedPage(manifest, config);
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const prompt = `Write a getting-started tutorial for end users of "${projectName}".

AVAILABLE COMMANDS: ${signals.cliCommands.map((c) => c.name).join(", ") || "none detected"}
AVAILABLE ROUTES: ${signals.routes.map((r) => `${r.method} ${r.path}`).join(", ") || "none detected"}
CONFIG OPTIONS: ${signals.configOptions.length}
PACKAGE MANAGER: ${manifest.projectMeta.packageManager || "unknown"}

INSTRUCTIONS:
1. Write step-by-step installation instructions
2. Show a practical "first use" walkthrough
3. Include code blocks for commands the user should run
4. Write for someone who has never used this software before
5. Be friendly and encouraging
6. Write in Markdown with proper headings`;
  try {
    const prose = await provider.generate(prompt, {
      maxTokens: 1536,
      temperature: 0.3,
      systemPrompt: "You write clear, step-by-step tutorials for end users. Use simple language."
    });
    const sectionTitle = config.analysis.user_docs_config?.section_title || "User Guide";
    return {
      ...basePage,
      content: `---
title: Getting Started with ${projectName}
description: Installation and first-use guide for ${projectName}
---

# Getting Started

${prose}

---

## Next Steps

- [Features](features.md) \u2014 Explore all features in detail
- [Troubleshooting](troubleshooting.md) \u2014 Solutions to common problems
- [FAQ](faq.md) \u2014 Frequently asked questions

---

*Generated by [DocWalk](https://docwalk.dev)*
`
    };
  } catch {
    return basePage;
  }
}

// src/generators/pages/features.ts
function generateFeaturesPage(manifest, config) {
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const sectionTitle = config.analysis.user_docs_config?.section_title || "User Guide";
  let content = `---
title: Features
description: Feature documentation for ${projectName}
---

# Features

A comprehensive guide to everything ${projectName} can do.

`;
  if (signals.cliCommands.length > 0) {
    content += `---

## Commands

`;
    for (const cmd of signals.cliCommands) {
      content += `### \`${projectName} ${cmd.name}\`

`;
      if (cmd.description) {
        content += `${cmd.description}

`;
      }
      if (cmd.options && cmd.options.length > 0) {
        content += `**Options:**

`;
        for (const opt of cmd.options) {
          content += `- \`--${opt}\`
`;
        }
        content += "\n";
      }
    }
  }
  if (signals.routes.length > 0) {
    content += `---

## API Endpoints

`;
    for (const route of signals.routes) {
      content += `### \`${route.method} ${route.path}\`

`;
      content += `${route.description || "Handles requests."}

`;
    }
  }
  if (signals.components.length > 0) {
    content += `---

## Components

`;
    for (const comp of signals.components.slice(0, 20)) {
      content += `### ${comp.name}

`;
      content += `${comp.description || `The ${comp.name} component.`}

`;
      if (comp.props && comp.props.length > 0) {
        content += `**Props:** ${comp.props.map((p) => `\`${p}\``).join(", ")}

`;
      }
    }
  }
  const usefulConfigOpts = signals.configOptions.filter((o) => o.type || o.description);
  if (usefulConfigOpts.length > 0) {
    content += `---

## Configuration Options

`;
    content += `| Option | Type | Default | Description |
`;
    content += `|--------|------|---------|-------------|
`;
    for (const opt of usefulConfigOpts.slice(0, 30)) {
      content += `| \`${opt.name}\` | ${opt.type || "\u2014"} | ${opt.defaultValue || "\u2014"} | ${opt.description || ""} |
`;
    }
    content += "\n";
  }
  if (signals.cliCommands.length === 0 && signals.routes.length === 0 && signals.components.length === 0 && usefulConfigOpts.length === 0) {
    content += `For detailed information about ${projectName}'s features, see the [Developer Reference](getting-started.md).

`;
  }
  content += `---

*Generated by [DocWalk](https://docwalk.dev)*
`;
  return {
    path: "features.md",
    title: "Features",
    content,
    navGroup: sectionTitle,
    navOrder: 2,
    audience: "user"
  };
}
async function generateFeaturesPageNarrative(manifest, config, provider) {
  const basePage = generateFeaturesPage(manifest, config);
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const featureList = [
    ...signals.cliCommands.map((c) => `Command: ${c.name} \u2014 ${c.description || ""}`),
    ...signals.routes.map((r) => `API: ${r.method} ${r.path} \u2014 ${r.description || ""}`),
    ...signals.components.slice(0, 10).map((c) => `Component: ${c.name} \u2014 ${c.description || ""}`)
  ].join("\n");
  const prompt = `Write feature documentation for "${projectName}" aimed at end users.

DETECTED FEATURES:
${featureList || "No specific features detected \u2014 describe general capabilities based on the project type."}

CONFIG OPTIONS: ${signals.configOptions.length}
LANGUAGES: ${manifest.projectMeta.languages.map((l) => l.name).join(", ")}

INSTRUCTIONS:
1. Write clear, user-friendly descriptions for each feature
2. Include practical examples of when/how to use each feature
3. Group related features together
4. Use simple language \u2014 this is for users, not developers
5. Write in Markdown with proper headings and code blocks where appropriate`;
  try {
    const prose = await provider.generate(prompt, {
      maxTokens: 2048,
      temperature: 0.4,
      systemPrompt: "You write clear feature documentation for end users."
    });
    return {
      ...basePage,
      content: `---
title: Features
description: Feature documentation for ${projectName}
---

# Features

${prose}

---

*Generated by [DocWalk](https://docwalk.dev)*
`
    };
  } catch {
    return basePage;
  }
}

// src/generators/pages/troubleshooting.ts
function generateTroubleshootingPage(manifest, config) {
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const sectionTitle = config.analysis.user_docs_config?.section_title || "User Guide";
  let content = `---
title: Troubleshooting
description: Common issues and solutions for ${projectName}
---

# Troubleshooting

Having trouble? Check the common issues below or see the error reference.

`;
  if (signals.errorTypes.length > 0) {
    content += `---

## Error Reference

`;
    for (const err of signals.errorTypes) {
      content += `### ${err.name}

`;
      if (err.description) {
        content += `${err.description}

`;
      }
      if (err.extends && err.extends !== "Error") {
        content += `Extends: \`${err.extends}\`

`;
      }
      content += `Source: \`${err.filePath}\`

`;
    }
  }
  content += `---

## Common Issues

`;
  content += `### Installation Problems

`;
  content += `If you're having trouble installing ${projectName}:

`;
  content += `1. Make sure you have the required runtime installed
`;
  content += `2. Check that your version meets the minimum requirements
`;
  content += `3. Try clearing your package manager cache and reinstalling

`;
  if (signals.configOptions.length > 0) {
    content += `### Configuration Issues

`;
    content += `If ${projectName} isn't behaving as expected:

`;
    content += `1. Check your configuration file for syntax errors
`;
    content += `2. Verify all required options are set
`;
    content += `3. Check environment variables are properly set

`;
  }
  content += `### Getting Help

`;
  const repo = manifest.projectMeta.repository;
  const hasValidRepo = repo && repo !== "." && repo.includes("/");
  if (hasValidRepo) {
    content += `- File an issue: [GitHub Issues](https://github.com/${repo}/issues)
`;
  }
  content += `- Check the [FAQ](faq.md) for answers to common questions

`;
  content += `---

*Generated by [DocWalk](https://docwalk.dev)*
`;
  return {
    path: "troubleshooting.md",
    title: "Troubleshooting",
    content,
    navGroup: sectionTitle,
    navOrder: 3,
    audience: "user"
  };
}
async function generateTroubleshootingPageNarrative(manifest, config, provider) {
  const basePage = generateTroubleshootingPage(manifest, config);
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const errorList = signals.errorTypes.map((e) => `${e.name}${e.description ? `: ${e.description}` : ""}`).join("\n");
  const prompt = `Write a troubleshooting guide for "${projectName}" aimed at end users.

KNOWN ERROR TYPES:
${errorList || "No custom error types detected."}

PROJECT TYPE: ${manifest.projectMeta.projectType || "unknown"}
LANGUAGES: ${manifest.projectMeta.languages.map((l) => l.name).join(", ")}
CLI COMMANDS: ${signals.cliCommands.length}
CONFIG OPTIONS: ${signals.configOptions.length}

INSTRUCTIONS:
1. Create a practical troubleshooting guide with common issues and solutions
2. For each known error type, explain what causes it and how to fix it
3. Include general troubleshooting steps (installation, configuration, runtime)
4. Add a "Getting Help" section
5. Write in a friendly, supportive tone
6. Use Markdown with proper headings, code blocks, and admonitions`;
  try {
    const prose = await provider.generate(prompt, {
      maxTokens: 2048,
      temperature: 0.3,
      systemPrompt: "You write helpful troubleshooting guides for end users. Be empathetic and solution-focused."
    });
    return {
      ...basePage,
      content: `---
title: Troubleshooting
description: Common issues and solutions for ${projectName}
---

# Troubleshooting

${prose}

---

*Generated by [DocWalk](https://docwalk.dev)*
`
    };
  } catch {
    return basePage;
  }
}

// src/generators/pages/faq.ts
function generateFAQPage(manifest, config) {
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const sectionTitle = config.analysis.user_docs_config?.section_title || "User Guide";
  let content = `---
title: FAQ
description: Frequently asked questions about ${projectName}
---

# Frequently Asked Questions

`;
  const repo = manifest.projectMeta.repository;
  const hasValidRepo = repo && repo !== "." && repo.includes("/");
  const repoUrl = hasValidRepo ? `https://github.com/${repo}` : "";
  const langList = manifest.projectMeta.languages.map((l) => l.name).join(", ");
  const description = manifest.projectMeta.readmeDescription || manifest.projectMeta.description || `A ${langList} project with ${manifest.stats.totalFiles} source files and ${manifest.stats.totalSymbols} symbols.`;
  content += `??? question "What is ${projectName}?"
`;
  content += `    ${description}

`;
  content += `??? question "What languages/technologies does ${projectName} use?"
`;
  content += `    ${manifest.projectMeta.languages.map((l) => `**${l.name}** (${l.percentage}%)`).join(", ")}.

`;
  if (signals.cliCommands.length > 0) {
    content += `??? question "What commands are available?"
`;
    content += `    Available commands: ${signals.cliCommands.map((c) => `\`${projectName} ${c.name}\``).join(", ")}. See the [Getting Started](user-getting-started.md) guide for usage details.

`;
  }
  const usefulConfigOpts = signals.configOptions.filter((o) => o.type || o.description);
  if (usefulConfigOpts.length > 0) {
    content += `??? question "How do I configure ${projectName}?"
`;
    content += `    ${projectName} has ${usefulConfigOpts.length} configuration options. See the [Features](features.md) page for details on each option.

`;
  }
  if (signals.routes.length > 0) {
    content += `??? question "What API endpoints are available?"
`;
    content += `    ${projectName} provides ${signals.routes.length} API endpoints. See the [Features](features.md) page for the full API reference.

`;
  }
  if (repoUrl) {
    content += `??? question "Where can I report bugs or request features?"
`;
    content += `    File an issue on [GitHub](${repoUrl}/issues).

`;
    content += `??? question "How can I contribute?"
`;
    content += `    Check the [repository](${repoUrl}) for contribution guidelines.

`;
  }
  content += `??? question "Where can I find the developer documentation?"
`;
  content += `    See the [Developer Reference](getting-started.md) section for architecture, API reference, and source documentation.

`;
  content += `---

*Generated by [DocWalk](https://docwalk.dev)*
`;
  return {
    path: "faq.md",
    title: "FAQ",
    content,
    navGroup: sectionTitle,
    navOrder: 4,
    audience: "user"
  };
}
async function generateFAQPageNarrative(manifest, config, provider) {
  const basePage = generateFAQPage(manifest, config);
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const contextSummary = [
    `Project: ${projectName}`,
    `Languages: ${manifest.projectMeta.languages.map((l) => l.name).join(", ")}`,
    `Files: ${manifest.stats.totalFiles}`,
    signals.cliCommands.length > 0 ? `CLI commands: ${signals.cliCommands.map((c) => c.name).join(", ")}` : "",
    signals.routes.length > 0 ? `API routes: ${signals.routes.length}` : "",
    signals.configOptions.length > 0 ? `Config options: ${signals.configOptions.length}` : "",
    signals.errorTypes.length > 0 ? `Error types: ${signals.errorTypes.map((e) => e.name).join(", ")}` : "",
    signals.readmeContent ? `README: ${signals.readmeContent.slice(0, 500)}` : ""
  ].filter(Boolean).join("\n");
  const prompt = `Generate a comprehensive FAQ page for "${projectName}" aimed at end users.

PROJECT CONTEXT:
${contextSummary}

INSTRUCTIONS:
1. Generate 8-15 frequently asked questions with detailed answers
2. Cover: what it is, installation, basic usage, configuration, troubleshooting, contributing
3. Write clear, helpful answers in plain language
4. Use MkDocs-compatible collapsible FAQ format: ??? question "Question here"
5. Include code examples in answers where helpful
6. Write in Markdown format`;
  try {
    const prose = await provider.generate(prompt, {
      maxTokens: 2048,
      temperature: 0.4,
      systemPrompt: "You write comprehensive FAQ pages for end users. Be thorough and helpful."
    });
    return {
      ...basePage,
      content: `---
title: FAQ
description: Frequently asked questions about ${projectName}
---

# Frequently Asked Questions

${prose}

---

*Generated by [DocWalk](https://docwalk.dev)*
`
    };
  } catch {
    return basePage;
  }
}

export {
  generateOverviewPage,
  generateOverviewPageNarrative,
  generateGettingStartedPage,
  generateGettingStartedPageNarrative,
  generateArchitecturePage,
  generateTieredArchitecturePages,
  generateArchitecturePageNarrative,
  generateModulePage,
  generateModulePageNarrative,
  generateConfigurationPage,
  generateTypesPage,
  generateDependenciesPage,
  generateSBOMPage,
  generateUsageGuidePage,
  generateChangelogPage,
  generateInsightsPage,
  generateUserGuidePage,
  generateUserGuidePageNarrative,
  generateUserGettingStartedPage,
  generateUserGettingStartedPageNarrative,
  generateFeaturesPage,
  generateFeaturesPageNarrative,
  generateTroubleshootingPage,
  generateTroubleshootingPageNarrative,
  generateFAQPage,
  generateFAQPageNarrative
};
