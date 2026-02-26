import { describe, it, expect } from "vitest";
import { PythonParser } from "../../src/analysis/parsers/python";

const parser = new PythonParser();

describe("PythonParser", () => {
  describe("imports", () => {
    it("extracts import statement", async () => {
      const result = await parser.parse(`import os`, "test.py");
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].source).toBe("os");
    });

    it("extracts from import", async () => {
      const result = await parser.parse(
        `from pathlib import Path, PurePath`,
        "test.py"
      );
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].source).toBe("pathlib");
      expect(result.imports[0].specifiers.length).toBeGreaterThanOrEqual(2);
    });

    it("extracts wildcard import", async () => {
      const result = await parser.parse(`from os import *`, "test.py");
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].specifiers[0].isNamespace).toBe(true);
    });
  });

  describe("functions", () => {
    it("extracts public function", async () => {
      const result = await parser.parse(
        `def greet(name: str) -> str:\n    return f"hello {name}"`,
        "test.py"
      );
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].name).toBe("greet");
      expect(result.symbols[0].kind).toBe("function");
      expect(result.symbols[0].exported).toBe(true);
    });

    it("marks underscore functions as private", async () => {
      const result = await parser.parse(
        `def _helper():\n    pass`,
        "test.py"
      );
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].visibility).toBe("private");
      expect(result.symbols[0].exported).toBe(false);
    });

    it("extracts async function", async () => {
      const result = await parser.parse(
        `async def fetch(url: str) -> bytes:\n    pass`,
        "test.py"
      );
      expect(result.symbols[0].async).toBe(true);
    });

    it("extracts function parameters with types", async () => {
      const result = await parser.parse(
        `def add(a: int, b: int = 0) -> int:\n    return a + b`,
        "test.py"
      );
      expect(result.symbols[0].parameters).toHaveLength(2);
      expect(result.symbols[0].parameters![0].name).toBe("a");
      expect(result.symbols[0].parameters![0].type).toBe("int");
      expect(result.symbols[0].parameters![1].optional).toBe(true);
    });

    it("extracts return type", async () => {
      const result = await parser.parse(
        `def create() -> str:\n    return ""`,
        "test.py"
      );
      expect(result.symbols[0].returns?.type).toBe("str");
    });
  });

  describe("classes", () => {
    it("extracts class with base", async () => {
      const result = await parser.parse(
        `class MyClass(BaseClass):\n    pass`,
        "test.py"
      );
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].name).toBe("MyClass");
      expect(result.symbols[0].kind).toBe("class");
      expect(result.symbols[0].extends).toBe("BaseClass");
    });

    it("extracts class methods as children", async () => {
      const result = await parser.parse(
        `class Foo:\n    def bar(self):\n        pass\n    def baz(self):\n        pass`,
        "test.py"
      );
      expect(result.symbols[0].children).toBeDefined();
      expect(result.symbols[0].children!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("docstrings", () => {
    it("extracts module docstring", async () => {
      const result = await parser.parse(
        `"""My module."""\n\ndef foo():\n    pass`,
        "test.py"
      );
      expect(result.moduleDoc).toBeDefined();
      expect(result.moduleDoc!.summary).toBe("My module.");
    });

    it("extracts function docstring (Google style)", async () => {
      const source = `def greet(name: str) -> str:\n    """Greet someone.\n\n    Args:\n        name: The name.\n\n    Returns:\n        The greeting.\n    """\n    return name`;
      const result = await parser.parse(source, "test.py");
      expect(result.symbols[0].docs).toBeDefined();
      expect(result.symbols[0].docs!.summary).toBe("Greet someone.");
      expect(result.symbols[0].docs!.params?.name).toBe("The name.");
      expect(result.symbols[0].docs!.returns).toBeDefined();
    });
  });

  describe("__all__ exports", () => {
    it("respects __all__ for export filtering", async () => {
      const source = `__all__ = ['foo']\n\ndef foo():\n    pass\n\ndef bar():\n    pass`;
      const result = await parser.parse(source, "test.py");
      const foo = result.symbols.find((s) => s.name === "foo");
      const bar = result.symbols.find((s) => s.name === "bar");
      expect(foo?.exported).toBe(true);
      expect(bar?.exported).toBe(false);
    });
  });

  describe("constants", () => {
    it("extracts top-level constants", async () => {
      const result = await parser.parse(`MAX_SIZE = 100`, "test.py");
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].name).toBe("MAX_SIZE");
      expect(result.symbols[0].kind).toBe("constant");
    });
  });
});
