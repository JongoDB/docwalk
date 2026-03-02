// src/analysis/structure-advisor.ts
function buildFileTree(manifest) {
  return manifest.modules.map((m) => m.filePath).sort().join("\n");
}
function findReadmeContent(manifest) {
  if (manifest.projectMeta.readmeDescription) {
    return manifest.projectMeta.readmeDescription;
  }
  const readmeModule = manifest.modules.find(
    (m) => m.filePath.toLowerCase().includes("readme")
  );
  if (!readmeModule) return void 0;
  return readmeModule.aiSummary || readmeModule.moduleDoc?.summary;
}
function buildModuleSummaries(manifest, topN = 20) {
  const { dependencyGraph, modules } = manifest;
  const connectionCount = /* @__PURE__ */ new Map();
  for (const edge of dependencyGraph.edges) {
    connectionCount.set(edge.from, (connectionCount.get(edge.from) || 0) + 1);
    connectionCount.set(edge.to, (connectionCount.get(edge.to) || 0) + 1);
  }
  const ranked = modules.map((m) => ({ module: m, connections: connectionCount.get(m.filePath) || 0 })).sort((a, b) => b.connections - a.connections).slice(0, topN);
  return ranked.map((r) => {
    const summary = r.module.aiSummary || r.module.moduleDoc?.summary || "(no summary)";
    return `- ${r.module.filePath} (${r.connections} connections): ${summary}`;
  }).join("\n");
}
function buildStructurePrompt(manifest, fileTree, readmeContent, moduleSummaries, comprehensive) {
  const languages = manifest.projectMeta.languages.map((l) => `${l.name} (${l.percentage}%)`).join(", ");
  const pageRange = comprehensive ? "8-12" : "4-6";
  return `Analyze this repository and create a wiki structure.

FILE TREE:
${fileTree}

README:
${readmeContent || "No README found"}

PROJECT: ${manifest.projectMeta.name}
LANGUAGES: ${languages}
FILES: ${manifest.stats.totalFiles}

MODULE SUMMARIES (most connected):
${moduleSummaries}

Create a structured wiki with ${pageRange} pages.
Each page should focus on a specific aspect that would benefit from detailed documentation:
- Architecture overviews
- Data flow descriptions
- Component relationships
- Process workflows
- Key subsystems

Return ONLY valid XML with no markdown code blocks:

<wiki_structure>
  <pages>
    <page id="page-1">
      <title>Page Title</title>
      <description>What this page covers</description>
      <importance>high|medium|low</importance>
      <relevant_files>
        <file_path>src/path/to/file.ts</file_path>
      </relevant_files>
      <related_pages>
        <related>page-2</related>
      </related_pages>
    </page>
  </pages>
</wiki_structure>

RULES:
1. Each page must have at least 3 relevant_files from the file tree
2. Pages should cover distinct aspects \u2014 no overlap
3. Include at least one architecture/overview page
4. Every important file should be assigned to at least one page
5. Order pages from most important to least`;
}
function parseStructureXml(xml) {
  const structureMatch = xml.match(/<wiki_structure>([\s\S]*?)<\/wiki_structure>/);
  if (!structureMatch) return [];
  const structureBody = structureMatch[1];
  const pageRegex = /<page\s+id="([^"]*)">([\s\S]*?)<\/page>/g;
  const pages = [];
  let pageMatch;
  let index = 0;
  while ((pageMatch = pageRegex.exec(structureBody)) !== null) {
    const id = pageMatch[1];
    const body = pageMatch[2];
    const title = body.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || id;
    const description = body.match(/<description>([\s\S]*?)<\/description>/)?.[1]?.trim() || "";
    const importance = body.match(/<importance>([\s\S]*?)<\/importance>/)?.[1]?.trim();
    const filePaths = [];
    const filePathRegex = /<file_path>([\s\S]*?)<\/file_path>/g;
    let fpMatch;
    while ((fpMatch = filePathRegex.exec(body)) !== null) {
      filePaths.push(fpMatch[1].trim());
    }
    const relatedPages = [];
    const relatedRegex = /<related>([\s\S]*?)<\/related>/g;
    let relMatch;
    while ((relMatch = relatedRegex.exec(body)) !== null) {
      relatedPages.push(relMatch[1].trim());
    }
    pages.push({
      id,
      title,
      description,
      navGroup: "Concepts",
      navOrder: 20 + index,
      relatedModules: filePaths,
      importance: importance && ["high", "medium", "low"].includes(importance) ? importance : "medium",
      relatedPages
    });
    index++;
  }
  return pages;
}
function buildStaticPlan(manifest) {
  return {
    conceptPages: [],
    sections: [],
    audienceSplit: false,
    navGroups: [],
    isComprehensive: false
  };
}
async function analyzeStructure(manifest, provider, comprehensive) {
  if (!provider) {
    return buildStaticPlan(manifest);
  }
  try {
    const fileTree = buildFileTree(manifest);
    const readmeContent = findReadmeContent(manifest);
    const moduleSummaries = buildModuleSummaries(manifest, 20);
    const isComprehensive = comprehensive ?? false;
    const prompt = buildStructurePrompt(
      manifest,
      fileTree,
      readmeContent,
      moduleSummaries,
      isComprehensive
    );
    const response = await provider.generate(prompt, {
      maxTokens: 2048,
      temperature: 0.3,
      systemPrompt: "You are a documentation architect. Analyze codebases and return wiki structures as valid XML. Return ONLY XML \u2014 no explanation, no markdown code blocks."
    });
    const conceptPages = parseStructureXml(response);
    if (conceptPages.length === 0) {
      return buildStaticPlan(manifest);
    }
    const audienceSplit = manifest.modules.some(
      (m) => m.filePath.includes("cli/") || m.filePath.includes("commands/")
    );
    const navGroups = [...new Set(conceptPages.map((p) => p.navGroup))];
    const sections = navGroups.map((group, i) => ({
      id: `section-${i + 1}`,
      title: group,
      pages: conceptPages.filter((p) => p.navGroup === group).map((p) => p.id)
    }));
    return {
      conceptPages,
      sections,
      audienceSplit,
      navGroups,
      isComprehensive
    };
  } catch {
    return buildStaticPlan(manifest);
  }
}
export {
  analyzeStructure
};
