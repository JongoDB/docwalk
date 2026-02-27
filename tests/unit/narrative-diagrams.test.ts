/**
 * Unit Tests: Narrative Engine & Diagram Generation
 *
 * Tests the exported functions from:
 *   - src/generators/narrative-engine.ts
 *   - src/generators/diagrams.ts
 *
 * Static functions (renderCitations, generateClassDiagram, generateModuleClassDiagram)
 * are tested directly. AI-dependent functions are tested with a mock provider.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { renderCitations } from "../../src/generators/narrative-engine.js";
import {
  generateClassDiagram,
  generateModuleClassDiagram,
  generateSequenceDiagram,
  generateFlowchartDiagram,
} from "../../src/generators/diagrams.js";
import {
  generateOverviewNarrative,
  generateGettingStartedNarrative,
  generateModuleNarrative,
  generateArchitectureNarrative,
} from "../../src/generators/narrative-engine.js";

import type {
  AnalysisManifest,
  ModuleInfo,
  Symbol,
  Citation,
} from "../../src/analysis/types.js";
import type { AIProvider } from "../../src/analysis/providers/base.js";

// ─── Test Helpers ──────────────────────────────────────────────────────────

function makeSymbol(overrides: Partial<Symbol> & { id: string; name: string; kind: Symbol["kind"] }): Symbol {
  return {
    visibility: "public",
    location: { file: "src/test.ts", line: 1, column: 0 },
    exported: true,
    ...overrides,
  };
}

function makeModule(overrides: Partial<ModuleInfo> & { filePath: string }): ModuleInfo {
  return {
    language: "typescript",
    symbols: [],
    imports: [],
    exports: [],
    fileSize: 100,
    lineCount: 10,
    contentHash: "abc123",
    analyzedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeManifest(overrides?: Partial<AnalysisManifest>): AnalysisManifest {
  return {
    docwalkVersion: "0.1.0",
    repo: "test/repo",
    branch: "main",
    commitSha: "abc123",
    analyzedAt: "2026-01-01T00:00:00Z",
    modules: [],
    dependencyGraph: { nodes: [], edges: [] },
    projectMeta: {
      name: "test-project",
      languages: [{ name: "TypeScript", fileCount: 1, percentage: 100 }],
      entryPoints: ["src/index.ts"],
      packageManager: "npm",
    },
    stats: {
      totalFiles: 1,
      totalSymbols: 1,
      totalLines: 100,
      byLanguage: {},
      byKind: {} as any,
      analysisTime: 50,
      skippedFiles: 0,
    },
    ...overrides,
  };
}

function createMockProvider(): AIProvider & {
  generate: ReturnType<typeof vi.fn>;
  summarizeModule: ReturnType<typeof vi.fn>;
  summarizeSymbol: ReturnType<typeof vi.fn>;
} {
  return {
    name: "Mock",
    generate: vi.fn().mockResolvedValue(
      "This project uses [src/index.ts:42] as its entry point and [src/engine.ts:10] for processing."
    ),
    summarizeModule: vi.fn().mockResolvedValue("mock module summary"),
    summarizeSymbol: vi.fn().mockResolvedValue("mock symbol summary"),
  };
}

const mockReadFile = vi.fn().mockResolvedValue("// mock file content\nexport function hello() {}\n");

// ─── renderCitations ───────────────────────────────────────────────────────

describe("renderCitations", () => {
  it("replaces citations with GitHub blob URLs when repoUrl is provided", () => {
    const prose = "See the entry point at [src/index.ts:42] for details.";
    const citations: Citation[] = [
      { text: "[src/index.ts:42]", filePath: "src/index.ts", line: 42 },
    ];

    const result = renderCitations(prose, citations, "owner/repo");

    expect(result).toBe(
      "See the entry point at [src/index.ts:42](https://github.com/owner/repo/blob/main/src/index.ts#L42) for details."
    );
  });

  it("replaces citations with local api/ links when no repoUrl is provided", () => {
    const prose = "Check [src/utils/helpers.ts:15] for the implementation.";
    const citations: Citation[] = [
      { text: "[src/utils/helpers.ts:15]", filePath: "src/utils/helpers.ts", line: 15 },
    ];

    const result = renderCitations(prose, citations);

    expect(result).toBe(
      "Check [src/utils/helpers.ts:15](api/src/utils/helpers.md) for the implementation."
    );
  });

  it("uses a custom branch name when provided", () => {
    const prose = "See [src/main.ts:1] for details.";
    const citations: Citation[] = [
      { text: "[src/main.ts:1]", filePath: "src/main.ts", line: 1 },
    ];

    const result = renderCitations(prose, citations, "owner/repo", "develop");

    expect(result).toBe(
      "See [src/main.ts:1](https://github.com/owner/repo/blob/develop/src/main.ts#L1) for details."
    );
  });

  it("handles multiple citations in the same prose", () => {
    const prose = "The engine [src/engine.ts:10] calls the parser [src/parser.ts:25] and the formatter [src/format.ts:5].";
    const citations: Citation[] = [
      { text: "[src/engine.ts:10]", filePath: "src/engine.ts", line: 10 },
      { text: "[src/parser.ts:25]", filePath: "src/parser.ts", line: 25 },
      { text: "[src/format.ts:5]", filePath: "src/format.ts", line: 5 },
    ];

    const result = renderCitations(prose, citations, "my-org/my-repo");

    expect(result).toContain("[src/engine.ts:10](https://github.com/my-org/my-repo/blob/main/src/engine.ts#L10)");
    expect(result).toContain("[src/parser.ts:25](https://github.com/my-org/my-repo/blob/main/src/parser.ts#L25)");
    expect(result).toContain("[src/format.ts:5](https://github.com/my-org/my-repo/blob/main/src/format.ts#L5)");
  });

  it("returns prose unchanged when there are no citations", () => {
    const prose = "This is some text without any citations.";
    const citations: Citation[] = [];

    const result = renderCitations(prose, citations, "owner/repo");

    expect(result).toBe(prose);
  });

  it("returns prose unchanged when citations array is empty and no repoUrl", () => {
    const prose = "No citations here.";
    const result = renderCitations(prose, []);
    expect(result).toBe(prose);
  });

  it("strips the file extension for local api links", () => {
    const prose = "See [lib/core.js:99] for details.";
    const citations: Citation[] = [
      { text: "[lib/core.js:99]", filePath: "lib/core.js", line: 99 },
    ];

    const result = renderCitations(prose, citations);

    // The local link href should use .md instead of .js
    expect(result).toContain("api/lib/core.md");
    // The href portion should not contain the original extension
    expect(result).toContain("(api/lib/core.md)");
  });

  it("defaults to main branch when branch is not specified but repoUrl is", () => {
    const prose = "See [src/app.ts:7].";
    const citations: Citation[] = [
      { text: "[src/app.ts:7]", filePath: "src/app.ts", line: 7 },
    ];

    const result = renderCitations(prose, citations, "acme/project");

    expect(result).toContain("/blob/main/");
  });
});

// ─── generateClassDiagram ──────────────────────────────────────────────────

describe("generateClassDiagram", () => {
  it("returns undefined when no class or interface symbols exist", () => {
    const manifest = makeManifest({
      modules: [
        makeModule({
          filePath: "src/utils.ts",
          symbols: [
            makeSymbol({ id: "fn1", name: "helperFn", kind: "function" }),
          ],
        }),
      ],
    });

    const result = generateClassDiagram(manifest);

    expect(result).toBeUndefined();
  });

  it("returns undefined when classes have no extends, implements, or children", () => {
    const manifest = makeManifest({
      modules: [
        makeModule({
          filePath: "src/simple.ts",
          symbols: [
            makeSymbol({
              id: "cls1",
              name: "SimpleClass",
              kind: "class",
              // No extends, implements, or children
            }),
          ],
        }),
      ],
    });

    const result = generateClassDiagram(manifest);

    expect(result).toBeUndefined();
  });

  it("generates classDiagram syntax for classes with extends", () => {
    const manifest = makeManifest({
      modules: [
        makeModule({
          filePath: "src/models.ts",
          symbols: [
            makeSymbol({
              id: "base",
              name: "BaseModel",
              kind: "class",
              extends: "Object",
              children: ["m1"],
            }),
            makeSymbol({
              id: "m1",
              name: "validate",
              kind: "method",
              parentId: "base",
            }),
            makeSymbol({
              id: "user",
              name: "UserModel",
              kind: "class",
              extends: "BaseModel",
              children: ["m2"],
            }),
            makeSymbol({
              id: "m2",
              name: "toJSON",
              kind: "method",
              parentId: "user",
            }),
          ],
        }),
      ],
    });

    const result = generateClassDiagram(manifest);

    expect(result).toBeDefined();
    expect(result).toContain("classDiagram");
    // UserModel extends BaseModel — both are known names
    expect(result).toContain("BaseModel <|-- UserModel");
  });

  it("generates implements relationships with <|.. syntax", () => {
    const manifest = makeManifest({
      modules: [
        makeModule({
          filePath: "src/services.ts",
          symbols: [
            makeSymbol({
              id: "iface",
              name: "Serializable",
              kind: "interface",
              children: ["ifm1"],
            }),
            makeSymbol({
              id: "ifm1",
              name: "serialize",
              kind: "method",
              parentId: "iface",
            }),
            makeSymbol({
              id: "impl",
              name: "JsonSerializer",
              kind: "class",
              implements: ["Serializable"],
              children: ["im1"],
            }),
            makeSymbol({
              id: "im1",
              name: "serialize",
              kind: "method",
              parentId: "impl",
            }),
          ],
        }),
      ],
    });

    const result = generateClassDiagram(manifest);

    expect(result).toBeDefined();
    expect(result).toContain("Serializable <|.. JsonSerializer");
  });

  it("marks interfaces with <<interface>>", () => {
    const manifest = makeManifest({
      modules: [
        makeModule({
          filePath: "src/types.ts",
          symbols: [
            makeSymbol({
              id: "iface1",
              name: "Repository",
              kind: "interface",
              children: ["im1"],
            }),
            makeSymbol({
              id: "im1",
              name: "findById",
              kind: "method",
              parentId: "iface1",
            }),
          ],
        }),
      ],
    });

    const result = generateClassDiagram(manifest);

    expect(result).toBeDefined();
    expect(result).toContain("<<interface>>");
  });

  it("includes class members with visibility markers", () => {
    const manifest = makeManifest({
      modules: [
        makeModule({
          filePath: "src/models.ts",
          symbols: [
            makeSymbol({
              id: "cls1",
              name: "User",
              kind: "class",
              children: ["p1", "p2", "m1"],
            }),
            makeSymbol({
              id: "p1",
              name: "name",
              kind: "property",
              visibility: "public",
              parentId: "cls1",
            }),
            makeSymbol({
              id: "p2",
              name: "password",
              kind: "property",
              visibility: "private",
              parentId: "cls1",
            }),
            makeSymbol({
              id: "m1",
              name: "getName",
              kind: "method",
              visibility: "protected",
              parentId: "cls1",
            }),
          ],
        }),
      ],
    });

    const result = generateClassDiagram(manifest);

    expect(result).toBeDefined();
    // public property -> "+"
    expect(result).toContain("+name");
    // private property -> "-"
    expect(result).toContain("-password");
    // protected method -> "#" with ()
    expect(result).toContain("#getName()");
  });

  it("limits diagram to MAX_DIAGRAM_NODES (30)", () => {
    const symbols: Symbol[] = [];
    for (let i = 0; i < 35; i++) {
      symbols.push(
        makeSymbol({
          id: `cls${i}`,
          name: `Class${i}`,
          kind: "class",
          children: [`child${i}`],
        })
      );
      symbols.push(
        makeSymbol({
          id: `child${i}`,
          name: `method${i}`,
          kind: "method",
          parentId: `cls${i}`,
        })
      );
    }

    const manifest = makeManifest({
      modules: [
        makeModule({
          filePath: "src/big.ts",
          symbols,
        }),
      ],
    });

    const result = generateClassDiagram(manifest);

    expect(result).toBeDefined();
    // Class30 through Class34 should not appear (index 30-34 are beyond the limit)
    expect(result).toContain("Class0");
    expect(result).toContain("Class29");
    expect(result).not.toContain("Class30");
  });

  it("only includes relationships between known (included) classes", () => {
    // BaseClass is not exported or has no children/extends/implements, so it won't be in classSymbols
    // ChildClass extends BaseClass, but if BaseClass isn't in knownNames, the relationship is skipped
    const manifest = makeManifest({
      modules: [
        makeModule({
          filePath: "src/a.ts",
          symbols: [
            makeSymbol({
              id: "base",
              name: "ExternalBase",
              kind: "class",
              exported: false, // NOT exported, so won't be included
            }),
            makeSymbol({
              id: "child",
              name: "ChildClass",
              kind: "class",
              extends: "ExternalBase",
              children: ["cm1"],
            }),
            makeSymbol({
              id: "cm1",
              name: "doWork",
              kind: "method",
              parentId: "child",
            }),
          ],
        }),
      ],
    });

    const result = generateClassDiagram(manifest);

    expect(result).toBeDefined();
    // ExternalBase is not in knownNames, so the inheritance line should NOT appear
    expect(result).not.toContain("ExternalBase <|-- ChildClass");
    // ChildClass itself should still appear (it's exported with children)
    expect(result).toContain("ChildClass");
  });

  it("does not include non-exported symbols", () => {
    const manifest = makeManifest({
      modules: [
        makeModule({
          filePath: "src/internal.ts",
          symbols: [
            makeSymbol({
              id: "cls1",
              name: "InternalClass",
              kind: "class",
              exported: false,
              children: ["m1"],
            }),
            makeSymbol({
              id: "m1",
              name: "doStuff",
              kind: "method",
              parentId: "cls1",
              exported: false,
            }),
          ],
        }),
      ],
    });

    const result = generateClassDiagram(manifest);

    // Non-exported symbols should be excluded, resulting in undefined
    expect(result).toBeUndefined();
  });

  it("handles symbols spread across multiple modules", () => {
    const manifest = makeManifest({
      modules: [
        makeModule({
          filePath: "src/base.ts",
          symbols: [
            makeSymbol({
              id: "iface",
              name: "Handler",
              kind: "interface",
              children: ["hm1"],
            }),
            makeSymbol({
              id: "hm1",
              name: "handle",
              kind: "method",
              parentId: "iface",
            }),
          ],
        }),
        makeModule({
          filePath: "src/impl.ts",
          symbols: [
            makeSymbol({
              id: "impl",
              name: "RequestHandler",
              kind: "class",
              implements: ["Handler"],
              children: ["rm1"],
            }),
            makeSymbol({
              id: "rm1",
              name: "handle",
              kind: "method",
              parentId: "impl",
            }),
          ],
        }),
      ],
    });

    const result = generateClassDiagram(manifest);

    expect(result).toBeDefined();
    expect(result).toContain("<<interface>>");
    expect(result).toContain("Handler <|.. RequestHandler");
  });
});

// ─── generateModuleClassDiagram ────────────────────────────────────────────

describe("generateModuleClassDiagram", () => {
  it("returns undefined for modules with no classes or interfaces", () => {
    const mod = makeModule({
      filePath: "src/utils.ts",
      symbols: [
        makeSymbol({ id: "fn1", name: "helper", kind: "function" }),
        makeSymbol({ id: "c1", name: "MAX_SIZE", kind: "constant" }),
      ],
    });

    const result = generateModuleClassDiagram(mod);

    expect(result).toBeUndefined();
  });

  it("generates diagram for a single class with members", () => {
    const mod = makeModule({
      filePath: "src/service.ts",
      symbols: [
        makeSymbol({
          id: "cls1",
          name: "UserService",
          kind: "class",
        }),
        makeSymbol({
          id: "m1",
          name: "findUser",
          kind: "method",
          visibility: "public",
          parentId: "cls1",
        }),
        makeSymbol({
          id: "p1",
          name: "db",
          kind: "property",
          visibility: "private",
          parentId: "cls1",
        }),
      ],
    });

    const result = generateModuleClassDiagram(mod);

    expect(result).toBeDefined();
    expect(result).toContain("classDiagram");
    expect(result).toContain("+findUser()");
    expect(result).toContain("-db");
  });

  it("includes method parameters in diagram", () => {
    const mod = makeModule({
      filePath: "src/api.ts",
      symbols: [
        makeSymbol({
          id: "cls1",
          name: "ApiClient",
          kind: "class",
        }),
        makeSymbol({
          id: "m1",
          name: "request",
          kind: "method",
          visibility: "public",
          parentId: "cls1",
          parameters: [
            { name: "url", type: "string", optional: false, rest: false },
            { name: "options", type: "RequestOptions", optional: true, rest: false },
          ],
        }),
      ],
    });

    const result = generateModuleClassDiagram(mod);

    expect(result).toBeDefined();
    expect(result).toContain("+request(url, options)");
  });

  it("shows inheritance relationships", () => {
    const mod = makeModule({
      filePath: "src/hierarchy.ts",
      symbols: [
        makeSymbol({
          id: "base",
          name: "Animal",
          kind: "class",
        }),
        makeSymbol({
          id: "child",
          name: "Dog",
          kind: "class",
          extends: "Animal",
        }),
      ],
    });

    const result = generateModuleClassDiagram(mod);

    expect(result).toBeDefined();
    expect(result).toContain("Animal <|-- Dog");
  });

  it("shows implementation relationships", () => {
    const mod = makeModule({
      filePath: "src/patterns.ts",
      symbols: [
        makeSymbol({
          id: "iface",
          name: "Disposable",
          kind: "interface",
        }),
        makeSymbol({
          id: "impl",
          name: "Resource",
          kind: "class",
          implements: ["Disposable"],
        }),
      ],
    });

    const result = generateModuleClassDiagram(mod);

    expect(result).toBeDefined();
    expect(result).toContain("<<interface>>");
    expect(result).toContain("Disposable <|.. Resource");
  });

  it("marks interfaces with <<interface>> annotation", () => {
    const mod = makeModule({
      filePath: "src/contracts.ts",
      symbols: [
        makeSymbol({
          id: "iface1",
          name: "Logger",
          kind: "interface",
        }),
      ],
    });

    const result = generateModuleClassDiagram(mod);

    expect(result).toBeDefined();
    expect(result).toContain("class Logger {\n    <<interface>>\n  }");
  });

  it("handles a class with both extends and implements", () => {
    const mod = makeModule({
      filePath: "src/combo.ts",
      symbols: [
        makeSymbol({
          id: "base",
          name: "BaseComponent",
          kind: "class",
        }),
        makeSymbol({
          id: "iface",
          name: "Renderable",
          kind: "interface",
        }),
        makeSymbol({
          id: "impl",
          name: "Widget",
          kind: "class",
          extends: "BaseComponent",
          implements: ["Renderable"],
        }),
      ],
    });

    const result = generateModuleClassDiagram(mod);

    expect(result).toBeDefined();
    expect(result).toContain("BaseComponent <|-- Widget");
    expect(result).toContain("Renderable <|.. Widget");
  });

  it("limits children to at most 10 per class", () => {
    const children: Symbol[] = [];
    for (let i = 0; i < 15; i++) {
      children.push(
        makeSymbol({
          id: `m${i}`,
          name: `method${i}`,
          kind: "method",
          parentId: "cls1",
        })
      );
    }

    const mod = makeModule({
      filePath: "src/large.ts",
      symbols: [
        makeSymbol({
          id: "cls1",
          name: "LargeClass",
          kind: "class",
        }),
        ...children,
      ],
    });

    const result = generateModuleClassDiagram(mod);

    expect(result).toBeDefined();
    // Should include method0-method9 but not method10+
    expect(result).toContain("method9");
    expect(result).not.toContain("method10");
  });

  it("sanitizes special characters in class names for Mermaid IDs", () => {
    const mod = makeModule({
      filePath: "src/generic.ts",
      symbols: [
        makeSymbol({
          id: "cls1",
          name: "Map<string,number>",
          kind: "class",
        }),
        makeSymbol({
          id: "m1",
          name: "get",
          kind: "method",
          parentId: "cls1",
        }),
      ],
    });

    const result = generateModuleClassDiagram(mod);

    expect(result).toBeDefined();
    // Special chars should be replaced with underscores
    expect(result).toContain("Map_string_number_");
    // Angle brackets and commas should not appear as raw chars in the ID
    expect(result).not.toMatch(/class\s+Map</);
  });
});

// ─── AI Narrative Functions (mocked provider) ──────────────────────────────

describe("generateOverviewNarrative", () => {
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    mockProvider = createMockProvider();
    mockReadFile.mockClear();
  });

  it("calls provider.generate and returns prose, citations, and suggestedDiagrams", async () => {
    const manifest = makeManifest({
      modules: [
        makeModule({
          filePath: "src/index.ts",
          symbols: [makeSymbol({ id: "main", name: "main", kind: "function" })],
        }),
      ],
    });

    const result = await generateOverviewNarrative({
      provider: mockProvider,
      manifest,
      readFile: mockReadFile,
    });

    expect(mockProvider.generate).toHaveBeenCalledOnce();
    expect(result.prose).toContain("[src/index.ts:42]");
    expect(result.citations).toHaveLength(2);
    expect(result.citations[0]).toEqual({
      text: "[src/index.ts:42]",
      filePath: "src/index.ts",
      line: 42,
    });
    expect(result.citations[1]).toEqual({
      text: "[src/engine.ts:10]",
      filePath: "src/engine.ts",
      line: 10,
    });
    expect(result.suggestedDiagrams).toEqual([]);
  });

  it("passes the project name and languages in the prompt", async () => {
    const manifest = makeManifest({
      modules: [
        makeModule({ filePath: "src/index.ts", symbols: [] }),
      ],
    });

    await generateOverviewNarrative({
      provider: mockProvider,
      manifest,
      readFile: mockReadFile,
    });

    const prompt = mockProvider.generate.mock.calls[0][0] as string;
    expect(prompt).toContain("PROJECT: test-project");
    expect(prompt).toContain("TypeScript (100%)");
  });

  it("extracts diagram suggestions when provider returns mermaid blocks", async () => {
    mockProvider.generate.mockResolvedValue(
      "Here is the architecture:\n\n```mermaid\nclassDiagram\n  A <|-- B\n```\n\nAnd a flow:\n\n```mermaid\nflowchart TD\n  A --> B\n```"
    );

    const manifest = makeManifest({
      modules: [makeModule({ filePath: "src/index.ts", symbols: [] })],
    });

    const result = await generateOverviewNarrative({
      provider: mockProvider,
      manifest,
      readFile: mockReadFile,
    });

    expect(result.suggestedDiagrams).toHaveLength(2);
    expect(result.suggestedDiagrams[0].type).toBe("class");
    expect(result.suggestedDiagrams[0].mermaidCode).toContain("classDiagram");
    expect(result.suggestedDiagrams[1].type).toBe("flowchart");
    expect(result.suggestedDiagrams[1].mermaidCode).toContain("flowchart TD");
  });

  it("extracts sequence diagram suggestions", async () => {
    mockProvider.generate.mockResolvedValue(
      "```mermaid\nsequenceDiagram\n  Client->>Server: request\n  Server-->>Client: response\n```"
    );

    const manifest = makeManifest({
      modules: [makeModule({ filePath: "src/index.ts", symbols: [] })],
    });

    const result = await generateOverviewNarrative({
      provider: mockProvider,
      manifest,
      readFile: mockReadFile,
    });

    expect(result.suggestedDiagrams).toHaveLength(1);
    expect(result.suggestedDiagrams[0].type).toBe("sequence");
    expect(result.suggestedDiagrams[0].title).toBe("Sequence Diagram");
  });

  it("passes correct generation options (maxTokens, temperature, systemPrompt)", async () => {
    const manifest = makeManifest({
      modules: [makeModule({ filePath: "src/index.ts", symbols: [] })],
    });

    await generateOverviewNarrative({
      provider: mockProvider,
      manifest,
      readFile: mockReadFile,
    });

    const options = mockProvider.generate.mock.calls[0][1];
    expect(options).toEqual({
      maxTokens: 2048,
      temperature: 0.3,
      systemPrompt: "You are a technical documentation writer. Write clear, precise, developer-focused documentation.",
    });
  });
});

describe("generateGettingStartedNarrative", () => {
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    mockProvider = createMockProvider();
    mockReadFile.mockClear();
    mockReadFile.mockResolvedValue("// index file\nexport const app = {};\n");
  });

  it("calls provider.generate and returns prose and citations", async () => {
    const manifest = makeManifest({
      modules: [
        makeModule({
          filePath: "src/index.ts",
          symbols: [makeSymbol({ id: "app", name: "app", kind: "variable" })],
        }),
      ],
    });

    const result = await generateGettingStartedNarrative({
      provider: mockProvider,
      manifest,
      readFile: mockReadFile,
    });

    expect(mockProvider.generate).toHaveBeenCalledOnce();
    expect(result.prose).toBeDefined();
    expect(result.citations).toHaveLength(2);
    // Getting started always returns empty suggestedDiagrams
    expect(result.suggestedDiagrams).toEqual([]);
  });

  it("filters modules to entry point files (index/main/app)", async () => {
    const manifest = makeManifest({
      modules: [
        makeModule({ filePath: "src/index.ts", symbols: [] }),
        makeModule({ filePath: "src/main.ts", symbols: [] }),
        makeModule({ filePath: "src/app.ts", symbols: [] }),
        makeModule({ filePath: "src/utils/helpers.ts", symbols: [] }),
        makeModule({ filePath: "src/deep/nested/other.ts", symbols: [] }),
      ],
    });

    await generateGettingStartedNarrative({
      provider: mockProvider,
      manifest,
      readFile: mockReadFile,
    });

    // readFile should have been called for entry-point files (index, main, app)
    // but not for non-entry files
    const calledPaths = mockReadFile.mock.calls.map((c: any[]) => c[0]);
    expect(calledPaths).toContain("src/index.ts");
    expect(calledPaths).toContain("src/main.ts");
    expect(calledPaths).toContain("src/app.ts");
    expect(calledPaths).not.toContain("src/utils/helpers.ts");
    expect(calledPaths).not.toContain("src/deep/nested/other.ts");
  });

  it("includes package manager in the prompt", async () => {
    const manifest = makeManifest({
      modules: [makeModule({ filePath: "src/index.ts", symbols: [] })],
    });

    await generateGettingStartedNarrative({
      provider: mockProvider,
      manifest,
      readFile: mockReadFile,
    });

    const prompt = mockProvider.generate.mock.calls[0][0] as string;
    expect(prompt).toContain("PACKAGE MANAGER: npm");
  });
});

describe("generateModuleNarrative", () => {
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    mockProvider = createMockProvider();
    mockReadFile.mockClear();
    mockReadFile.mockResolvedValue("// module file content\n");
  });

  it("calls provider.generate with module-specific prompt", async () => {
    const mod = makeModule({
      filePath: "src/engine.ts",
      language: "typescript",
      symbols: [
        makeSymbol({
          id: "e1",
          name: "Engine",
          kind: "class",
          exported: true,
          signature: "class Engine",
        }),
        makeSymbol({
          id: "e2",
          name: "start",
          kind: "method",
          exported: true,
          signature: "start(): void",
        }),
        makeSymbol({
          id: "e3",
          name: "internalHelper",
          kind: "function",
          exported: false,
        }),
      ],
    });

    const manifest = makeManifest({
      modules: [mod],
    });

    const result = await generateModuleNarrative(mod, {
      provider: mockProvider,
      manifest,
      readFile: mockReadFile,
    });

    expect(mockProvider.generate).toHaveBeenCalledOnce();
    const prompt = mockProvider.generate.mock.calls[0][0] as string;
    expect(prompt).toContain("FILE: src/engine.ts");
    expect(prompt).toContain("LANGUAGE: typescript");
    // Only exported symbols listed
    expect(prompt).toContain("class Engine");
    expect(prompt).toContain("method start");
    // Non-exported symbols should NOT appear in the list
    expect(prompt).not.toContain("internalHelper");

    expect(result.prose).toBeDefined();
    expect(result.citations).toHaveLength(2);
  });

  it("uses maxTokens 1024 for module narratives", async () => {
    const mod = makeModule({ filePath: "src/mod.ts", symbols: [] });
    const manifest = makeManifest({ modules: [mod] });

    await generateModuleNarrative(mod, {
      provider: mockProvider,
      manifest,
      readFile: mockReadFile,
    });

    const options = mockProvider.generate.mock.calls[0][1];
    expect(options.maxTokens).toBe(1024);
  });
});

describe("generateArchitectureNarrative", () => {
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    mockProvider = createMockProvider();
    mockReadFile.mockClear();
    mockReadFile.mockResolvedValue("// architecture source\n");
  });

  it("includes dependency graph info in the prompt", async () => {
    const manifest = makeManifest({
      modules: [
        makeModule({ filePath: "src/a.ts", symbols: [] }),
        makeModule({ filePath: "src/b.ts", symbols: [] }),
        makeModule({ filePath: "src/c.ts", symbols: [] }),
      ],
      dependencyGraph: {
        nodes: ["src/a.ts", "src/b.ts", "src/c.ts"],
        edges: [
          { from: "src/a.ts", to: "src/b.ts", imports: ["foo"], isTypeOnly: false },
          { from: "src/b.ts", to: "src/c.ts", imports: ["bar"], isTypeOnly: false },
          { from: "src/a.ts", to: "src/c.ts", imports: ["baz"], isTypeOnly: false },
        ],
      },
    });

    await generateArchitectureNarrative({
      provider: mockProvider,
      manifest,
      readFile: mockReadFile,
    });

    const prompt = mockProvider.generate.mock.calls[0][0] as string;
    expect(prompt).toContain("MODULES: 3");
    expect(prompt).toContain("DEPENDENCY EDGES: 3");
    expect(prompt).toContain("MOST CONNECTED MODULES:");
    // src/a.ts has 2 outgoing edges, src/c.ts has 2 incoming, src/b.ts has 2 total
    expect(prompt).toContain("src/a.ts");
  });

  it("returns prose, citations, and suggested diagrams", async () => {
    mockProvider.generate.mockResolvedValue(
      "The architecture centers on [src/core.ts:1].\n\n```mermaid\nflowchart TD\n  A --> B\n```"
    );

    const manifest = makeManifest({
      modules: [makeModule({ filePath: "src/core.ts", symbols: [] })],
    });

    const result = await generateArchitectureNarrative({
      provider: mockProvider,
      manifest,
      readFile: mockReadFile,
    });

    expect(result.prose).toContain("[src/core.ts:1]");
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].filePath).toBe("src/core.ts");
    expect(result.suggestedDiagrams).toHaveLength(1);
    expect(result.suggestedDiagrams[0].type).toBe("flowchart");
  });
});

// ─── AI Diagram Functions (mocked provider) ────────────────────────────────

describe("generateSequenceDiagram", () => {
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    mockProvider = createMockProvider();
    mockReadFile.mockClear();
    mockReadFile.mockResolvedValue("// source file\n");
  });

  it("returns a sequence DiagramSuggestion when provider returns valid mermaid", async () => {
    mockProvider.generate.mockResolvedValue(
      "```mermaid\nsequenceDiagram\n  Client->>Server: request\n  Server-->>Client: response\n```"
    );

    const manifest = makeManifest({
      modules: [makeModule({ filePath: "src/api.ts", symbols: [] })],
    });

    const result = await generateSequenceDiagram(
      mockProvider,
      manifest,
      mockReadFile
    );

    expect(result).toBeDefined();
    expect(result!.type).toBe("sequence");
    expect(result!.title).toBe("Sequence Diagram");
    expect(result!.mermaidCode).toContain("sequenceDiagram");
  });

  it("returns undefined when provider returns non-sequence mermaid", async () => {
    mockProvider.generate.mockResolvedValue(
      "classDiagram\n  A <|-- B"
    );

    const manifest = makeManifest({
      modules: [makeModule({ filePath: "src/api.ts", symbols: [] })],
    });

    const result = await generateSequenceDiagram(
      mockProvider,
      manifest,
      mockReadFile
    );

    // The code starts with "classDiagram", not "sequenceDiagram", so it should be undefined
    expect(result).toBeUndefined();
  });

  it("returns undefined when provider throws an error", async () => {
    mockProvider.generate.mockRejectedValue(new Error("API failure"));

    const manifest = makeManifest({
      modules: [makeModule({ filePath: "src/api.ts", symbols: [] })],
    });

    const result = await generateSequenceDiagram(
      mockProvider,
      manifest,
      mockReadFile
    );

    expect(result).toBeUndefined();
  });

  it("uses targetModule filePath in the title when provided", async () => {
    mockProvider.generate.mockResolvedValue(
      "sequenceDiagram\n  A->>B: call"
    );

    const targetModule = makeModule({ filePath: "src/handler.ts", symbols: [] });
    const manifest = makeManifest({ modules: [targetModule] });

    const result = await generateSequenceDiagram(
      mockProvider,
      manifest,
      mockReadFile,
      targetModule
    );

    expect(result).toBeDefined();
    expect(result!.title).toBe("Sequence: src/handler.ts");
  });

  it("extracts mermaid code from a fenced code block", async () => {
    mockProvider.generate.mockResolvedValue(
      "Here is the diagram:\n\n```mermaid\nsequenceDiagram\n  A->>B: hello\n```\n\nDone."
    );

    const manifest = makeManifest({
      modules: [makeModule({ filePath: "src/api.ts", symbols: [] })],
    });

    const result = await generateSequenceDiagram(
      mockProvider,
      manifest,
      mockReadFile
    );

    expect(result).toBeDefined();
    expect(result!.mermaidCode).toBe("sequenceDiagram\n  A->>B: hello");
  });
});

describe("generateFlowchartDiagram", () => {
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    mockProvider = createMockProvider();
    mockReadFile.mockClear();
    mockReadFile.mockResolvedValue("// source file\n");
  });

  it("returns a flowchart DiagramSuggestion when provider returns valid mermaid", async () => {
    mockProvider.generate.mockResolvedValue(
      "flowchart TD\n  A[Start] --> B[Process]\n  B --> C[End]"
    );

    const manifest = makeManifest({
      modules: [makeModule({ filePath: "src/pipeline.ts", symbols: [] })],
    });

    const result = await generateFlowchartDiagram(
      mockProvider,
      manifest,
      mockReadFile
    );

    expect(result).toBeDefined();
    expect(result!.type).toBe("flowchart");
    expect(result!.title).toBe("Processing Flow");
    expect(result!.mermaidCode).toContain("flowchart TD");
  });

  it("accepts graph syntax as flowchart", async () => {
    mockProvider.generate.mockResolvedValue(
      "graph LR\n  A --> B --> C"
    );

    const manifest = makeManifest({
      modules: [makeModule({ filePath: "src/flow.ts", symbols: [] })],
    });

    const result = await generateFlowchartDiagram(
      mockProvider,
      manifest,
      mockReadFile
    );

    expect(result).toBeDefined();
    expect(result!.type).toBe("flowchart");
    expect(result!.mermaidCode).toContain("graph LR");
  });

  it("returns undefined when provider returns invalid content", async () => {
    mockProvider.generate.mockResolvedValue(
      "sequenceDiagram\n  A->>B: call"
    );

    const manifest = makeManifest({
      modules: [makeModule({ filePath: "src/flow.ts", symbols: [] })],
    });

    const result = await generateFlowchartDiagram(
      mockProvider,
      manifest,
      mockReadFile
    );

    // sequenceDiagram is not a flowchart or graph
    expect(result).toBeUndefined();
  });

  it("returns undefined when provider throws an error", async () => {
    mockProvider.generate.mockRejectedValue(new Error("timeout"));

    const manifest = makeManifest({
      modules: [makeModule({ filePath: "src/flow.ts", symbols: [] })],
    });

    const result = await generateFlowchartDiagram(
      mockProvider,
      manifest,
      mockReadFile
    );

    expect(result).toBeUndefined();
  });

  it("uses targetModule filePath in the title when provided", async () => {
    mockProvider.generate.mockResolvedValue(
      "flowchart TD\n  A --> B"
    );

    const targetModule = makeModule({ filePath: "src/pipeline.ts", symbols: [] });
    const manifest = makeManifest({ modules: [targetModule] });

    const result = await generateFlowchartDiagram(
      mockProvider,
      manifest,
      mockReadFile,
      targetModule
    );

    expect(result).toBeDefined();
    expect(result!.title).toBe("Flow: src/pipeline.ts");
  });

  it("extracts mermaid from a fenced code block wrapper", async () => {
    mockProvider.generate.mockResolvedValue(
      "```\nflowchart LR\n  Input --> Output\n```"
    );

    const manifest = makeManifest({
      modules: [makeModule({ filePath: "src/flow.ts", symbols: [] })],
    });

    const result = await generateFlowchartDiagram(
      mockProvider,
      manifest,
      mockReadFile
    );

    expect(result).toBeDefined();
    expect(result!.mermaidCode).toBe("flowchart LR\n  Input --> Output");
  });
});
