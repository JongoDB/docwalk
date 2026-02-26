import { describe, it, expect } from "vitest";
import { CSharpParser } from "../../src/analysis/parsers/csharp";

const parser = new CSharpParser();

describe("CSharpParser", () => {
  describe("imports", () => {
    it("extracts using directives", async () => {
      const result = await parser.parse(
        `using System;\nusing System.Collections.Generic;`,
        "Program.cs"
      );
      expect(result.imports).toHaveLength(2);
      expect(result.imports[0].source).toBe("System");
      expect(result.imports[1].source).toBe("System.Collections.Generic");
    });
  });

  describe("classes", () => {
    it("extracts public class", async () => {
      const result = await parser.parse(
        `public class Config\n{\n}`,
        "Config.cs"
      );
      const cls = result.symbols.find((s) => s.name === "Config");
      expect(cls).toBeDefined();
      expect(cls!.kind).toBe("class");
      expect(cls!.exported).toBe(true);
    });

    it("extracts internal class as exported", async () => {
      const result = await parser.parse(
        `internal class InternalConfig\n{\n}`,
        "Config.cs"
      );
      const cls = result.symbols.find((s) => s.name === "InternalConfig");
      expect(cls).toBeDefined();
      expect(cls!.exported).toBe(true);
      expect(cls!.visibility).toBe("internal");
    });

    it("marks private class as not exported", async () => {
      const result = await parser.parse(
        `class PrivateConfig\n{\n}`,
        "Config.cs"
      );
      expect(result.symbols[0].exported).toBe(false);
    });
  });

  describe("interfaces", () => {
    it("extracts public interface", async () => {
      const result = await parser.parse(
        `public interface IHandler\n{\n    void Handle();\n}`,
        "IHandler.cs"
      );
      const iface = result.symbols.find((s) => s.name === "IHandler");
      expect(iface).toBeDefined();
      expect(iface!.kind).toBe("interface");
    });
  });

  describe("structs", () => {
    it("extracts public struct", async () => {
      const result = await parser.parse(
        `public struct Point\n{\n    public int X;\n    public int Y;\n}`,
        "Point.cs"
      );
      const sym = result.symbols.find((s) => s.name === "Point");
      expect(sym).toBeDefined();
      expect(sym!.kind).toBe("class");
    });
  });

  describe("enums", () => {
    it("extracts public enum", async () => {
      const result = await parser.parse(
        `public enum Color\n{\n    Red,\n    Green,\n    Blue\n}`,
        "Color.cs"
      );
      const sym = result.symbols.find((s) => s.name === "Color");
      expect(sym).toBeDefined();
      expect(sym!.kind).toBe("enum");
    });
  });

  describe("methods", () => {
    it("extracts public methods", async () => {
      const result = await parser.parse(
        `public class Service\n{\n    public string GetName()\n    {\n        return "";\n    }\n}`,
        "Service.cs"
      );
      const method = result.symbols.find((s) => s.name === "GetName");
      expect(method).toBeDefined();
      expect(method!.kind).toBe("method");
      expect(method!.parentId).toContain("Service");
    });

    it("extracts method parameters", async () => {
      const result = await parser.parse(
        `public class Calc\n{\n    public int Add(int a, int b)\n    {\n        return a + b;\n    }\n}`,
        "Calc.cs"
      );
      const method = result.symbols.find((s) => s.name === "Add");
      expect(method).toBeDefined();
      expect(method!.parameters).toHaveLength(2);
    });
  });

  describe("properties", () => {
    it("extracts public properties", async () => {
      const result = await parser.parse(
        `public class Config\n{\n    public string Name { get; set; }\n}`,
        "Config.cs"
      );
      const prop = result.symbols.find((s) => s.name === "Name");
      expect(prop).toBeDefined();
      expect(prop!.kind).toBe("property");
      expect(prop!.parentId).toContain("Config");
    });
  });

  describe("XML doc comments", () => {
    it("extracts /// summary", async () => {
      const result = await parser.parse(
        `/// <summary>\n/// A configuration class.\n/// </summary>\npublic class Config\n{\n}`,
        "Config.cs"
      );
      const cls = result.symbols.find((s) => s.name === "Config");
      expect(cls!.docs).toBeDefined();
      expect(cls!.docs!.summary).toBe("A configuration class.");
    });
  });

  describe("namespaces", () => {
    it("extracts types within namespaces", async () => {
      const result = await parser.parse(
        `namespace MyApp\n{\n    public class Config\n    {\n    }\n}`,
        "Config.cs"
      );
      const cls = result.symbols.find((s) => s.name === "Config");
      expect(cls).toBeDefined();
      expect(cls!.exported).toBe(true);
    });
  });

  describe("exports", () => {
    it("exports public types", async () => {
      const result = await parser.parse(
        `public class PublicClass\n{\n}\nclass PrivateClass\n{\n}`,
        "Test.cs"
      );
      const publicExports = result.exports.filter((e) => e.name === "PublicClass");
      const privateExports = result.exports.filter((e) => e.name === "PrivateClass");
      expect(publicExports).toHaveLength(1);
      expect(privateExports).toHaveLength(0);
    });
  });
});
