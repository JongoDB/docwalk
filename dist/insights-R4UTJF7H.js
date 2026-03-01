// src/analysis/insights.ts
function runStaticInsights(manifest) {
  const insights = [];
  insights.push(...detectUndocumentedExports(manifest));
  insights.push(...detectCircularDependencies(manifest));
  insights.push(...detectOversizedModules(manifest));
  insights.push(...detectGodModules(manifest));
  insights.push(...detectOrphanModules(manifest));
  insights.push(...detectMissingTypes(manifest));
  insights.push(...detectInconsistentNaming(manifest));
  insights.push(...detectDeepNesting(manifest));
  return insights;
}
function detectUndocumentedExports(manifest) {
  const insights = [];
  const undocumented = [];
  for (const mod of manifest.modules) {
    for (const sym of mod.symbols) {
      if (sym.exported && !sym.docs?.summary && !sym.aiSummary) {
        undocumented.push({ file: mod.filePath, name: sym.name });
      }
    }
  }
  if (undocumented.length > 0) {
    const affectedFiles = [...new Set(undocumented.map((u) => u.file))];
    insights.push({
      id: "undocumented-exports",
      category: "documentation",
      severity: undocumented.length > 20 ? "warning" : "info",
      title: `${undocumented.length} undocumented exported symbol${undocumented.length > 1 ? "s" : ""}`,
      description: `Found ${undocumented.length} exported symbols without JSDoc/docstring documentation across ${affectedFiles.length} file${affectedFiles.length > 1 ? "s" : ""}. Examples: ${undocumented.slice(0, 5).map((u) => `\`${u.name}\``).join(", ")}${undocumented.length > 5 ? "..." : ""}.`,
      affectedFiles: affectedFiles.slice(0, 10),
      suggestion: "Add JSDoc comments or docstrings to all exported symbols to improve API documentation quality."
    });
  }
  return insights;
}
function detectCircularDependencies(manifest) {
  const insights = [];
  const { edges } = manifest.dependencyGraph;
  const adj = /* @__PURE__ */ new Map();
  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from).push(edge.to);
  }
  const visited = /* @__PURE__ */ new Set();
  const inStack = /* @__PURE__ */ new Set();
  const cycles = [];
  function dfs(node, path) {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    inStack.add(node);
    for (const neighbor of adj.get(node) || []) {
      dfs(neighbor, [...path, node]);
    }
    inStack.delete(node);
  }
  for (const node of manifest.dependencyGraph.nodes) {
    dfs(node, []);
    if (cycles.length >= 10) break;
  }
  if (cycles.length > 0) {
    const affectedFiles = [...new Set(cycles.flat())];
    insights.push({
      id: "circular-dependencies",
      category: "architecture",
      severity: "warning",
      title: `${cycles.length} circular dependenc${cycles.length > 1 ? "ies" : "y"} detected`,
      description: `Found ${cycles.length} circular dependency chain${cycles.length > 1 ? "s" : ""} in the module graph. Example: ${cycles[0].map((f) => `\`${f.split("/").pop()}\``).join(" \u2192 ")} \u2192 ...`,
      affectedFiles: affectedFiles.slice(0, 10),
      suggestion: "Break circular dependencies by extracting shared types into a separate module or using dependency inversion."
    });
  }
  return insights;
}
function detectOversizedModules(manifest, maxLines = 500, maxSymbols = 30) {
  const insights = [];
  const oversized = [];
  for (const mod of manifest.modules) {
    if (mod.lineCount > maxLines || mod.symbols.length > maxSymbols) {
      oversized.push({
        file: mod.filePath,
        lines: mod.lineCount,
        symbols: mod.symbols.length
      });
    }
  }
  if (oversized.length > 0) {
    insights.push({
      id: "oversized-modules",
      category: "code-quality",
      severity: oversized.length > 5 ? "warning" : "info",
      title: `${oversized.length} oversized module${oversized.length > 1 ? "s" : ""}`,
      description: `Found ${oversized.length} module${oversized.length > 1 ? "s" : ""} exceeding ${maxLines} lines or ${maxSymbols} symbols. Largest: \`${oversized[0].file}\` (${oversized[0].lines} lines, ${oversized[0].symbols} symbols).`,
      affectedFiles: oversized.map((o) => o.file).slice(0, 10),
      suggestion: "Consider splitting large modules into smaller, focused files with single responsibility."
    });
  }
  return insights;
}
function detectGodModules(manifest, maxEdges = 15) {
  const insights = [];
  const { edges } = manifest.dependencyGraph;
  const edgeCounts = /* @__PURE__ */ new Map();
  for (const edge of edges) {
    if (!edgeCounts.has(edge.from)) edgeCounts.set(edge.from, { incoming: 0, outgoing: 0 });
    if (!edgeCounts.has(edge.to)) edgeCounts.set(edge.to, { incoming: 0, outgoing: 0 });
    edgeCounts.get(edge.from).outgoing++;
    edgeCounts.get(edge.to).incoming++;
  }
  const godModules = [...edgeCounts.entries()].filter(([, counts]) => counts.incoming + counts.outgoing > maxEdges).sort((a, b) => b[1].incoming + b[1].outgoing - (a[1].incoming + a[1].outgoing));
  if (godModules.length > 0) {
    insights.push({
      id: "god-modules",
      category: "architecture",
      severity: godModules.length > 3 ? "warning" : "info",
      title: `${godModules.length} god module${godModules.length > 1 ? "s" : ""} with excessive connections`,
      description: `Found ${godModules.length} module${godModules.length > 1 ? "s" : ""} with more than ${maxEdges} dependency connections. Most connected: \`${godModules[0][0]}\` (${godModules[0][1].incoming} in, ${godModules[0][1].outgoing} out).`,
      affectedFiles: godModules.map(([f]) => f).slice(0, 10),
      suggestion: "Consider introducing intermediate abstraction layers or splitting responsibilities to reduce coupling."
    });
  }
  return insights;
}
function detectOrphanModules(manifest) {
  const insights = [];
  const { nodes, edges } = manifest.dependencyGraph;
  const connectedNodes = /* @__PURE__ */ new Set();
  for (const edge of edges) {
    connectedNodes.add(edge.from);
    connectedNodes.add(edge.to);
  }
  const orphans = nodes.filter((n) => !connectedNodes.has(n));
  const nonEntryOrphans = orphans.filter(
    (o) => !o.includes("index.") && !o.includes("main.") && !o.includes("app.")
  );
  if (nonEntryOrphans.length > 0) {
    insights.push({
      id: "orphan-modules",
      category: "code-quality",
      severity: nonEntryOrphans.length > 5 ? "warning" : "info",
      title: `${nonEntryOrphans.length} orphan module${nonEntryOrphans.length > 1 ? "s" : ""} (potential dead code)`,
      description: `Found ${nonEntryOrphans.length} module${nonEntryOrphans.length > 1 ? "s" : ""} with no imports or exports in the dependency graph. These may be unused dead code.`,
      affectedFiles: nonEntryOrphans.slice(0, 10),
      suggestion: "Review orphan modules \u2014 remove if unused, or add explicit imports/exports if they are needed."
    });
  }
  return insights;
}
function detectMissingTypes(manifest) {
  const insights = [];
  const untyped = [];
  for (const mod of manifest.modules) {
    if (mod.language !== "typescript") continue;
    for (const sym of mod.symbols) {
      if (sym.exported && sym.kind === "function") {
        if (sym.returns?.type === "any" || !sym.returns?.type && !sym.signature?.includes(":")) {
          untyped.push({ file: mod.filePath, name: sym.name });
        }
        if (sym.parameters) {
          for (const param of sym.parameters) {
            if (param.type === "any") {
              untyped.push({ file: mod.filePath, name: `${sym.name}(${param.name})` });
            }
          }
        }
      }
    }
  }
  if (untyped.length > 0) {
    const affectedFiles = [...new Set(untyped.map((u) => u.file))];
    insights.push({
      id: "missing-types",
      category: "code-quality",
      severity: untyped.length > 10 ? "warning" : "info",
      title: `${untyped.length} symbol${untyped.length > 1 ? "s" : ""} with missing or \`any\` types`,
      description: `Found ${untyped.length} exported function${untyped.length > 1 ? "s" : ""} with \`any\` types or missing return types. Examples: ${untyped.slice(0, 3).map((u) => `\`${u.name}\``).join(", ")}.`,
      affectedFiles: affectedFiles.slice(0, 10),
      suggestion: "Add explicit type annotations to improve type safety and documentation quality."
    });
  }
  return insights;
}
function detectInconsistentNaming(manifest) {
  const insights = [];
  const exportedNames = [];
  for (const mod of manifest.modules) {
    for (const sym of mod.symbols) {
      if (sym.exported) {
        exportedNames.push(sym.name);
      }
    }
  }
  if (exportedNames.length < 5) return insights;
  let camelCount = 0;
  let pascalCount = 0;
  let snakeCount = 0;
  for (const name of exportedNames) {
    if (/^[a-z][a-zA-Z0-9]*$/.test(name)) camelCount++;
    else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) pascalCount++;
    else if (/^[a-z][a-z0-9_]*$/.test(name)) snakeCount++;
  }
  const total = camelCount + pascalCount + snakeCount;
  if (total === 0) return insights;
  const conventions = [
    { name: "camelCase", count: camelCount },
    { name: "PascalCase", count: pascalCount },
    { name: "snake_case", count: snakeCount }
  ].filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
  if (conventions.length > 1) {
    const minority = conventions.slice(1).filter((c) => c.count > 2);
    if (minority.length > 0 && conventions[0].count > 0) {
      const dominantRatio = conventions[0].count / total;
      if (dominantRatio > 0.6 && dominantRatio < 0.95) {
        insights.push({
          id: "inconsistent-naming",
          category: "code-quality",
          severity: "info",
          title: `Mixed naming conventions across exports`,
          description: `Exports use multiple naming conventions: ${conventions.map((c) => `${c.name} (${c.count})`).join(", ")}. The dominant convention is ${conventions[0].name}.`,
          affectedFiles: [],
          suggestion: `Consider standardizing on ${conventions[0].name} for consistency across the codebase.`
        });
      }
    }
  }
  return insights;
}
function detectDeepNesting(manifest, maxDepth = 5) {
  const insights = [];
  const deepFiles = manifest.modules.filter((mod) => mod.filePath.split("/").length > maxDepth).map((mod) => mod.filePath);
  if (deepFiles.length > 0) {
    insights.push({
      id: "deep-nesting",
      category: "architecture",
      severity: deepFiles.length > 10 ? "warning" : "info",
      title: `${deepFiles.length} deeply nested file${deepFiles.length > 1 ? "s" : ""}`,
      description: `Found ${deepFiles.length} file${deepFiles.length > 1 ? "s" : ""} nested more than ${maxDepth} directories deep. Deepest: \`${deepFiles[0]}\` (${deepFiles[0].split("/").length} levels).`,
      affectedFiles: deepFiles.slice(0, 10),
      suggestion: "Consider flattening the directory structure to reduce import path complexity."
    });
  }
  return insights;
}
export {
  detectCircularDependencies,
  detectDeepNesting,
  detectGodModules,
  detectInconsistentNaming,
  detectMissingTypes,
  detectOrphanModules,
  detectOversizedModules,
  detectUndocumentedExports,
  runStaticInsights
};
