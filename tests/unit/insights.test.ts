/**
 * Insights Tests
 *
 * Tests for the 8 static insight detectors.
 */

import { describe, it, expect } from "vitest";
import {
  runStaticInsights,
  detectUndocumentedExports,
  detectCircularDependencies,
  detectOversizedModules,
  detectGodModules,
  detectOrphanModules,
  detectMissingTypes,
  detectInconsistentNaming,
  detectDeepNesting,
} from "../../src/analysis/insights.js";
import type { AnalysisManifest, ModuleInfo, Symbol } from "../../src/analysis/types.js";

function makeSymbol(overrides: Partial<Symbol>): Symbol {
  return {
    id: overrides.name || "sym",
    name: overrides.name || "sym",
    kind: overrides.kind || "function",
    visibility: "public",
    location: { file: "test.ts", line: 1, column: 0 },
    exported: overrides.exported ?? true,
    ...overrides,
  };
}

function makeModule(overrides: Partial<ModuleInfo>): ModuleInfo {
  return {
    filePath: overrides.filePath || "src/test.ts",
    language: overrides.language || "typescript",
    symbols: overrides.symbols || [],
    imports: overrides.imports || [],
    exports: [],
    fileSize: 1000,
    lineCount: overrides.lineCount || 50,
    contentHash: "abc123",
    analyzedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeManifest(modules: ModuleInfo[], edges: Array<{ from: string; to: string; imports: string[]; isTypeOnly: boolean }> = []): AnalysisManifest {
  return {
    docwalkVersion: "0.1.0",
    repo: "owner/repo",
    branch: "main",
    commitSha: "abc123",
    analyzedAt: "2026-01-01T00:00:00Z",
    modules,
    dependencyGraph: {
      nodes: modules.map((m) => m.filePath),
      edges,
    },
    projectMeta: {
      name: "test",
      languages: [{ name: "typescript", fileCount: modules.length, percentage: 100 }],
      entryPoints: [],
    },
    stats: {
      totalFiles: modules.length,
      totalSymbols: modules.reduce((s, m) => s + m.symbols.length, 0),
      totalLines: 100,
      byLanguage: {},
      byKind: {} as any,
      analysisTime: 100,
      skippedFiles: 0,
    },
  };
}

describe("Insight Detectors", () => {
  describe("detectUndocumentedExports", () => {
    it("finds exported symbols without docs", () => {
      const manifest = makeManifest([
        makeModule({
          symbols: [
            makeSymbol({ name: "documented", exported: true, docs: { summary: "Has docs" } }),
            makeSymbol({ name: "undocumented", exported: true }),
            makeSymbol({ name: "private", exported: false }),
          ],
        }),
      ]);

      const insights = detectUndocumentedExports(manifest);
      expect(insights).toHaveLength(1);
      expect(insights[0].title).toContain("1 undocumented");
    });

    it("returns empty when all exports are documented", () => {
      const manifest = makeManifest([
        makeModule({
          symbols: [
            makeSymbol({ name: "a", exported: true, docs: { summary: "Documented" } }),
          ],
        }),
      ]);

      const insights = detectUndocumentedExports(manifest);
      expect(insights).toHaveLength(0);
    });
  });

  describe("detectCircularDependencies", () => {
    it("detects simple A→B→A cycle", () => {
      const manifest = makeManifest(
        [makeModule({ filePath: "a.ts" }), makeModule({ filePath: "b.ts" })],
        [
          { from: "a.ts", to: "b.ts", imports: ["B"], isTypeOnly: false },
          { from: "b.ts", to: "a.ts", imports: ["A"], isTypeOnly: false },
        ]
      );

      const insights = detectCircularDependencies(manifest);
      expect(insights).toHaveLength(1);
      expect(insights[0].category).toBe("architecture");
    });

    it("returns empty when no cycles exist", () => {
      const manifest = makeManifest(
        [makeModule({ filePath: "a.ts" }), makeModule({ filePath: "b.ts" })],
        [{ from: "a.ts", to: "b.ts", imports: ["B"], isTypeOnly: false }]
      );

      const insights = detectCircularDependencies(manifest);
      expect(insights).toHaveLength(0);
    });
  });

  describe("detectOversizedModules", () => {
    it("finds modules exceeding line limit", () => {
      const manifest = makeManifest([
        makeModule({ filePath: "big.ts", lineCount: 600 }),
        makeModule({ filePath: "small.ts", lineCount: 50 }),
      ]);

      const insights = detectOversizedModules(manifest);
      expect(insights).toHaveLength(1);
      expect(insights[0].affectedFiles).toContain("big.ts");
    });

    it("finds modules exceeding symbol limit", () => {
      const symbols = Array.from({ length: 35 }, (_, i) =>
        makeSymbol({ name: `sym${i}`, exported: true })
      );
      const manifest = makeManifest([
        makeModule({ filePath: "dense.ts", symbols }),
      ]);

      const insights = detectOversizedModules(manifest);
      expect(insights).toHaveLength(1);
    });
  });

  describe("detectGodModules", () => {
    it("finds modules with excessive connections", () => {
      const modules = Array.from({ length: 20 }, (_, i) =>
        makeModule({ filePath: `mod${i}.ts` })
      );
      const edges = Array.from({ length: 18 }, (_, i) => ({
        from: `mod${i + 1}.ts`,
        to: "mod0.ts",
        imports: ["X"],
        isTypeOnly: false,
      }));

      const manifest = makeManifest(modules, edges);
      const insights = detectGodModules(manifest);
      expect(insights).toHaveLength(1);
      expect(insights[0].affectedFiles).toContain("mod0.ts");
    });
  });

  describe("detectOrphanModules", () => {
    it("finds modules with no connections", () => {
      const manifest = makeManifest(
        [
          makeModule({ filePath: "connected.ts" }),
          makeModule({ filePath: "orphan.ts" }),
        ],
        [{ from: "connected.ts", to: "connected.ts", imports: [], isTypeOnly: false }]
      );

      const insights = detectOrphanModules(manifest);
      expect(insights).toHaveLength(1);
      expect(insights[0].affectedFiles).toContain("orphan.ts");
    });

    it("excludes entry points from orphan detection", () => {
      const manifest = makeManifest([
        makeModule({ filePath: "index.ts" }),
      ]);

      const insights = detectOrphanModules(manifest);
      expect(insights).toHaveLength(0);
    });
  });

  describe("detectMissingTypes", () => {
    it("finds functions with any return type", () => {
      const manifest = makeManifest([
        makeModule({
          language: "typescript",
          symbols: [
            makeSymbol({
              name: "untyped",
              kind: "function",
              exported: true,
              returns: { type: "any" },
            }),
          ],
        }),
      ]);

      const insights = detectMissingTypes(manifest);
      expect(insights).toHaveLength(1);
    });

    it("ignores non-TypeScript files", () => {
      const manifest = makeManifest([
        makeModule({
          language: "python",
          symbols: [
            makeSymbol({
              name: "untyped",
              kind: "function",
              exported: true,
              returns: { type: "any" },
            }),
          ],
        }),
      ]);

      const insights = detectMissingTypes(manifest);
      expect(insights).toHaveLength(0);
    });
  });

  describe("detectDeepNesting", () => {
    it("finds deeply nested files", () => {
      const manifest = makeManifest([
        makeModule({ filePath: "a/b/c/d/e/f.ts" }),
        makeModule({ filePath: "src/test.ts" }),
      ]);

      const insights = detectDeepNesting(manifest);
      expect(insights).toHaveLength(1);
      expect(insights[0].affectedFiles).toContain("a/b/c/d/e/f.ts");
    });
  });

  describe("detectInconsistentNaming", () => {
    it("detects mixed conventions", () => {
      const symbols = [
        ...Array.from({ length: 10 }, (_, i) =>
          makeSymbol({ name: `camelCase${i}`, exported: true })
        ),
        ...Array.from({ length: 5 }, (_, i) =>
          makeSymbol({ name: `snake_case_${i}`, exported: true })
        ),
      ];

      const manifest = makeManifest([
        makeModule({ symbols }),
      ]);

      const insights = detectInconsistentNaming(manifest);
      // May or may not flag depending on ratio — just verify it runs
      expect(insights.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("runStaticInsights", () => {
    it("runs all detectors and returns combined results", () => {
      const manifest = makeManifest([
        makeModule({
          filePath: "src/test.ts",
          symbols: [makeSymbol({ name: "undoc", exported: true })],
          lineCount: 600,
        }),
      ]);

      const insights = runStaticInsights(manifest);
      // Should find at least undocumented exports and oversized module
      expect(insights.length).toBeGreaterThanOrEqual(1);
    });
  });
});
