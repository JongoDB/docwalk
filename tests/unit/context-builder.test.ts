import { describe, it, expect, vi } from "vitest";
import { buildContext } from "../../src/analysis/context-builder.js";
import type { ContextChunk, BuildContextOptions } from "../../src/analysis/context-builder.js";
import type {
  AnalysisManifest,
  ModuleInfo,
  DependencyGraph,
  Symbol,
} from "../../src/analysis/types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Create a minimal ModuleInfo with sensible defaults. */
function makeModule(
  filePath: string,
  opts?: { symbols?: Symbol[]; language?: string }
): ModuleInfo {
  return {
    filePath,
    language: opts?.language ?? "typescript",
    symbols: opts?.symbols ?? [],
    imports: [],
    exports: [],
    fileSize: 100,
    lineCount: 10,
    contentHash: "abc123",
    analyzedAt: "2026-01-01T00:00:00Z",
  };
}

/** Create a minimal Symbol with the given name. */
function makeSymbol(name: string): Symbol {
  return {
    id: name,
    name,
    kind: "function",
    visibility: "public",
    location: { file: "test.ts", line: 1, column: 0 },
    exported: true,
  };
}

/** Create a dependency graph from nodes and [from, to] pairs. */
function makeGraph(
  nodes: string[],
  edges: Array<[string, string]>
): DependencyGraph {
  return {
    nodes,
    edges: edges.map(([from, to]) => ({
      from,
      to,
      imports: [],
      isTypeOnly: false,
    })),
  };
}

/** Create a minimal AnalysisManifest. */
function makeManifest(
  modules: ModuleInfo[],
  graph: DependencyGraph
): AnalysisManifest {
  return {
    docwalkVersion: "0.1.0",
    repo: "test/repo",
    branch: "main",
    commitSha: "abc123",
    analyzedAt: "2026-01-01T00:00:00Z",
    modules,
    dependencyGraph: graph,
    projectMeta: {
      name: "test",
      languages: [],
      entryPoints: [],
    },
    stats: {
      totalFiles: modules.length,
      totalSymbols: 0,
      totalLines: 0,
      byLanguage: {},
      byKind: {} as any,
      analysisTime: 0,
      skippedFiles: 0,
    },
  };
}

/**
 * Build a mock readFile that returns predictable content.
 * Content is `filePath` repeated to produce roughly `charCount` characters.
 * Defaults to 80 chars (20 tokens) per file.
 */
function mockReadFile(
  overrides?: Record<string, string>,
  defaultCharCount = 80
) {
  return vi.fn(async (filePath: string): Promise<string> => {
    if (overrides && filePath in overrides) {
      return overrides[filePath];
    }
    // Generate deterministic multi-line content
    const line = `// ${filePath}\n`;
    const repeatCount = Math.max(1, Math.ceil(defaultCharCount / line.length));
    return Array(repeatCount).fill(line).join("");
  });
}

// ─── Target Module Mode ───────────────────────────────────────────────────────

describe("buildContext — target module mode", () => {
  const target = makeModule("src/analysis/engine.ts");
  const directDep = makeModule("src/analysis/types.ts");
  const directDependent = makeModule("src/cli/generate.ts");
  const transitiveDep = makeModule("src/analysis/parsers/index.ts");
  const sameDirMod = makeModule("src/analysis/utils.ts");
  const sameSectionMod = makeModule("lib/parsers/python.ts"); // "parsers" => Analysis section
  const readmeMod = makeModule("README.md");
  const docsMod = makeModule("docs/guide.md");
  const unrelatedMod = makeModule("test/fixtures/sample.ts");

  const modules = [
    target,
    directDep,
    directDependent,
    transitiveDep,
    sameDirMod,
    sameSectionMod,
    readmeMod,
    docsMod,
    unrelatedMod,
  ];

  // engine.ts -> types.ts (direct dep)
  // generate.ts -> engine.ts (engine.ts is a direct dependent)
  // types.ts -> parsers/index.ts (transitive via types.ts)
  const graph = makeGraph(
    modules.map((m) => m.filePath),
    [
      ["src/analysis/engine.ts", "src/analysis/types.ts"],
      ["src/cli/generate.ts", "src/analysis/engine.ts"],
      ["src/analysis/types.ts", "src/analysis/parsers/index.ts"],
    ]
  );

  const manifest = makeManifest(modules, graph);

  it("includes the target module first with score 1.0", async () => {
    const readFile = mockReadFile();
    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].filePath).toBe("src/analysis/engine.ts");
    expect(chunks[0].relevanceScore).toBe(1.0);
    expect(chunks[0].kind).toBe("full-file");
  });

  it("scores direct dependencies at 1.0", async () => {
    const readFile = mockReadFile();
    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    const depChunk = chunks.find(
      (c) => c.filePath === "src/analysis/types.ts"
    );
    expect(depChunk).toBeDefined();
    expect(depChunk!.relevanceScore).toBe(1.0);
  });

  it("scores direct dependents at 1.0", async () => {
    const readFile = mockReadFile();
    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    const chunk = chunks.find((c) => c.filePath === "src/cli/generate.ts");
    expect(chunk).toBeDefined();
    expect(chunk!.relevanceScore).toBe(1.0);
  });

  it("scores 1-hop transitive dependencies at 0.6", async () => {
    const readFile = mockReadFile();
    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    const chunk = chunks.find(
      (c) => c.filePath === "src/analysis/parsers/index.ts"
    );
    expect(chunk).toBeDefined();
    expect(chunk!.relevanceScore).toBe(0.6);
  });

  it("scores same-directory modules at 0.4", async () => {
    const readFile = mockReadFile();
    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    const chunk = chunks.find((c) => c.filePath === "src/analysis/utils.ts");
    expect(chunk).toBeDefined();
    expect(chunk!.relevanceScore).toBe(0.4);
  });

  it("scores same logical section modules at 0.3", async () => {
    const readFile = mockReadFile();
    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    // "lib/parsers/python.ts" has "parsers" in path => Analysis section
    // "src/analysis/engine.ts" has "analysis" in path => Analysis section
    const chunk = chunks.find(
      (c) => c.filePath === "lib/parsers/python.ts"
    );
    expect(chunk).toBeDefined();
    expect(chunk!.relevanceScore).toBe(0.3);
  });

  it("scores README/docs modules at 0.2", async () => {
    const readFile = mockReadFile();
    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    const readmeChunk = chunks.find((c) => c.filePath === "README.md");
    expect(readmeChunk).toBeDefined();
    expect(readmeChunk!.relevanceScore).toBe(0.2);

    const docsChunk = chunks.find((c) => c.filePath === "docs/guide.md");
    expect(docsChunk).toBeDefined();
    expect(docsChunk!.relevanceScore).toBe(0.2);
  });

  it("excludes modules with no relation (score 0)", async () => {
    const readFile = mockReadFile();
    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    const unrelated = chunks.find(
      (c) => c.filePath === "test/fixtures/sample.ts"
    );
    expect(unrelated).toBeUndefined();
  });

  it("returns results sorted by score descending", async () => {
    const readFile = mockReadFile();
    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    // First chunk is the target itself (1.0), then scored modules in descending order
    for (let i = 1; i < chunks.length - 1; i++) {
      expect(chunks[i].relevanceScore).toBeGreaterThanOrEqual(
        chunks[i + 1].relevanceScore
      );
    }
  });

  it("allocates at most 40% of token budget to the target module", async () => {
    // Create content that exceeds 40% of a small budget
    // Budget = 100 tokens => 40% = 40 tokens => 160 chars max
    // Make target file large: 800 chars = 200 tokens
    const largeContent = Array(40)
      .fill("// line of code in engine\n")
      .join("");
    const readFile = mockReadFile({
      "src/analysis/engine.ts": largeContent,
    });

    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 100,
      manifest,
      readFile,
    });

    const targetChunk = chunks.find(
      (c) => c.filePath === "src/analysis/engine.ts"
    );
    expect(targetChunk).toBeDefined();

    const targetTokens = Math.ceil(targetChunk!.content.length / 4);
    // Target should be truncated to fit within 40% of budget
    expect(targetTokens).toBeLessThanOrEqual(100 * 0.4);
  });

  it("includes the target as full-file when it fits within 40% budget", async () => {
    const smallContent = "// small\n";
    const readFile = mockReadFile({
      "src/analysis/engine.ts": smallContent,
    });

    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    const targetChunk = chunks[0];
    expect(targetChunk.content).toBe(smallContent);
    expect(targetChunk.startLine).toBe(1);
    // "// small\n".split("\n") => ["// small", ""] => length 2
    expect(targetChunk.endLine).toBe(2);
  });
});

// ─── Topic Mode ───────────────────────────────────────────────────────────────

describe("buildContext — topic mode", () => {
  const authModule = makeModule("src/services/auth.ts", {
    symbols: [makeSymbol("authenticate"), makeSymbol("verifyToken")],
  });
  const userModule = makeModule("src/models/user.ts", {
    symbols: [makeSymbol("User"), makeSymbol("createUser")],
  });
  const loginComponent = makeModule("src/components/login.tsx", {
    symbols: [makeSymbol("LoginForm"), makeSymbol("useAuth")],
  });
  const readmeModule = makeModule("README.md", {
    symbols: [],
  });
  const unrelatedModule = makeModule("src/utils/math.ts", {
    symbols: [makeSymbol("add"), makeSymbol("multiply")],
  });

  const modules = [
    authModule,
    userModule,
    loginComponent,
    readmeModule,
    unrelatedModule,
  ];
  const graph = makeGraph(
    modules.map((m) => m.filePath),
    []
  );
  const manifest = makeManifest(modules, graph);

  it("scores file paths matching topic keywords at 0.8", async () => {
    const readFile = mockReadFile();
    const chunks = await buildContext({
      topic: "auth",
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    const authChunk = chunks.find(
      (c) => c.filePath === "src/services/auth.ts"
    );
    expect(authChunk).toBeDefined();
    expect(authChunk!.relevanceScore).toBe(0.8);
  });

  it("scores symbol names matching topic at 0.7", async () => {
    const readFile = mockReadFile();
    const chunks = await buildContext({
      topic: "user",
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    // user.ts matches by path => 0.8
    const userChunk = chunks.find(
      (c) => c.filePath === "src/models/user.ts"
    );
    expect(userChunk).toBeDefined();
    expect(userChunk!.relevanceScore).toBe(0.8);

    // createUser symbol in user.ts also matches but path match takes priority (Math.max)
    // login.tsx has useAuth symbol but topic is "user" not "auth"
    // Let's check a pure symbol match case
    const chunks2 = await buildContext({
      topic: "authenticate",
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    // auth.ts matches by path ("auth" is in "authenticate")
    // Actually "authenticate" contains "auth" which is in auth.ts path
    // But loginComponent has useAuth symbol which contains "auth" not "authenticate"
    // Let's verify the auth module matches by path
    const authChunk = chunks2.find(
      (c) => c.filePath === "src/services/auth.ts"
    );
    expect(authChunk).toBeDefined();
    // Path "auth.ts" contains "authenticate"? No — "authenticate" does not appear in "auth.ts"
    // But auth.ts has symbol "authenticate" => symbol match => 0.7
    // And path check: does "src/services/auth.ts" include "authenticate"? No.
    // So score should be 0.7 from symbol name match
    expect(authChunk!.relevanceScore).toBe(0.7);
  });

  it("gives 0.7 to modules where only symbols match (not path)", async () => {
    const readFile = mockReadFile();
    // Use topic "multiply" — only unrelatedModule has that symbol
    const chunks = await buildContext({
      topic: "multiply",
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    const mathChunk = chunks.find(
      (c) => c.filePath === "src/utils/math.ts"
    );
    expect(mathChunk).toBeDefined();
    expect(mathChunk!.relevanceScore).toBe(0.7);
  });

  it("scores README files at 0.5", async () => {
    const readFile = mockReadFile();
    const chunks = await buildContext({
      topic: "auth",
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    const readmeChunk = chunks.find((c) => c.filePath === "README.md");
    expect(readmeChunk).toBeDefined();
    expect(readmeChunk!.relevanceScore).toBe(0.5);
  });

  it("path match (0.8) takes priority over symbol match (0.7) via Math.max", async () => {
    const readFile = mockReadFile();
    // topic "login" matches loginComponent's path and its LoginForm symbol
    const chunks = await buildContext({
      topic: "login",
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    const loginChunk = chunks.find(
      (c) => c.filePath === "src/components/login.tsx"
    );
    expect(loginChunk).toBeDefined();
    // Path "login.tsx" contains "login" => 0.8
    // Symbol "LoginForm" contains "login" => 0.7
    // Math.max(0.8, 0.7) => 0.8
    expect(loginChunk!.relevanceScore).toBe(0.8);
  });

  it("excludes non-matching modules", async () => {
    const readFile = mockReadFile();
    const chunks = await buildContext({
      topic: "auth",
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    // math.ts has no path or symbol match for "auth"
    const mathChunk = chunks.find(
      (c) => c.filePath === "src/utils/math.ts"
    );
    expect(mathChunk).toBeUndefined();
  });

  it("handles multi-word topics", async () => {
    const readFile = mockReadFile();
    const chunks = await buildContext({
      topic: "auth login",
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    // "auth" matches auth.ts path, "login" matches login.tsx path
    const authChunk = chunks.find(
      (c) => c.filePath === "src/services/auth.ts"
    );
    const loginChunk = chunks.find(
      (c) => c.filePath === "src/components/login.tsx"
    );

    expect(authChunk).toBeDefined();
    expect(authChunk!.relevanceScore).toBe(0.8);
    expect(loginChunk).toBeDefined();
    expect(loginChunk!.relevanceScore).toBe(0.8);
  });
});

// ─── No Target / No Topic Mode (Most-Connected) ──────────────────────────────

describe("buildContext — most-connected mode", () => {
  const hubModule = makeModule("src/core/hub.ts");
  const leafModule = makeModule("src/utils/leaf.ts");
  const isolatedModule = makeModule("src/isolated.ts");
  const mediumModule = makeModule("src/services/medium.ts");

  // hub has 5 connections (appears in 5 edges)
  // medium has 3 connections
  // leaf has 1 connection
  // isolated has 0 connections
  const modules = [hubModule, leafModule, isolatedModule, mediumModule];
  const graph = makeGraph(
    modules.map((m) => m.filePath),
    [
      ["src/core/hub.ts", "src/utils/leaf.ts"],
      ["src/core/hub.ts", "src/services/medium.ts"],
      ["src/services/medium.ts", "src/core/hub.ts"],
      ["src/services/medium.ts", "src/utils/leaf.ts"], // medium: from*2 + to*1 = 3 total edges with medium
      // hub: from*2 + to*1 = 3 edge references
      // Actually let's count:
      // hub appears in: edge0.from, edge1.from, edge2.to => 3 connections
      // leaf appears in: edge0.to, edge3.to => 2 connections
      // medium appears in: edge1.to, edge2.from, edge3.from => 3 connections
    ]
  );
  const manifest = makeManifest(modules, graph);

  it("scores modules by connection count / 10", async () => {
    const readFile = mockReadFile();
    const chunks = await buildContext({
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    // hub: 3 connections => 0.3
    // medium: 3 connections => 0.3
    // leaf: 2 connections => 0.2
    const hubChunk = chunks.find((c) => c.filePath === "src/core/hub.ts");
    const leafChunk = chunks.find((c) => c.filePath === "src/utils/leaf.ts");
    const medChunk = chunks.find(
      (c) => c.filePath === "src/services/medium.ts"
    );

    expect(hubChunk).toBeDefined();
    expect(hubChunk!.relevanceScore).toBeCloseTo(0.3);

    expect(medChunk).toBeDefined();
    expect(medChunk!.relevanceScore).toBeCloseTo(0.3);

    expect(leafChunk).toBeDefined();
    expect(leafChunk!.relevanceScore).toBeCloseTo(0.2);
  });

  it("excludes modules with 0 connections", async () => {
    const readFile = mockReadFile();
    const chunks = await buildContext({
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    const isolatedChunk = chunks.find(
      (c) => c.filePath === "src/isolated.ts"
    );
    expect(isolatedChunk).toBeUndefined();
  });

  it("caps score at 1.0 for highly connected modules", async () => {
    // Create a module with 15 edges (score = 15/10 = 1.5, but capped at 1.0)
    const superHub = makeModule("src/super-hub.ts");
    const mods = [superHub, ...Array(15).fill(null).map((_, i) => makeModule(`src/dep${i}.ts`))];
    const edges: Array<[string, string]> = Array(15)
      .fill(null)
      .map((_, i) => ["src/super-hub.ts", `src/dep${i}.ts`] as [string, string]);

    const bigGraph = makeGraph(
      mods.map((m) => m.filePath),
      edges
    );
    const bigManifest = makeManifest(mods, bigGraph);

    const readFile = mockReadFile();
    const chunks = await buildContext({
      tokenBudget: 100000,
      manifest: bigManifest,
      readFile,
    });

    const superChunk = chunks.find(
      (c) => c.filePath === "src/super-hub.ts"
    );
    expect(superChunk).toBeDefined();
    expect(superChunk!.relevanceScore).toBe(1.0);
  });
});

// ─── Token Budget Enforcement ─────────────────────────────────────────────────

describe("buildContext — token budget enforcement", () => {
  it("total tokens do not exceed the budget", async () => {
    const modules = Array(20)
      .fill(null)
      .map((_, i) => makeModule(`src/mod${i}.ts`));
    const edges: Array<[string, string]> = [];
    for (let i = 1; i < 20; i++) {
      edges.push([`src/mod0.ts`, `src/mod${i}.ts`]);
    }
    const graph = makeGraph(
      modules.map((m) => m.filePath),
      edges
    );
    const manifest = makeManifest(modules, graph);

    // Each file ~200 chars = 50 tokens, budget = 200 tokens => can fit ~4 files
    const readFile = mockReadFile({}, 200);
    const chunks = await buildContext({
      tokenBudget: 200,
      manifest,
      readFile,
    });

    const totalTokens = chunks.reduce(
      (sum, c) => sum + Math.ceil(c.content.length / 4),
      0
    );
    expect(totalTokens).toBeLessThanOrEqual(200);
  });

  it("truncates files that are too large to fit fully", async () => {
    const mod = makeModule("src/big.ts");
    const smallMod = makeModule("src/small.ts");
    const modules = [mod, smallMod];
    const graph = makeGraph(
      ["src/big.ts", "src/small.ts"],
      [["src/big.ts", "src/small.ts"]]
    );
    const manifest = makeManifest(modules, graph);

    // big.ts: 60 lines, ~1200 chars = 300 tokens
    const bigContent = Array(60)
      .fill(null)
      .map((_, i) => `// Line ${i + 1} of big.ts`)
      .join("\n");
    const smallContent = "// small\n";

    const readFile = mockReadFile({
      "src/big.ts": bigContent,
      "src/small.ts": smallContent,
    });

    // Budget of 200 tokens, but big.ts is 300 tokens
    // In most-connected mode, big.ts has 1 connection => 0.1, small.ts has 1 => 0.1
    const chunks = await buildContext({
      tokenBudget: 200,
      manifest,
      readFile,
    });

    const bigChunk = chunks.find((c) => c.filePath === "src/big.ts");
    if (bigChunk) {
      const bigTokens = Math.ceil(bigChunk.content.length / 4);
      expect(bigTokens).toBeLessThanOrEqual(200);
      // Should be truncated (fewer lines than original)
      expect(bigChunk.endLine).toBeLessThan(60);
    }
  });

  it("skips files when remaining budget is too small (<= 100 tokens)", async () => {
    const target = makeModule("src/target.ts");
    const dep = makeModule("src/dep.ts");
    const modules = [target, dep];
    const graph = makeGraph(
      ["src/target.ts", "src/dep.ts"],
      [["src/target.ts", "src/dep.ts"]]
    );
    const manifest = makeManifest(modules, graph);

    // Target: 160 chars = 40 tokens (fits in 40% of 120 budget = 48 tokens)
    // Budget left after target: 120 - 40 = 80 tokens
    // dep.ts: 500 chars = 125 tokens (doesn't fit in 80)
    // remaining = 80, which is < 100, so dep should be skipped
    const targetContent = Array(8)
      .fill("// target line\n")
      .join("");
    const depContent = Array(25)
      .fill("// dependency line here\n")
      .join("");

    const readFile = mockReadFile({
      "src/target.ts": targetContent,
      "src/dep.ts": depContent,
    });

    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 120,
      manifest,
      readFile,
    });

    const depChunk = chunks.find((c) => c.filePath === "src/dep.ts");
    // With remaining <= 100 and dep being larger, it should be skipped
    // (remaining is 80, which is <= 100 but the exact behavior depends on
    //  whether remaining > 100 check passes — 80 is NOT > 100, so skip)
    expect(depChunk).toBeUndefined();
  });

  it("requires at least 5 lines for truncated inclusion", async () => {
    const modules = [makeModule("src/a.ts"), makeModule("src/b.ts")];
    const graph = makeGraph(
      ["src/a.ts", "src/b.ts"],
      [["src/a.ts", "src/b.ts"]]
    );
    const manifest = makeManifest(modules, graph);

    // a.ts: short file, 100 chars = 25 tokens
    // b.ts: file with many long lines, truncating to budget would yield < 5 lines
    // 60 chars per line * 100 lines = 6000 chars = 1500 tokens
    const longLines = Array(100)
      .fill(
        "// This is a very long line of code that takes up a lot of characters per line to ensure low lines-per-token ratio"
      )
      .join("\n");

    const readFile = mockReadFile({
      "src/a.ts": "// a\n",
      "src/b.ts": longLines,
    });

    // In most-connected mode, both have 1 connection => 0.1
    // Budget = 150 tokens
    // a.ts uses ~2 tokens, leaving 148
    // b.ts is 1500 tokens, needs truncation
    // maxLines = floor(148 / (1500 / 100)) = floor(148 / 15) = 9
    // 9 > 5 so it would be included in this case
    // Let's use a tighter budget to force < 5 lines
    const chunks = await buildContext({
      tokenBudget: 60,
      manifest,
      readFile,
    });

    // a.ts: ~2 tokens, remaining 58
    // b.ts: 1500 tokens, maxLines = floor(58 / (1500/100)) = floor(58/15) = 3
    // 3 <= 5, so b.ts should be skipped
    const bChunk = chunks.find((c) => c.filePath === "src/b.ts");
    expect(bChunk).toBeUndefined();
  });

  it("target module truncation respects 40% budget", async () => {
    const target = makeModule("src/target.ts");
    const modules = [target];
    const graph = makeGraph(["src/target.ts"], []);
    const manifest = makeManifest(modules, graph);

    // 50 lines of content, each ~20 chars => 1000 chars = 250 tokens
    // Budget = 200 => 40% = 80 tokens = 320 chars
    const content = Array(50)
      .fill(null)
      .map((_, i) => `// line ${String(i + 1).padStart(2, "0")}`)
      .join("\n");

    const readFile = mockReadFile({ "src/target.ts": content });

    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 200,
      manifest,
      readFile,
    });

    expect(chunks.length).toBe(1);
    const targetChunk = chunks[0];
    const targetTokens = Math.ceil(targetChunk.content.length / 4);
    expect(targetTokens).toBeLessThanOrEqual(200 * 0.4);
    expect(targetChunk.endLine).toBeLessThan(50);
    expect(targetChunk.startLine).toBe(1);
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe("buildContext — edge cases", () => {
  it("returns empty array for empty manifest (no modules)", async () => {
    const manifest = makeManifest([], makeGraph([], []));
    const readFile = mockReadFile();

    const chunks = await buildContext({
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    expect(chunks).toEqual([]);
  });

  it("returns empty for empty manifest in target mode", async () => {
    const target = makeModule("src/target.ts");
    const manifest = makeManifest([], makeGraph([], []));
    const readFile = mockReadFile();

    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    // Only the target module itself should be attempted
    expect(chunks.length).toBe(1);
    expect(chunks[0].filePath).toBe("src/target.ts");
  });

  it("handles readFile failures gracefully — skips failed files", async () => {
    const target = makeModule("src/target.ts");
    const dep = makeModule("src/dep.ts");
    const modules = [target, dep];
    const graph = makeGraph(
      ["src/target.ts", "src/dep.ts"],
      [["src/target.ts", "src/dep.ts"]]
    );
    const manifest = makeManifest(modules, graph);

    const readFile = vi.fn(async (filePath: string) => {
      if (filePath === "src/dep.ts") {
        throw new Error("ENOENT: file not found");
      }
      return "// target content\n";
    });

    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    // Target should still be included
    expect(chunks.length).toBe(1);
    expect(chunks[0].filePath).toBe("src/target.ts");

    // dep.ts should not appear (readFile failed)
    const depChunk = chunks.find((c) => c.filePath === "src/dep.ts");
    expect(depChunk).toBeUndefined();
  });

  it("handles readFile failure for target module itself", async () => {
    const target = makeModule("src/target.ts");
    const dep = makeModule("src/dep.ts");
    const modules = [target, dep];
    const graph = makeGraph(
      ["src/target.ts", "src/dep.ts"],
      [["src/target.ts", "src/dep.ts"]]
    );
    const manifest = makeManifest(modules, graph);

    const readFile = vi.fn(async (filePath: string) => {
      if (filePath === "src/target.ts") {
        throw new Error("ENOENT: file not found");
      }
      return "// dep content\n";
    });

    // Should not crash, just skip the target
    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    // Target is skipped, dep should still be included (it's a direct dep)
    expect(chunks.find((c) => c.filePath === "src/target.ts")).toBeUndefined();
    expect(chunks.find((c) => c.filePath === "src/dep.ts")).toBeDefined();
  });

  it("handles empty dependency graph (all modules isolated)", async () => {
    const modules = [
      makeModule("src/a.ts"),
      makeModule("src/b.ts"),
      makeModule("src/c.ts"),
    ];
    const graph = makeGraph(
      modules.map((m) => m.filePath),
      []
    );
    const manifest = makeManifest(modules, graph);
    const readFile = mockReadFile();

    // most-connected mode with no edges => all modules have 0 connections => all excluded
    const chunks = await buildContext({
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    expect(chunks).toEqual([]);
  });

  it("handles empty dependency graph in target module mode", async () => {
    const target = makeModule("src/analysis/target.ts");
    const sameDirMod = makeModule("src/analysis/sibling.ts");
    const otherMod = makeModule("src/other/far.ts");

    const modules = [target, sameDirMod, otherMod];
    const graph = makeGraph(
      modules.map((m) => m.filePath),
      []
    );
    const manifest = makeManifest(modules, graph);
    const readFile = mockReadFile();

    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    // Target is always included
    expect(chunks[0].filePath).toBe("src/analysis/target.ts");

    // Same directory module should get 0.4
    const siblingChunk = chunks.find(
      (c) => c.filePath === "src/analysis/sibling.ts"
    );
    expect(siblingChunk).toBeDefined();
    expect(siblingChunk!.relevanceScore).toBe(0.4);

    // far.ts has no relation => excluded
    const farChunk = chunks.find((c) => c.filePath === "src/other/far.ts");
    expect(farChunk).toBeUndefined();
  });

  it("does not include target module in the scored list (no duplication)", async () => {
    const target = makeModule("src/target.ts");
    const modules = [target];
    const graph = makeGraph(["src/target.ts"], []);
    const manifest = makeManifest(modules, graph);
    const readFile = mockReadFile();

    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    // Target appears only once
    const targetChunks = chunks.filter(
      (c) => c.filePath === "src/target.ts"
    );
    expect(targetChunks.length).toBe(1);
  });

  it("sets correct startLine and endLine for full files", async () => {
    const mod = makeModule("src/a.ts");
    const mod2 = makeModule("src/b.ts");
    const modules = [mod, mod2];
    const graph = makeGraph(
      ["src/a.ts", "src/b.ts"],
      [["src/a.ts", "src/b.ts"]]
    );
    const manifest = makeManifest(modules, graph);

    const content = "line1\nline2\nline3\nline4\nline5\n";
    const readFile = mockReadFile({
      "src/a.ts": content,
      "src/b.ts": content,
    });

    const chunks = await buildContext({
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    for (const chunk of chunks) {
      expect(chunk.startLine).toBe(1);
      // "line1\nline2\nline3\nline4\nline5\n".split("\n") has 6 elements (last is "")
      expect(chunk.endLine).toBe(6);
    }
  });

  it("handles topic mode with no matching modules", async () => {
    const modules = [
      makeModule("src/a.ts", { symbols: [makeSymbol("foo")] }),
      makeModule("src/b.ts", { symbols: [makeSymbol("bar")] }),
    ];
    const graph = makeGraph(
      modules.map((m) => m.filePath),
      []
    );
    const manifest = makeManifest(modules, graph);
    const readFile = mockReadFile();

    const chunks = await buildContext({
      topic: "zzzznonexistent",
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    expect(chunks).toEqual([]);
  });

  it("zero token budget prevents scored modules from being added", async () => {
    const target = makeModule("src/target.ts");
    const dep = makeModule("src/dep.ts");
    const modules = [target, dep];
    const graph = makeGraph(
      ["src/target.ts", "src/dep.ts"],
      [["src/target.ts", "src/dep.ts"]]
    );
    const manifest = makeManifest(modules, graph);
    const readFile = mockReadFile();

    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 0,
      manifest,
      readFile,
    });

    // With 0 budget, target truncation path still runs (truncated to 0 lines)
    // but the scored-module loop exits immediately (usedTokens >= 0)
    // so only the (truncated) target appears
    expect(chunks.length).toBe(1);
    expect(chunks[0].filePath).toBe("src/target.ts");

    // No dependency should be included
    const depChunk = chunks.find((c) => c.filePath === "src/dep.ts");
    expect(depChunk).toBeUndefined();
  });
});

// ─── Transitive Dependency Details ────────────────────────────────────────────

describe("buildContext — transitive dependency scoring", () => {
  it("includes reverse transitive dependencies (dependent's dependents)", async () => {
    // A depends on target, B depends on A => B is 1-hop transitive
    const target = makeModule("src/target.ts");
    const directDependent = makeModule("src/direct.ts");
    const transitiveDependent = makeModule("src/transitive.ts");
    const modules = [target, directDependent, transitiveDependent];

    const graph = makeGraph(
      modules.map((m) => m.filePath),
      [
        ["src/direct.ts", "src/target.ts"], // direct depends on target
        ["src/transitive.ts", "src/direct.ts"], // transitive depends on direct
      ]
    );
    const manifest = makeManifest(modules, graph);
    const readFile = mockReadFile();

    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    const transitiveChunk = chunks.find(
      (c) => c.filePath === "src/transitive.ts"
    );
    expect(transitiveChunk).toBeDefined();
    expect(transitiveChunk!.relevanceScore).toBe(0.6);
  });

  it("does not double-count modules that are both direct and transitive", async () => {
    // A -> target, target -> B, A -> B
    // B is both a direct dep of target and a transitive dep via A
    // Score should be 1.0 (direct), not combined
    const target = makeModule("src/target.ts");
    const modA = makeModule("src/a.ts");
    const modB = makeModule("src/b.ts");
    const modules = [target, modA, modB];

    const graph = makeGraph(
      modules.map((m) => m.filePath),
      [
        ["src/target.ts", "src/b.ts"], // direct dep
        ["src/a.ts", "src/target.ts"], // A depends on target
        ["src/a.ts", "src/b.ts"], // transitive path: A -> B
      ]
    );
    const manifest = makeManifest(modules, graph);
    const readFile = mockReadFile();

    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    // b.ts should appear exactly once with score 1.0 (direct takes priority)
    const bChunks = chunks.filter((c) => c.filePath === "src/b.ts");
    expect(bChunks.length).toBe(1);
    expect(bChunks[0].relevanceScore).toBe(1.0);
  });
});

// ─── Logical Section Detection ────────────────────────────────────────────────

describe("buildContext — logical section detection", () => {
  it("groups modules in 'utils' and 'helpers' directories under same section", async () => {
    const target = makeModule("src/utils/target.ts");
    const helper = makeModule("lib/helpers/format.ts"); // helpers => Utilities
    const modules = [target, helper];
    const graph = makeGraph(
      modules.map((m) => m.filePath),
      []
    );
    const manifest = makeManifest(modules, graph);
    const readFile = mockReadFile();

    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    // Both "utils" and "helpers" map to "Utilities" section
    const helperChunk = chunks.find(
      (c) => c.filePath === "lib/helpers/format.ts"
    );
    expect(helperChunk).toBeDefined();
    expect(helperChunk!.relevanceScore).toBe(0.3);
  });

  it("does not assign section score when target has no section", async () => {
    // Target is at root level, no section keywords
    const target = makeModule("src/main.ts");
    const otherSectionMod = makeModule("src/utils/helper.ts");
    const modules = [target, otherSectionMod];
    const graph = makeGraph(
      modules.map((m) => m.filePath),
      []
    );
    const manifest = makeManifest(modules, graph);
    const readFile = mockReadFile();

    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    // target has no section (detectSection returns "")
    // so same-section check: "" && detectSection(other) === "" => falsy because "" is falsy
    // Therefore otherSectionMod should not get section score
    const helperChunk = chunks.find(
      (c) => c.filePath === "src/utils/helper.ts"
    );
    expect(helperChunk).toBeUndefined();
  });

  it("detects various section keywords correctly", async () => {
    // Target in "components" => Components section
    const target = makeModule("src/components/button.ts");
    const views = makeModule("src/views/dashboard.ts"); // views => Components
    const hooks = makeModule("src/hooks/useAuth.ts"); // hooks => Hooks (different)
    const pages = makeModule("src/pages/home.ts"); // pages => Components
    const modules = [target, views, hooks, pages];
    const graph = makeGraph(
      modules.map((m) => m.filePath),
      []
    );
    const manifest = makeManifest(modules, graph);
    const readFile = mockReadFile();

    const chunks = await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    // views and pages are in Components section like target
    const viewsChunk = chunks.find(
      (c) => c.filePath === "src/views/dashboard.ts"
    );
    expect(viewsChunk).toBeDefined();
    expect(viewsChunk!.relevanceScore).toBe(0.3);

    const pagesChunk = chunks.find((c) => c.filePath === "src/pages/home.ts");
    expect(pagesChunk).toBeDefined();
    expect(pagesChunk!.relevanceScore).toBe(0.3);

    // hooks is in Hooks section, not Components
    const hooksChunk = chunks.find(
      (c) => c.filePath === "src/hooks/useAuth.ts"
    );
    expect(hooksChunk).toBeUndefined();
  });
});

// ─── ReadFile Call Patterns ───────────────────────────────────────────────────

describe("buildContext — readFile call patterns", () => {
  it("calls readFile for each included module", async () => {
    const target = makeModule("src/target.ts");
    const dep = makeModule("src/dep.ts");
    const modules = [target, dep];
    const graph = makeGraph(
      ["src/target.ts", "src/dep.ts"],
      [["src/target.ts", "src/dep.ts"]]
    );
    const manifest = makeManifest(modules, graph);
    const readFile = mockReadFile();

    await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    expect(readFile).toHaveBeenCalledWith("src/target.ts");
    expect(readFile).toHaveBeenCalledWith("src/dep.ts");
  });

  it("does not call readFile for excluded modules", async () => {
    const target = makeModule("src/analysis/target.ts");
    const unrelated = makeModule("test/fixture/unrelated.ts");
    const modules = [target, unrelated];
    const graph = makeGraph(
      modules.map((m) => m.filePath),
      []
    );
    const manifest = makeManifest(modules, graph);
    const readFile = mockReadFile();

    await buildContext({
      targetModule: target,
      tokenBudget: 10000,
      manifest,
      readFile,
    });

    expect(readFile).toHaveBeenCalledWith("src/analysis/target.ts");
    expect(readFile).not.toHaveBeenCalledWith("test/fixture/unrelated.ts");
  });
});
