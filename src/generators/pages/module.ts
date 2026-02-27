import path from "path";
import type { DocWalkConfig } from "../../config/schema.js";
import type { AnalysisManifest, ModuleInfo, Symbol, GeneratedPage, DependencyEdge } from "../../analysis/types.js";
import type { AIProvider } from "../../analysis/providers/base.js";
import { getLanguageDisplayName, type LanguageId } from "../../analysis/language-detect.js";
import { getLanguageTag, getKindBadge, sanitizeMermaidId, renderSymbol } from "../utils.js";
import type { RenderSymbolOptions } from "../utils.js";
import { generateModuleNarrative, renderCitations } from "../narrative-engine.js";

export interface ModulePageContext {
  config: DocWalkConfig;
  manifest: AnalysisManifest;
  symbolPageMap: Map<string, string>;
}

export function generateModulePage(mod: ModuleInfo, group: string, ctx?: ModulePageContext): GeneratedPage {
  const slug = mod.filePath
    .replace(/\.[^.]+$/, "");

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
        const refSlug = ref.replace(/\.[^.]+$/, "");
        content += `- [\`${ref}\`](/api/${refSlug}.md)\n`;
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
 * Generate an AI-enhanced module page with narrative descriptions.
 */
export async function generateModulePageNarrative(
  mod: ModuleInfo,
  group: string,
  ctx: ModulePageContext,
  provider: AIProvider,
  readFile: (filePath: string) => Promise<string>
): Promise<GeneratedPage> {
  const basePage = generateModulePage(mod, group, ctx);

  try {
    const narrative = await generateModuleNarrative(mod, {
      provider,
      manifest: ctx.manifest,
      readFile,
    });

    const repoUrl = ctx.config.source.repo.includes("/") ? ctx.config.source.repo : undefined;
    const prose = renderCitations(narrative.prose, narrative.citations, repoUrl, ctx.config.source.branch);

    // Insert narrative prose after the module metadata table
    const insertPoint = basePage.content.indexOf("---\n\n## Exports");
    if (insertPoint > 0) {
      const content = basePage.content.slice(0, insertPoint) +
        `\n## Overview\n\n${prose}\n\n` +
        basePage.content.slice(insertPoint);
      return { ...basePage, content };
    }

    return basePage;
  } catch {
    return basePage;
  }
}
