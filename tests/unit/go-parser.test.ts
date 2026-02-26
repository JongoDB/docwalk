import { describe, it, expect } from "vitest";
import { GoParser } from "../../src/analysis/parsers/go";

const parser = new GoParser();

describe("GoParser", () => {
  describe("imports", () => {
    it("extracts grouped imports", async () => {
      const result = await parser.parse(
        `package main\n\nimport (\n\t"fmt"\n\t"strings"\n)`,
        "main.go"
      );
      expect(result.imports).toHaveLength(2);
      expect(result.imports[0].source).toBe("fmt");
      expect(result.imports[1].source).toBe("strings");
    });
  });

  describe("functions", () => {
    it("extracts exported function", async () => {
      const result = await parser.parse(
        `package main\n\nfunc NewConfig(port int) *Config {\n\treturn nil\n}`,
        "main.go"
      );
      const fn = result.symbols.find((s) => s.name === "NewConfig");
      expect(fn).toBeDefined();
      expect(fn!.kind).toBe("function");
      expect(fn!.exported).toBe(true);
      expect(fn!.visibility).toBe("public");
    });

    it("marks unexported functions as private", async () => {
      const result = await parser.parse(
        `package main\n\nfunc helper() {}`,
        "main.go"
      );
      expect(result.symbols[0].exported).toBe(false);
      expect(result.symbols[0].visibility).toBe("private");
    });

    it("extracts function parameters", async () => {
      const result = await parser.parse(
        `package main\n\nfunc Add(a int, b int) int {\n\treturn a + b\n}`,
        "main.go"
      );
      expect(result.symbols[0].parameters).toHaveLength(2);
      expect(result.symbols[0].parameters![0].name).toBe("a");
    });

    it("extracts return type", async () => {
      const result = await parser.parse(
        `package main\n\nfunc Create() *Config {\n\treturn nil\n}`,
        "main.go"
      );
      expect(result.symbols[0].returns?.type).toBe("*Config");
    });
  });

  describe("methods", () => {
    it("extracts method with receiver", async () => {
      const result = await parser.parse(
        `package main\n\nfunc (c *Config) String() string {\n\treturn ""\n}`,
        "main.go"
      );
      expect(result.symbols[0].name).toBe("String");
      expect(result.symbols[0].kind).toBe("method");
      expect(result.symbols[0].parentId).toContain("Config");
    });
  });

  describe("type declarations", () => {
    it("extracts struct type", async () => {
      const result = await parser.parse(
        `package main\n\ntype Config struct {\n\tPort int\n\tHost string\n}`,
        "main.go"
      );
      const sym = result.symbols.find((s) => s.name === "Config");
      expect(sym).toBeDefined();
      expect(sym!.kind).toBe("class"); // struct mapped to class
      expect(sym!.exported).toBe(true);
    });

    it("extracts interface type", async () => {
      const result = await parser.parse(
        `package main\n\ntype Handler interface {\n\tHandle() error\n}`,
        "main.go"
      );
      const sym = result.symbols.find((s) => s.name === "Handler");
      expect(sym).toBeDefined();
      expect(sym!.kind).toBe("interface");
    });

    it("extracts type alias", async () => {
      const result = await parser.parse(
        `package main\n\ntype ID = string`,
        "main.go"
      );
      expect(result.symbols[0].name).toBe("ID");
      expect(result.symbols[0].kind).toBe("type");
    });

    it("marks unexported types as private", async () => {
      const result = await parser.parse(
        `package main\n\ntype config struct {}`,
        "main.go"
      );
      expect(result.symbols[0].exported).toBe(false);
    });
  });

  describe("constants and variables", () => {
    it("extracts exported constant", async () => {
      const result = await parser.parse(
        `package main\n\nconst MaxRetries = 3`,
        "main.go"
      );
      expect(result.symbols[0].name).toBe("MaxRetries");
      expect(result.symbols[0].kind).toBe("constant");
      expect(result.symbols[0].exported).toBe(true);
    });

    it("extracts variable declaration", async () => {
      const result = await parser.parse(
        `package main\n\nvar DefaultHost = "localhost"`,
        "main.go"
      );
      expect(result.symbols[0].name).toBe("DefaultHost");
      expect(result.symbols[0].kind).toBe("variable");
    });
  });

  describe("doc comments", () => {
    it("extracts package doc comment", async () => {
      const result = await parser.parse(
        `// Package utils provides utility functions.\npackage utils`,
        "utils.go"
      );
      expect(result.moduleDoc).toBeDefined();
      expect(result.moduleDoc!.summary).toBe(
        "Package utils provides utility functions."
      );
    });

    it("associates doc comment with function", async () => {
      const result = await parser.parse(
        `package main\n\n// NewConfig creates a new Config.\nfunc NewConfig() *Config {\n\treturn nil\n}`,
        "main.go"
      );
      expect(result.symbols[0].docs).toBeDefined();
      expect(result.symbols[0].docs!.summary).toBe(
        "NewConfig creates a new Config."
      );
    });
  });

  describe("exports", () => {
    it("only exports uppercase names", async () => {
      const source = `package main\n\nfunc Public() {}\nfunc private() {}`;
      const result = await parser.parse(source, "main.go");
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0].name).toBe("Public");
    });
  });
});
