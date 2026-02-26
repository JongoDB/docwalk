/**
 * New Pages Tests
 *
 * Tests for the 4 new page generators:
 * - Types page
 * - Dependencies page
 * - Configuration page
 * - Usage Guide page
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// We need to test the generators via generateDocs, but since they are
// internal functions, we test them through the main export by examining
// the generated output.

// Mock simple-git to avoid actual git operations
vi.mock("simple-git", () => ({
  default: () => ({
    tags: () => Promise.resolve({ all: [] }),
    log: () => Promise.resolve({ all: [] }),
  }),
}));

// Mock hooks
vi.mock("../../src/utils/hooks.js", () => ({
  executeHooks: vi.fn().mockResolvedValue(undefined),
}));

import { generateDocs } from "../../src/generators/mkdocs.js";
import type { AnalysisManifest, ModuleInfo, Symbol } from "../../src/analysis/types.js";
import type { DocWalkConfig } from "../../src/config/schema.js";
import { readFile, rm, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

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
    language: "typescript",
    symbols: overrides.symbols || [],
    imports: overrides.imports || [],
    exports: [],
    fileSize: 1000,
    lineCount: 50,
    contentHash: "abc123",
    analyzedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeManifest(modules: ModuleInfo[]): AnalysisManifest {
  return {
    docwalkVersion: "0.1.0",
    repo: "owner/repo",
    branch: "main",
    commitSha: "abc123def456",
    analyzedAt: "2026-01-01T00:00:00Z",
    modules,
    dependencyGraph: {
      nodes: modules.map((m) => m.filePath),
      edges: [],
    },
    projectMeta: {
      name: "test-project",
      languages: [{ name: "typescript", fileCount: modules.length, percentage: 100 }],
      entryPoints: ["src/index.ts"],
      repository: "owner/repo",
    },
    stats: {
      totalFiles: modules.length,
      totalSymbols: modules.reduce((sum, m) => sum + m.symbols.length, 0),
      totalLines: modules.reduce((sum, m) => sum + m.lineCount, 0),
      byLanguage: { typescript: { files: modules.length, symbols: 0, lines: 0 } },
      byKind: {} as any,
      analysisTime: 100,
      skippedFiles: 0,
    },
  };
}

function makeConfig(overrides: Partial<DocWalkConfig["analysis"]> = {}): DocWalkConfig {
  return {
    source: { repo: "owner/repo", branch: "main", include: ["src/**"], exclude: [], languages: "auto", provider: "github" },
    analysis: {
      depth: "full",
      ai_summaries: false,
      dependency_graph: true,
      changelog: false,
      changelog_depth: 100,
      config_docs: true,
      types_page: true,
      dependencies_page: true,
      usage_guide_page: true,
      max_file_size: 500000,
      concurrency: 4,
      ...overrides,
    },
    sync: { trigger: "on_push", diff_strategy: "incremental", impact_analysis: true, state_file: ".docwalk/state.json", auto_commit: false, commit_message: "docs: update" },
    deploy: { provider: "gh-pages", auto_ssl: true, output_dir: "site" },
    domain: { base_path: "/", dns_auto: true },
    theme: { preset: "developer", layout: "tabs", palette: "slate", accent: "#5de4c7", features: ["navigation.tabs", "navigation.sections", "navigation.expand", "navigation.top", "search.suggest", "search.highlight", "content.code.copy", "content.tabs.link"] },
    versioning: { enabled: false, source: "tags", tag_pattern: "^v\\d+\\.\\d+\\.\\d+$", default_alias: "latest", max_versions: 10 },
  };
}

const OUTPUT_DIR = path.join("/tmp", "docwalk-test-new-pages");

describe("New Page Generators", () => {
  beforeEach(async () => {
    if (existsSync(OUTPUT_DIR)) {
      await rm(OUTPUT_DIR, { recursive: true });
    }
    await mkdir(OUTPUT_DIR, { recursive: true });
  });

  describe("Types Page", () => {
    it("generates valid markdown with expected sections", async () => {
      const modules = [
        makeModule({
          filePath: "src/models/user.ts",
          symbols: [
            makeSymbol({ name: "User", kind: "interface", exported: true, docs: { summary: "User entity" } }),
            makeSymbol({ name: "Role", kind: "enum", exported: true, docs: { summary: "User roles" } }),
            makeSymbol({ name: "UserConfig", kind: "type", exported: true }),
          ],
        }),
        makeModule({
          filePath: "src/config/schema.ts",
          symbols: [
            makeSymbol({ name: "AppConfig", kind: "interface", exported: true, docs: { summary: "App configuration" } }),
          ],
        }),
      ];

      const manifest = makeManifest(modules);
      const config = makeConfig();

      await generateDocs({ manifest, config, outputDir: OUTPUT_DIR });

      const typesContent = await readFile(path.join(OUTPUT_DIR, "docs", "types.md"), "utf-8");
      expect(typesContent).toContain("# Types & Interfaces");
      expect(typesContent).toContain("User");
      expect(typesContent).toContain("Role");
      expect(typesContent).toContain("UserConfig");
      expect(typesContent).toContain("AppConfig");
      expect(typesContent).toContain("**4** type definitions");
    });

    it("aggregates types from multiple modules", async () => {
      const modules = [
        makeModule({
          filePath: "src/a.ts",
          symbols: [makeSymbol({ name: "TypeA", kind: "type", exported: true })],
        }),
        makeModule({
          filePath: "src/b.ts",
          symbols: [makeSymbol({ name: "TypeB", kind: "interface", exported: true })],
        }),
        makeModule({
          filePath: "src/c.ts",
          symbols: [makeSymbol({ name: "TypeC", kind: "enum", exported: true })],
        }),
      ];

      const manifest = makeManifest(modules);
      const config = makeConfig();

      await generateDocs({ manifest, config, outputDir: OUTPUT_DIR });

      const typesContent = await readFile(path.join(OUTPUT_DIR, "docs", "types.md"), "utf-8");
      expect(typesContent).toContain("TypeA");
      expect(typesContent).toContain("TypeB");
      expect(typesContent).toContain("TypeC");
      expect(typesContent).toContain("**3** type definitions");
    });
  });

  describe("Dependencies Page", () => {
    it("correctly identifies external vs internal imports", async () => {
      const modules = [
        makeModule({
          filePath: "src/app.ts",
          imports: [
            { source: "express", specifiers: [{ name: "Express", isDefault: true, isNamespace: false }], isTypeOnly: false },
            { source: "./utils", specifiers: [{ name: "helper", isDefault: false, isNamespace: false }], isTypeOnly: false },
            { source: "zod", specifiers: [{ name: "z", isDefault: false, isNamespace: false }], isTypeOnly: false },
            { source: "@types/node", specifiers: [], isTypeOnly: true },
          ],
        }),
      ];

      const manifest = makeManifest(modules);
      const config = makeConfig();

      await generateDocs({ manifest, config, outputDir: OUTPUT_DIR });

      const depsContent = await readFile(path.join(OUTPUT_DIR, "docs", "dependencies.md"), "utf-8");
      expect(depsContent).toContain("# Dependencies");
      expect(depsContent).toContain("express");
      expect(depsContent).toContain("zod");
      expect(depsContent).toContain("@types/node");
      // Should NOT include internal import
      expect(depsContent).not.toContain("`./utils`");
    });
  });

  describe("Configuration Page", () => {
    it("generates valid markdown listing config files", async () => {
      const modules = [
        makeModule({
          filePath: "src/config/schema.ts",
          symbols: [
            makeSymbol({ name: "AppSchema", kind: "constant", exported: true, docs: { summary: "Main app schema" } }),
          ],
        }),
        makeModule({
          filePath: "src/services/api.ts",
          symbols: [
            makeSymbol({ name: "fetchData", kind: "function", exported: true }),
          ],
        }),
      ];

      const manifest = makeManifest(modules);
      const config = makeConfig();

      await generateDocs({ manifest, config, outputDir: OUTPUT_DIR });

      const configContent = await readFile(path.join(OUTPUT_DIR, "docs", "configuration.md"), "utf-8");
      expect(configContent).toContain("# Configuration");
      expect(configContent).toContain("schema.ts");
      // api.ts should NOT be listed as a config file
      expect(configContent).not.toContain("api.ts");
    });
  });

  describe("Usage Guide Page", () => {
    it("generates valid markdown with navigation tips", async () => {
      const modules = [makeModule({ filePath: "src/index.ts" })];
      const manifest = makeManifest(modules);
      const config = makeConfig();

      await generateDocs({ manifest, config, outputDir: OUTPUT_DIR });

      const guideContent = await readFile(path.join(OUTPUT_DIR, "docs", "guide.md"), "utf-8");
      expect(guideContent).toContain("# Usage Guide");
      expect(guideContent).toContain("Keyboard Shortcuts");
      expect(guideContent).toContain("Dark / Light Mode");
      expect(guideContent).toContain("Search");
      expect(guideContent).toContain("1 files");
    });
  });

  describe("Config flags", () => {
    it("disables types page when types_page is false", async () => {
      const modules = [
        makeModule({
          filePath: "src/test.ts",
          symbols: [makeSymbol({ name: "MyType", kind: "type", exported: true })],
        }),
      ];
      const manifest = makeManifest(modules);
      const config = makeConfig({ types_page: false });

      await generateDocs({ manifest, config, outputDir: OUTPUT_DIR });

      expect(existsSync(path.join(OUTPUT_DIR, "docs", "types.md"))).toBe(false);
    });

    it("disables dependencies page when dependencies_page is false", async () => {
      const modules = [makeModule({ filePath: "src/test.ts" })];
      const manifest = makeManifest(modules);
      const config = makeConfig({ dependencies_page: false });

      await generateDocs({ manifest, config, outputDir: OUTPUT_DIR });

      expect(existsSync(path.join(OUTPUT_DIR, "docs", "dependencies.md"))).toBe(false);
    });

    it("disables usage guide when usage_guide_page is false", async () => {
      const modules = [makeModule({ filePath: "src/test.ts" })];
      const manifest = makeManifest(modules);
      const config = makeConfig({ usage_guide_page: false });

      await generateDocs({ manifest, config, outputDir: OUTPUT_DIR });

      expect(existsSync(path.join(OUTPUT_DIR, "docs", "guide.md"))).toBe(false);
    });

    it("disables configuration page when config_docs is false", async () => {
      const modules = [makeModule({ filePath: "src/config/schema.ts" })];
      const manifest = makeManifest(modules);
      const config = makeConfig({ config_docs: false });

      await generateDocs({ manifest, config, outputDir: OUTPUT_DIR });

      expect(existsSync(path.join(OUTPUT_DIR, "docs", "configuration.md"))).toBe(false);
    });
  });
});
