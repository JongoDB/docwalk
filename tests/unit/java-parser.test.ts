import { describe, it, expect } from "vitest";
import { JavaParser } from "../../src/analysis/parsers/java";

const parser = new JavaParser();

describe("JavaParser", () => {
  describe("imports", () => {
    it("extracts import statements", async () => {
      const result = await parser.parse(
        `import java.util.HashMap;\nimport java.io.File;`,
        "Main.java"
      );
      expect(result.imports).toHaveLength(2);
      expect(result.imports[0].source).toBe("java.util");
      expect(result.imports[0].specifiers[0].name).toBe("HashMap");
    });

    it("extracts wildcard imports", async () => {
      const result = await parser.parse(
        `import java.util.*;`,
        "Main.java"
      );
      expect(result.imports[0].specifiers[0].name).toBe("*");
      expect(result.imports[0].specifiers[0].isNamespace).toBe(true);
    });

    it("extracts static imports", async () => {
      const result = await parser.parse(
        `import static org.junit.Assert.assertEquals;`,
        "Test.java"
      );
      expect(result.imports[0].isTypeOnly).toBe(false);
    });
  });

  describe("classes", () => {
    it("extracts public class", async () => {
      const result = await parser.parse(
        `public class Config {\n}`,
        "Config.java"
      );
      const cls = result.symbols.find((s) => s.name === "Config");
      expect(cls).toBeDefined();
      expect(cls!.kind).toBe("class");
      expect(cls!.exported).toBe(true);
      expect(cls!.visibility).toBe("public");
    });

    it("extracts class with extends and implements", async () => {
      const result = await parser.parse(
        `public class AppConfig extends BaseConfig implements Serializable {\n}`,
        "AppConfig.java"
      );
      const cls = result.symbols.find((s) => s.name === "AppConfig");
      expect(cls).toBeDefined();
      expect(cls!.extends).toBe("BaseConfig");
    });

    it("marks non-public class as private", async () => {
      const result = await parser.parse(
        `class Internal {\n}`,
        "Internal.java"
      );
      expect(result.symbols[0].exported).toBe(false);
    });
  });

  describe("interfaces", () => {
    it("extracts public interface", async () => {
      const result = await parser.parse(
        `public interface Handler {\n    void handle();\n}`,
        "Handler.java"
      );
      const iface = result.symbols.find((s) => s.name === "Handler");
      expect(iface).toBeDefined();
      expect(iface!.kind).toBe("interface");
    });
  });

  describe("enums", () => {
    it("extracts public enum", async () => {
      const result = await parser.parse(
        `public enum Color {\n    RED, GREEN, BLUE\n}`,
        "Color.java"
      );
      const sym = result.symbols.find((s) => s.name === "Color");
      expect(sym).toBeDefined();
      expect(sym!.kind).toBe("enum");
    });
  });

  describe("methods", () => {
    it("extracts public methods from class", async () => {
      const result = await parser.parse(
        `public class Service {\n    public String getName() {\n        return "";\n    }\n}`,
        "Service.java"
      );
      const method = result.symbols.find((s) => s.name === "getName");
      expect(method).toBeDefined();
      expect(method!.kind).toBe("method");
      expect(method!.parentId).toContain("Service");
    });

    it("extracts method parameters", async () => {
      const result = await parser.parse(
        `public class Calc {\n    public int add(int a, int b) {\n        return a + b;\n    }\n}`,
        "Calc.java"
      );
      const method = result.symbols.find((s) => s.name === "add");
      expect(method).toBeDefined();
      expect(method!.parameters).toHaveLength(2);
      expect(method!.parameters![0].name).toBe("a");
    });
  });

  describe("Javadoc", () => {
    it("extracts Javadoc comment", async () => {
      const result = await parser.parse(
        `/**\n * A configuration class.\n */\npublic class Config {\n}`,
        "Config.java"
      );
      const cls = result.symbols.find((s) => s.name === "Config");
      expect(cls!.docs).toBeDefined();
      expect(cls!.docs!.summary).toBe("A configuration class.");
    });

    it("extracts @param and @return tags", async () => {
      const result = await parser.parse(
        `public class Calc {\n    /**\n     * Adds two numbers.\n     * @param a First number\n     * @param b Second number\n     * @return The sum\n     */\n    public int add(int a, int b) {\n        return a + b;\n    }\n}`,
        "Calc.java"
      );
      const method = result.symbols.find((s) => s.name === "add");
      expect(method!.docs).toBeDefined();
      expect(method!.docs!.summary).toBe("Adds two numbers.");
      expect(method!.docs!.params).toBeDefined();
      expect(method!.docs!.params!["a"]).toBe("First number");
      expect(method!.docs!.returns).toBe("The sum");
    });
  });

  describe("exports", () => {
    it("only exports public types", async () => {
      const result = await parser.parse(
        `public class PublicClass {\n}\nclass PackageClass {\n}`,
        "Test.java"
      );
      const publicExports = result.exports.filter((e) => e.name === "PublicClass");
      const packageExports = result.exports.filter((e) => e.name === "PackageClass");
      expect(publicExports).toHaveLength(1);
      expect(packageExports).toHaveLength(0);
    });
  });
});
