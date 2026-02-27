import { describe, it, expect } from "vitest";
import {
  extractUserContent,
  type UserContentSignals,
  type CLICommand,
  type Route,
  type ConfigOption,
  type ErrorType,
  type ComponentInfo,
} from "../../src/generators/user-content-extractor.js";
import type {
  AnalysisManifest,
  ModuleInfo,
  Symbol,
  SymbolKind,
  Visibility,
} from "../../src/analysis/types.js";

// ---------------------------------------------------------------------------
// Helpers to build mock objects
// ---------------------------------------------------------------------------

function makeSymbol(overrides: Partial<Symbol> & { id: string; name: string; kind: SymbolKind }): Symbol {
  return {
    visibility: "public" as Visibility,
    location: { file: "test.ts", line: 1, column: 0 },
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
    fileSize: 0,
    lineCount: 0,
    contentHash: "",
    analyzedAt: "",
    ...overrides,
  };
}

function makeManifest(modules: ModuleInfo[]): AnalysisManifest {
  return {
    docwalkVersion: "0.1.0",
    repo: "test/repo",
    branch: "main",
    commitSha: "abc123",
    analyzedAt: "",
    modules,
    dependencyGraph: { nodes: [], edges: [] },
    projectMeta: {
      name: "test",
      languages: [],
      entryPoints: [],
      repository: "",
    },
    stats: {
      totalFiles: 0,
      totalSymbols: 0,
      totalLines: 0,
      byLanguage: {},
      byKind: {} as Record<SymbolKind, number>,
      analysisTime: 0,
      skippedFiles: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("extractUserContent", () => {
  // =========================================================================
  // Edge cases
  // =========================================================================

  describe("edge cases", () => {
    it("returns empty signals for an empty manifest", () => {
      const manifest = makeManifest([]);
      const result = extractUserContent(manifest);

      expect(result.cliCommands).toEqual([]);
      expect(result.routes).toEqual([]);
      expect(result.configOptions).toEqual([]);
      expect(result.errorTypes).toEqual([]);
      expect(result.components).toEqual([]);
      expect(result.readmeContent).toBeUndefined();
    });

    it("returns empty signals for a module with no symbols", () => {
      const mod = makeModule({ filePath: "src/cli/run.ts", symbols: [] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.cliCommands).toEqual([]);
      expect(result.routes).toEqual([]);
      expect(result.configOptions).toEqual([]);
      expect(result.errorTypes).toEqual([]);
      expect(result.components).toEqual([]);
    });

    it("handles a module that matches multiple category checks", () => {
      // A module at cli/config/settings.ts matches CLI and config
      const cmdSymbol = makeSymbol({
        id: "s1",
        name: "configCommand",
        kind: "function",
        exported: true,
        docs: { summary: "Set config" },
      });
      const interfaceSymbol = makeSymbol({
        id: "s2",
        name: "AppSettings",
        kind: "interface",
        exported: true,
      });
      const childSymbol = makeSymbol({
        id: "s3",
        name: "port",
        kind: "property",
        exported: false,
        parentId: "s2",
        typeAnnotation: "number",
      });

      const mod = makeModule({
        filePath: "src/cli/config/settings.ts",
        symbols: [cmdSymbol, interfaceSymbol, childSymbol],
      });
      const result = extractUserContent(makeManifest([mod]));

      // Should appear as a CLI command (path contains cli/)
      expect(result.cliCommands.length).toBeGreaterThanOrEqual(1);
      expect(result.cliCommands.some((c) => c.name === "config")).toBe(true);

      // Should also appear as config options (path contains settings)
      expect(result.configOptions.length).toBeGreaterThanOrEqual(1);
      expect(result.configOptions.some((o) => o.name === "AppSettings.port")).toBe(true);
    });
  });

  // =========================================================================
  // CLI command extraction
  // =========================================================================

  describe("CLI command extraction", () => {
    it("identifies CLI modules from cli/ directory", () => {
      const sym = makeSymbol({
        id: "c1",
        name: "buildCommand",
        kind: "function",
        exported: true,
        docs: { summary: "Build the project" },
        parameters: [
          { name: "target", type: "string", optional: false, rest: false },
          { name: "watch", type: "boolean", optional: true, rest: false },
        ],
      });

      const mod = makeModule({ filePath: "src/cli/build.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.cliCommands).toHaveLength(1);
      expect(result.cliCommands[0]).toEqual({
        name: "build",
        description: "Build the project",
        filePath: "src/cli/build.ts",
        options: ["target", "watch"],
      });
    });

    it("identifies CLI modules from commands/ directory", () => {
      const sym = makeSymbol({
        id: "c2",
        name: "deployCmd",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({ filePath: "src/commands/deploy.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.cliCommands).toHaveLength(1);
      // "deployCmd" contains "cmd" so it matches; the name replacement
      // strips /(?:command|cmd)$/i suffix, yielding "deploy"
      expect(result.cliCommands[0].name).toBe("deploy");
    });

    it("identifies CLI modules from bin/ directory", () => {
      const sym = makeSymbol({
        id: "c3",
        name: "runCommand",
        kind: "variable",
        exported: true,
      });

      const mod = makeModule({ filePath: "bin/docwalk.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.cliCommands).toHaveLength(1);
      expect(result.cliCommands[0].name).toBe("run");
    });

    it("identifies CLI modules from cmd/ directory", () => {
      const sym = makeSymbol({
        id: "c4",
        name: "initCommand",
        kind: "function",
        exported: true,
        docs: { summary: "Initialize project" },
      });

      const mod = makeModule({ filePath: "src/cmd/init.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.cliCommands).toHaveLength(1);
      expect(result.cliCommands[0].name).toBe("init");
      expect(result.cliCommands[0].description).toBe("Initialize project");
    });

    it("detects symbols with 'command' in name (case-insensitive)", () => {
      const sym = makeSymbol({
        id: "c5",
        name: "RegisterBuildCommand",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({ filePath: "src/cli/build.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.cliCommands).toHaveLength(1);
      // The extractor strips "Command" suffix and "Register" prefix
      expect(result.cliCommands[0].name).toBe("Build");
    });

    it("detects symbols with 'cmd' in name", () => {
      const sym = makeSymbol({
        id: "c6",
        name: "syncCmd",
        kind: "constant",
        exported: true,
      });

      const mod = makeModule({ filePath: "src/cli/sync.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.cliCommands).toHaveLength(1);
      expect(result.cliCommands[0].name).toBe("sync");
    });

    it("detects commands from doc summary containing 'command'", () => {
      const sym = makeSymbol({
        id: "c7",
        name: "serve",
        kind: "function",
        exported: true,
        docs: { summary: "The serve command starts a dev server" },
      });

      const mod = makeModule({ filePath: "src/cli/serve.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.cliCommands).toHaveLength(1);
      expect(result.cliCommands[0].name).toBe("serve");
      expect(result.cliCommands[0].description).toBe("The serve command starts a dev server");
    });

    it("falls back to exported functions when no command-named symbols found", () => {
      const sym1 = makeSymbol({
        id: "c8a",
        name: "run",
        kind: "function",
        exported: true,
        docs: { summary: "Run the tool" },
        parameters: [{ name: "config", type: "Config", optional: false, rest: false }],
      });
      const sym2 = makeSymbol({
        id: "c8b",
        name: "help",
        kind: "function",
        exported: true,
      });
      // Non-exported should be excluded from fallback
      const sym3 = makeSymbol({
        id: "c8c",
        name: "internal",
        kind: "function",
        exported: false,
      });

      const mod = makeModule({
        filePath: "src/cli/main.ts",
        symbols: [sym1, sym2, sym3],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.cliCommands).toHaveLength(2);
      expect(result.cliCommands[0]).toEqual({
        name: "run",
        description: "Run the tool",
        filePath: "src/cli/main.ts",
        options: ["config"],
      });
      expect(result.cliCommands[1]).toEqual({
        name: "help",
        description: undefined,
        filePath: "src/cli/main.ts",
        options: undefined,
      });
    });

    it("skips non-exported symbols for command detection", () => {
      const sym = makeSymbol({
        id: "c9",
        name: "buildCommand",
        kind: "function",
        exported: false,
      });

      const mod = makeModule({ filePath: "src/cli/build.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      // Non-exported command is not detected; fallback also finds nothing (no exported functions)
      expect(result.cliCommands).toEqual([]);
    });

    it("only considers function, variable, and constant kinds for commands", () => {
      const classSym = makeSymbol({
        id: "c10",
        name: "BuildCommand",
        kind: "class",
        exported: true,
      });

      const mod = makeModule({ filePath: "src/cli/build.ts", symbols: [classSym] });
      const result = extractUserContent(makeManifest([mod]));

      // Class kind is not checked for command names; fallback only looks for functions
      expect(result.cliCommands).toEqual([]);
    });

    it("extracts parameter names as options", () => {
      const sym = makeSymbol({
        id: "c11",
        name: "deployCommand",
        kind: "function",
        exported: true,
        parameters: [
          { name: "env", type: "string", optional: false, rest: false },
          { name: "dryRun", type: "boolean", optional: true, rest: false },
          { name: "verbose", type: "boolean", optional: true, rest: false },
        ],
      });

      const mod = makeModule({ filePath: "src/cli/deploy.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.cliCommands[0].options).toEqual(["env", "dryRun", "verbose"]);
    });

    it("does not extract CLI commands from non-CLI modules", () => {
      const sym = makeSymbol({
        id: "c12",
        name: "buildCommand",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({ filePath: "src/utils/helpers.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.cliCommands).toEqual([]);
    });
  });

  // =========================================================================
  // Route extraction
  // =========================================================================

  describe("route extraction", () => {
    it("identifies route modules from routes/ directory", () => {
      const sym = makeSymbol({
        id: "r1",
        name: "getUsers",
        kind: "function",
        exported: true,
        docs: { summary: "List all users" },
      });

      const mod = makeModule({ filePath: "src/routes/users.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].method).toBe("GET");
      expect(result.routes[0].description).toBe("List all users");
      expect(result.routes[0].filePath).toBe("src/routes/users.ts");
    });

    it("identifies route modules from controllers/ directory", () => {
      const sym = makeSymbol({
        id: "r2",
        name: "postLogin",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({ filePath: "src/controllers/auth.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].method).toBe("POST");
    });

    it("identifies route modules from handlers/ directory", () => {
      const sym = makeSymbol({
        id: "r3",
        name: "putProfile",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({ filePath: "src/handlers/profile.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].method).toBe("PUT");
    });

    it("identifies route modules from endpoints/ directory", () => {
      const sym = makeSymbol({
        id: "r4",
        name: "deleteUser",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({ filePath: "api/endpoints/users.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].method).toBe("DELETE");
    });

    it("detects GET method from function name", () => {
      const sym = makeSymbol({
        id: "r5",
        name: "getAllItems",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({ filePath: "src/routes/items.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].method).toBe("GET");
    });

    it("detects PATCH method from function name", () => {
      const sym = makeSymbol({
        id: "r6",
        name: "patchSettings",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({ filePath: "src/routes/settings.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].method).toBe("PATCH");
    });

    it("detects HTTP method from decorators", () => {
      const sym = makeSymbol({
        id: "r7",
        name: "createOrder",
        kind: "function",
        exported: true,
        decorators: ["Post('/orders')"],
      });

      const mod = makeModule({ filePath: "src/controllers/orders.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].method).toBe("POST");
    });

    it("constructs path from camelCase function name", () => {
      const sym = makeSymbol({
        id: "r8",
        name: "getUserProfile",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({ filePath: "src/routes/users.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.routes[0].method).toBe("GET");
      // "getUserProfile" -> "userProfile" -> "/user/Profile" -> "/user/profile"
      expect(result.routes[0].path).toBe("/user/profile");
    });

    it("handles function name that is exactly an HTTP method", () => {
      const sym = makeSymbol({
        id: "r9",
        name: "get",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({ filePath: "src/routes/index.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].method).toBe("GET");
      // "get" -> "" -> "" -> "/"
      expect(result.routes[0].path).toBe("/");
    });

    it("does not extract routes from non-route modules", () => {
      const sym = makeSymbol({
        id: "r10",
        name: "getConfig",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({ filePath: "src/utils/helpers.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.routes).toEqual([]);
    });

    it("ignores symbols whose name does not match an HTTP method", () => {
      const sym = makeSymbol({
        id: "r11",
        name: "fetchData",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({ filePath: "src/routes/data.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.routes).toEqual([]);
    });

    it("extracts multiple routes from a single module", () => {
      const sym1 = makeSymbol({ id: "r12a", name: "getUsers", kind: "function", exported: true });
      const sym2 = makeSymbol({ id: "r12b", name: "postUser", kind: "function", exported: true });
      const sym3 = makeSymbol({
        id: "r12c",
        name: "deleteUser",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({
        filePath: "src/routes/users.ts",
        symbols: [sym1, sym2, sym3],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.routes).toHaveLength(3);
      expect(result.routes.map((r) => r.method)).toEqual(["GET", "POST", "DELETE"]);
    });

    it("only matches the first HTTP method for a symbol (breaks after first match)", () => {
      // A symbol named "getPostData" should match "get", not "post"
      const sym = makeSymbol({
        id: "r13",
        name: "getPostData",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({ filePath: "src/routes/data.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].method).toBe("GET");
    });
  });

  // =========================================================================
  // Config option extraction
  // =========================================================================

  describe("config option extraction", () => {
    it("identifies config modules by 'config' in path", () => {
      const parentSym = makeSymbol({
        id: "cfg1",
        name: "AppConfig",
        kind: "interface",
        exported: true,
      });
      const childSym = makeSymbol({
        id: "cfg1a",
        name: "port",
        kind: "property",
        exported: false,
        parentId: "cfg1",
        typeAnnotation: "number",
        docs: { summary: "Server port" },
      });

      const mod = makeModule({
        filePath: "src/config/app.ts",
        symbols: [parentSym, childSym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.configOptions).toHaveLength(1);
      expect(result.configOptions[0]).toEqual({
        name: "AppConfig.port",
        type: "number",
        description: "Server port",
        defaultValue: undefined,
        filePath: "src/config/app.ts",
      });
    });

    it("identifies config modules by 'schema' in path", () => {
      const parentSym = makeSymbol({
        id: "cfg2",
        name: "DbSchema",
        kind: "type",
        exported: true,
      });
      const childSym = makeSymbol({
        id: "cfg2a",
        name: "host",
        kind: "property",
        exported: false,
        parentId: "cfg2",
        typeAnnotation: "string",
      });

      const mod = makeModule({
        filePath: "src/schema/db.ts",
        symbols: [parentSym, childSym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.configOptions).toHaveLength(1);
      expect(result.configOptions[0].name).toBe("DbSchema.host");
    });

    it("identifies config modules by 'settings' in path", () => {
      const parentSym = makeSymbol({
        id: "cfg3",
        name: "ThemeSettings",
        kind: "constant",
        exported: true,
      });
      const childSym = makeSymbol({
        id: "cfg3a",
        name: "darkMode",
        kind: "property",
        exported: false,
        parentId: "cfg3",
        typeAnnotation: "boolean",
      });

      const mod = makeModule({
        filePath: "src/settings/theme.ts",
        symbols: [parentSym, childSym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.configOptions).toHaveLength(1);
      expect(result.configOptions[0].name).toBe("ThemeSettings.darkMode");
    });

    it("extracts config options from exported interfaces with children", () => {
      const parentSym = makeSymbol({
        id: "cfg4",
        name: "ServerConfig",
        kind: "interface",
        exported: true,
      });
      const child1 = makeSymbol({
        id: "cfg4a",
        name: "host",
        kind: "property",
        exported: false,
        parentId: "cfg4",
        typeAnnotation: "string",
        docs: { summary: "Server hostname" },
      });
      const child2 = makeSymbol({
        id: "cfg4b",
        name: "port",
        kind: "property",
        exported: false,
        parentId: "cfg4",
        typeAnnotation: "number",
        docs: { summary: "Server port" },
        parameters: [{ name: "default", type: "number", defaultValue: "3000", optional: true, rest: false }],
      });

      const mod = makeModule({
        filePath: "src/config/server.ts",
        symbols: [parentSym, child1, child2],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.configOptions).toHaveLength(2);
      expect(result.configOptions[0]).toEqual({
        name: "ServerConfig.host",
        type: "string",
        description: "Server hostname",
        defaultValue: undefined,
        filePath: "src/config/server.ts",
      });
      expect(result.configOptions[1]).toEqual({
        name: "ServerConfig.port",
        type: "number",
        description: "Server port",
        defaultValue: "3000",
        filePath: "src/config/server.ts",
      });
    });

    it("extracts config options from exported type aliases with children", () => {
      const parentSym = makeSymbol({
        id: "cfg5",
        name: "CacheOptions",
        kind: "type",
        exported: true,
      });
      const childSym = makeSymbol({
        id: "cfg5a",
        name: "ttl",
        kind: "property",
        exported: false,
        parentId: "cfg5",
        typeAnnotation: "number",
      });

      const mod = makeModule({
        filePath: "src/config/cache.ts",
        symbols: [parentSym, childSym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.configOptions).toHaveLength(1);
      expect(result.configOptions[0].name).toBe("CacheOptions.ttl");
    });

    it("extracts config options from exported constants with children", () => {
      const parentSym = makeSymbol({
        id: "cfg6",
        name: "DEFAULT_CONFIG",
        kind: "constant",
        exported: true,
      });
      const childSym = makeSymbol({
        id: "cfg6a",
        name: "maxRetries",
        kind: "property",
        exported: false,
        parentId: "cfg6",
        typeAnnotation: "number",
      });

      const mod = makeModule({
        filePath: "src/config/defaults.ts",
        symbols: [parentSym, childSym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.configOptions).toHaveLength(1);
      expect(result.configOptions[0].name).toBe("DEFAULT_CONFIG.maxRetries");
    });

    it("falls back to schema-named symbols when no children found", () => {
      const sym = makeSymbol({
        id: "cfg7",
        name: "validationSchema",
        kind: "constant",
        exported: true,
        typeAnnotation: "ZodObject",
        docs: { summary: "Main validation schema" },
      });

      const mod = makeModule({
        filePath: "src/config/validation.ts",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.configOptions).toHaveLength(1);
      expect(result.configOptions[0]).toEqual({
        name: "validationSchema",
        type: "ZodObject",
        description: "Main validation schema",
        filePath: "src/config/validation.ts",
      });
    });

    it("does not fall back to schema-named symbols when children exist", () => {
      const parentSym = makeSymbol({
        id: "cfg8",
        name: "configSchema",
        kind: "interface",
        exported: true,
        docs: { summary: "Config schema" },
      });
      const childSym = makeSymbol({
        id: "cfg8a",
        name: "debug",
        kind: "property",
        exported: false,
        parentId: "cfg8",
        typeAnnotation: "boolean",
      });

      const mod = makeModule({
        filePath: "src/config/main.ts",
        symbols: [parentSym, childSym],
      });
      const result = extractUserContent(makeManifest([mod]));

      // Should only have the child, not the parent as fallback
      expect(result.configOptions).toHaveLength(1);
      expect(result.configOptions[0].name).toBe("configSchema.debug");
    });

    it("ignores non-exported symbols for config extraction", () => {
      const sym = makeSymbol({
        id: "cfg9",
        name: "InternalConfig",
        kind: "interface",
        exported: false,
      });

      const mod = makeModule({
        filePath: "src/config/internal.ts",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.configOptions).toEqual([]);
    });

    it("ignores function/class kinds for config extraction", () => {
      const sym = makeSymbol({
        id: "cfg10",
        name: "getConfigSchema",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({
        filePath: "src/config/loader.ts",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.configOptions).toEqual([]);
    });

    it("does not extract config options from non-config modules", () => {
      const sym = makeSymbol({
        id: "cfg11",
        name: "AppConfig",
        kind: "interface",
        exported: true,
      });

      const mod = makeModule({
        filePath: "src/utils/types.ts",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.configOptions).toEqual([]);
    });
  });

  // =========================================================================
  // Error type extraction
  // =========================================================================

  describe("error type extraction", () => {
    it("finds classes extending Error", () => {
      const sym = makeSymbol({
        id: "e1",
        name: "AppFailure",
        kind: "class",
        exported: true,
        extends: "Error",
        docs: { summary: "Generic application failure" },
      });

      const mod = makeModule({ filePath: "src/errors.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.errorTypes).toHaveLength(1);
      expect(result.errorTypes[0]).toEqual({
        name: "AppFailure",
        description: "Generic application failure",
        filePath: "src/errors.ts",
        extends: "Error",
      });
    });

    it("finds classes extending a class whose name ends in Error", () => {
      const sym = makeSymbol({
        id: "e2",
        name: "DatabaseTimeout",
        kind: "class",
        exported: true,
        extends: "ConnectionError",
      });

      const mod = makeModule({ filePath: "src/db/errors.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.errorTypes).toHaveLength(1);
      expect(result.errorTypes[0].name).toBe("DatabaseTimeout");
      expect(result.errorTypes[0].extends).toBe("ConnectionError");
    });

    it("finds classes with names ending in Error", () => {
      const sym = makeSymbol({
        id: "e3",
        name: "ValidationError",
        kind: "class",
        exported: true,
      });

      const mod = makeModule({ filePath: "src/validation.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.errorTypes).toHaveLength(1);
      expect(result.errorTypes[0].name).toBe("ValidationError");
      expect(result.errorTypes[0].extends).toBeUndefined();
    });

    it("finds classes with names ending in Exception", () => {
      const sym = makeSymbol({
        id: "e4",
        name: "AuthenticationException",
        kind: "class",
        exported: true,
        docs: { summary: "Auth failed" },
      });

      const mod = makeModule({ filePath: "src/auth.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.errorTypes).toHaveLength(1);
      expect(result.errorTypes[0].name).toBe("AuthenticationException");
      expect(result.errorTypes[0].description).toBe("Auth failed");
    });

    it("applies error type extraction globally (not path-filtered)", () => {
      const sym = makeSymbol({
        id: "e5",
        name: "NotFoundError",
        kind: "class",
        exported: true,
        extends: "Error",
      });

      // Module in an arbitrary path (not errors/, not cli/, etc.)
      const mod = makeModule({ filePath: "src/some/random/module.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.errorTypes).toHaveLength(1);
      expect(result.errorTypes[0].name).toBe("NotFoundError");
    });

    it("ignores non-class symbols even if name ends in Error", () => {
      const sym = makeSymbol({
        id: "e6",
        name: "NotFoundError",
        kind: "type",
        exported: true,
      });

      const mod = makeModule({ filePath: "src/types.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.errorTypes).toEqual([]);
    });

    it("does not require the symbol to be exported for error detection", () => {
      // The extractErrorTypes function checks sym.kind === "class" but does NOT check sym.exported
      const sym = makeSymbol({
        id: "e7",
        name: "InternalError",
        kind: "class",
        exported: false,
        extends: "Error",
      });

      const mod = makeModule({ filePath: "src/internal.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.errorTypes).toHaveLength(1);
      expect(result.errorTypes[0].name).toBe("InternalError");
    });

    it("extracts multiple error types from one module", () => {
      const sym1 = makeSymbol({
        id: "e8a",
        name: "BadRequestError",
        kind: "class",
        exported: true,
        extends: "Error",
      });
      const sym2 = makeSymbol({
        id: "e8b",
        name: "ForbiddenError",
        kind: "class",
        exported: true,
        extends: "HttpError",
      });

      const mod = makeModule({
        filePath: "src/errors/http.ts",
        symbols: [sym1, sym2],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.errorTypes).toHaveLength(2);
      expect(result.errorTypes[0].name).toBe("BadRequestError");
      expect(result.errorTypes[1].name).toBe("ForbiddenError");
    });

    it("extracts error types across multiple modules", () => {
      const mod1 = makeModule({
        filePath: "src/errors/db.ts",
        symbols: [
          makeSymbol({ id: "e9a", name: "DbError", kind: "class", exported: true, extends: "Error" }),
        ],
      });
      const mod2 = makeModule({
        filePath: "src/errors/auth.ts",
        symbols: [
          makeSymbol({ id: "e9b", name: "AuthError", kind: "class", exported: true, extends: "Error" }),
        ],
      });

      const result = extractUserContent(makeManifest([mod1, mod2]));

      expect(result.errorTypes).toHaveLength(2);
      expect(result.errorTypes.map((e) => e.name)).toEqual(["DbError", "AuthError"]);
    });

    it("ignores a class that does not match any error criteria", () => {
      const sym = makeSymbol({
        id: "e10",
        name: "UserService",
        kind: "class",
        exported: true,
        extends: "BaseService",
      });

      const mod = makeModule({ filePath: "src/services/user.ts", symbols: [sym] });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.errorTypes).toEqual([]);
    });
  });

  // =========================================================================
  // Component extraction
  // =========================================================================

  describe("component extraction", () => {
    it("identifies component modules from components/ directory", () => {
      const sym = makeSymbol({
        id: "comp1",
        name: "Button",
        kind: "function",
        exported: true,
        docs: { summary: "A clickable button" },
        parameters: [
          { name: "label", type: "string", optional: false, rest: false },
          { name: "onClick", type: "() => void", optional: false, rest: false },
        ],
      });

      const mod = makeModule({
        filePath: "src/components/Button.tsx",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.components).toHaveLength(1);
      expect(result.components[0]).toEqual({
        name: "Button",
        description: "A clickable button",
        filePath: "src/components/Button.tsx",
        props: ["label", "onClick"],
      });
    });

    it("identifies component modules from views/ directory", () => {
      const sym = makeSymbol({
        id: "comp2",
        name: "Dashboard",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({
        filePath: "src/views/Dashboard.tsx",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe("Dashboard");
    });

    it("identifies component modules from widgets/ directory", () => {
      const sym = makeSymbol({
        id: "comp3",
        name: "Calendar",
        kind: "component",
        exported: true,
      });

      const mod = makeModule({
        filePath: "src/widgets/Calendar.tsx",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe("Calendar");
    });

    it("identifies component modules by .tsx extension", () => {
      const sym = makeSymbol({
        id: "comp4",
        name: "Header",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({
        filePath: "src/ui/Header.tsx",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe("Header");
    });

    it("identifies component modules by .jsx extension", () => {
      const sym = makeSymbol({
        id: "comp5",
        name: "Footer",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({
        filePath: "src/ui/Footer.jsx",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe("Footer");
    });

    it("identifies component modules by .vue extension", () => {
      const sym = makeSymbol({
        id: "comp6",
        name: "NavBar",
        kind: "component",
        exported: true,
      });

      const mod = makeModule({
        filePath: "src/components/NavBar.vue",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe("NavBar");
    });

    it("identifies component modules by .svelte extension", () => {
      const sym = makeSymbol({
        id: "comp7",
        name: "Modal",
        kind: "component",
        exported: true,
      });

      const mod = makeModule({
        filePath: "src/components/Modal.svelte",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe("Modal");
    });

    it("only extracts PascalCase named symbols as components", () => {
      const sym1 = makeSymbol({
        id: "comp8a",
        name: "Card",
        kind: "function",
        exported: true,
      });
      const sym2 = makeSymbol({
        id: "comp8b",
        name: "useCard",
        kind: "function",
        exported: true,
      });
      const sym3 = makeSymbol({
        id: "comp8c",
        name: "CARD_SIZES",
        kind: "constant",
        exported: true,
      });

      const mod = makeModule({
        filePath: "src/components/Card.tsx",
        symbols: [sym1, sym2, sym3],
      });
      const result = extractUserContent(makeManifest([mod]));

      // Only "Card" starts with uppercase and is a function/class/component
      // "CARD_SIZES" is a constant (not function/class/component kind)
      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe("Card");
    });

    it("extracts components with kind 'component'", () => {
      const sym = makeSymbol({
        id: "comp9",
        name: "Accordion",
        kind: "component",
        exported: true,
      });

      const mod = makeModule({
        filePath: "src/components/Accordion.tsx",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.components).toHaveLength(1);
    });

    it("extracts components with kind 'class'", () => {
      const sym = makeSymbol({
        id: "comp10",
        name: "DataGrid",
        kind: "class",
        exported: true,
      });

      const mod = makeModule({
        filePath: "src/components/DataGrid.tsx",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe("DataGrid");
    });

    it("extracts props from parameters", () => {
      const sym = makeSymbol({
        id: "comp11",
        name: "Select",
        kind: "function",
        exported: true,
        parameters: [
          { name: "options", type: "Option[]", optional: false, rest: false },
          { name: "value", type: "string", optional: true, rest: false },
          { name: "onChange", type: "(v: string) => void", optional: false, rest: false },
        ],
      });

      const mod = makeModule({
        filePath: "src/components/Select.tsx",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.components[0].props).toEqual(["options", "value", "onChange"]);
    });

    it("ignores non-exported symbols", () => {
      const sym = makeSymbol({
        id: "comp12",
        name: "InternalWidget",
        kind: "function",
        exported: false,
      });

      const mod = makeModule({
        filePath: "src/components/Widget.tsx",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.components).toEqual([]);
    });

    it("ignores lowercase-starting names even if exported", () => {
      const sym = makeSymbol({
        id: "comp13",
        name: "helper",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({
        filePath: "src/components/utils.tsx",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.components).toEqual([]);
    });

    it("does not extract components from non-component modules", () => {
      const sym = makeSymbol({
        id: "comp14",
        name: "UserService",
        kind: "class",
        exported: true,
      });

      const mod = makeModule({
        filePath: "src/services/user.ts",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.components).toEqual([]);
    });

    it("handles component with no parameters (props is undefined)", () => {
      const sym = makeSymbol({
        id: "comp15",
        name: "Spacer",
        kind: "function",
        exported: true,
      });

      const mod = makeModule({
        filePath: "src/components/Spacer.tsx",
        symbols: [sym],
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.components).toHaveLength(1);
      expect(result.components[0].props).toBeUndefined();
    });
  });

  // =========================================================================
  // README content extraction
  // =========================================================================

  describe("README content extraction", () => {
    it("extracts readmeContent from moduleDoc summary", () => {
      const mod = makeModule({
        filePath: "README.md",
        moduleDoc: {
          summary: "DocWalk is a documentation generator",
        },
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.readmeContent).toBe("DocWalk is a documentation generator");
    });

    it("extracts readmeContent from moduleDoc description when no summary", () => {
      const mod = makeModule({
        filePath: "README.md",
        moduleDoc: {
          summary: "",
          description: "A comprehensive documentation tool for codebases",
        },
      });
      const result = extractUserContent(makeManifest([mod]));

      // summary is "" (falsy), so it falls through to description
      expect(result.readmeContent).toBe("A comprehensive documentation tool for codebases");
    });

    it("detects readme in a case-insensitive manner", () => {
      const mod = makeModule({
        filePath: "docs/Readme.md",
        moduleDoc: {
          summary: "Getting started guide",
        },
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.readmeContent).toBe("Getting started guide");
    });

    it("detects readme in subdirectory paths", () => {
      const mod = makeModule({
        filePath: "packages/core/README.md",
        moduleDoc: {
          summary: "Core package docs",
        },
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.readmeContent).toBe("Core package docs");
    });

    it("does not set readmeContent when moduleDoc is missing", () => {
      const mod = makeModule({
        filePath: "README.md",
        // no moduleDoc
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.readmeContent).toBeUndefined();
    });

    it("does not set readmeContent for non-readme files", () => {
      const mod = makeModule({
        filePath: "src/index.ts",
        moduleDoc: {
          summary: "Main entry point",
        },
      });
      const result = extractUserContent(makeManifest([mod]));

      expect(result.readmeContent).toBeUndefined();
    });

    it("last readme module wins when multiple readmes exist", () => {
      const mod1 = makeModule({
        filePath: "README.md",
        moduleDoc: { summary: "Root readme" },
      });
      const mod2 = makeModule({
        filePath: "packages/cli/README.md",
        moduleDoc: { summary: "CLI readme" },
      });

      const result = extractUserContent(makeManifest([mod1, mod2]));

      // The loop processes modules in order, so the last one wins
      expect(result.readmeContent).toBe("CLI readme");
    });
  });

  // =========================================================================
  // Integration-like tests (multiple categories)
  // =========================================================================

  describe("full manifest processing", () => {
    it("processes a realistic manifest with multiple module types", () => {
      const modules: ModuleInfo[] = [
        // CLI module
        makeModule({
          filePath: "src/cli/deploy.ts",
          symbols: [
            makeSymbol({
              id: "int1",
              name: "deployCommand",
              kind: "function",
              exported: true,
              docs: { summary: "Deploy the site" },
              parameters: [
                { name: "target", type: "string", optional: false, rest: false },
              ],
            }),
          ],
        }),
        // Route module
        makeModule({
          filePath: "src/routes/api.ts",
          symbols: [
            makeSymbol({
              id: "int2",
              name: "getStatus",
              kind: "function",
              exported: true,
              docs: { summary: "Health check" },
            }),
            makeSymbol({
              id: "int3",
              name: "postWebhook",
              kind: "function",
              exported: true,
            }),
          ],
        }),
        // Config module
        makeModule({
          filePath: "src/config/schema.ts",
          symbols: [
            makeSymbol({
              id: "int4",
              name: "AppConfig",
              kind: "interface",
              exported: true,
            }),
            makeSymbol({
              id: "int4a",
              name: "debug",
              kind: "property",
              exported: false,
              parentId: "int4",
              typeAnnotation: "boolean",
            }),
          ],
        }),
        // Error types scattered
        makeModule({
          filePath: "src/errors/http.ts",
          symbols: [
            makeSymbol({
              id: "int5",
              name: "HttpError",
              kind: "class",
              exported: true,
              extends: "Error",
            }),
          ],
        }),
        // Component module
        makeModule({
          filePath: "src/components/Alert.tsx",
          symbols: [
            makeSymbol({
              id: "int6",
              name: "Alert",
              kind: "function",
              exported: true,
              parameters: [
                { name: "message", type: "string", optional: false, rest: false },
                { name: "severity", type: "string", optional: true, rest: false },
              ],
            }),
          ],
        }),
        // README
        makeModule({
          filePath: "README.md",
          moduleDoc: { summary: "DocWalk - documentation generator" },
        }),
      ];

      const result = extractUserContent(makeManifest(modules));

      expect(result.cliCommands).toHaveLength(1);
      expect(result.cliCommands[0].name).toBe("deploy");

      expect(result.routes).toHaveLength(2);
      expect(result.routes[0].method).toBe("GET");
      expect(result.routes[1].method).toBe("POST");

      expect(result.configOptions).toHaveLength(1);
      expect(result.configOptions[0].name).toBe("AppConfig.debug");

      expect(result.errorTypes).toHaveLength(1);
      expect(result.errorTypes[0].name).toBe("HttpError");

      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe("Alert");
      expect(result.components[0].props).toEqual(["message", "severity"]);

      expect(result.readmeContent).toBe("DocWalk - documentation generator");
    });

    it("accumulates results from multiple modules of the same category", () => {
      const modules: ModuleInfo[] = [
        makeModule({
          filePath: "src/cli/init.ts",
          symbols: [
            makeSymbol({
              id: "acc1",
              name: "initCommand",
              kind: "function",
              exported: true,
            }),
          ],
        }),
        makeModule({
          filePath: "src/cli/build.ts",
          symbols: [
            makeSymbol({
              id: "acc2",
              name: "buildCommand",
              kind: "function",
              exported: true,
            }),
          ],
        }),
      ];

      const result = extractUserContent(makeManifest(modules));

      expect(result.cliCommands).toHaveLength(2);
      expect(result.cliCommands[0].name).toBe("init");
      expect(result.cliCommands[1].name).toBe("build");
    });
  });
});
