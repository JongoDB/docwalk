import { describe, it, expect } from "vitest";
import { PhpParser } from "../../src/analysis/parsers/php";

const parser = new PhpParser();

describe("PhpParser", () => {
  describe("imports", () => {
    it("extracts use statements", async () => {
      const result = await parser.parse(
        `<?php\nuse App\\Config\\AppConfig;\nuse App\\Models\\User;`,
        "index.php"
      );
      expect(result.imports).toHaveLength(2);
      expect(result.imports[0].specifiers[0].name).toBe("AppConfig");
    });

    it("extracts use with alias", async () => {
      const result = await parser.parse(
        `<?php\nuse App\\Config\\AppConfig as Config;`,
        "index.php"
      );
      expect(result.imports[0].specifiers[0].name).toBe("AppConfig");
      expect(result.imports[0].specifiers[0].alias).toBe("Config");
    });
  });

  describe("classes", () => {
    it("extracts class declaration", async () => {
      const result = await parser.parse(
        `<?php\nclass Config\n{\n}`,
        "Config.php"
      );
      const cls = result.symbols.find((s) => s.name === "Config");
      expect(cls).toBeDefined();
      expect(cls!.kind).toBe("class");
      expect(cls!.exported).toBe(true);
    });

    it("extracts class with extends", async () => {
      const result = await parser.parse(
        `<?php\nclass AppConfig extends BaseConfig\n{\n}`,
        "AppConfig.php"
      );
      const cls = result.symbols.find((s) => s.name === "AppConfig");
      expect(cls).toBeDefined();
      expect(cls!.extends).toBeTruthy();
    });
  });

  describe("interfaces", () => {
    it("extracts interface", async () => {
      const result = await parser.parse(
        `<?php\ninterface Handler\n{\n    public function handle(): void;\n}`,
        "Handler.php"
      );
      const iface = result.symbols.find((s) => s.name === "Handler");
      expect(iface).toBeDefined();
      expect(iface!.kind).toBe("interface");
    });
  });

  describe("traits", () => {
    it("extracts trait", async () => {
      const result = await parser.parse(
        `<?php\ntrait Loggable\n{\n    public function log(string $msg): void {}\n}`,
        "Loggable.php"
      );
      const trait = result.symbols.find((s) => s.name === "Loggable");
      expect(trait).toBeDefined();
      expect(trait!.kind).toBe("class");
    });
  });

  describe("functions", () => {
    it("extracts top-level functions", async () => {
      const result = await parser.parse(
        `<?php\nfunction greet(string $name): string\n{\n    return "Hello $name";\n}`,
        "helpers.php"
      );
      const fn = result.symbols.find((s) => s.name === "greet");
      expect(fn).toBeDefined();
      expect(fn!.kind).toBe("function");
    });

    it("extracts function parameters", async () => {
      const result = await parser.parse(
        `<?php\nfunction add(int $a, int $b): int\n{\n    return $a + $b;\n}`,
        "math.php"
      );
      expect(result.symbols[0].parameters).toHaveLength(2);
      expect(result.symbols[0].parameters![0].name).toBe("a");
      expect(result.symbols[0].parameters![0].type).toBe("int");
    });

    it("extracts return type", async () => {
      const result = await parser.parse(
        `<?php\nfunction getName(): string\n{\n    return "";\n}`,
        "helpers.php"
      );
      expect(result.symbols[0].returns?.type).toBe("string");
    });
  });

  describe("methods", () => {
    it("extracts public methods from class", async () => {
      const result = await parser.parse(
        `<?php\nclass Service\n{\n    public function run(): void\n    {\n    }\n}`,
        "Service.php"
      );
      const method = result.symbols.find((s) => s.name === "run");
      expect(method).toBeDefined();
      expect(method!.kind).toBe("method");
      expect(method!.parentId).toContain("Service");
      expect(method!.exported).toBe(true);
    });

    it("marks private methods as not exported", async () => {
      const result = await parser.parse(
        `<?php\nclass Service\n{\n    private function helper(): void\n    {\n    }\n}`,
        "Service.php"
      );
      const method = result.symbols.find((s) => s.name === "helper");
      expect(method).toBeDefined();
      expect(method!.exported).toBe(false);
      expect(method!.visibility).toBe("private");
    });
  });

  describe("PHPDoc", () => {
    it("extracts PHPDoc comment", async () => {
      const result = await parser.parse(
        `<?php\n/**\n * A configuration class.\n */\nclass Config\n{\n}`,
        "Config.php"
      );
      const cls = result.symbols.find((s) => s.name === "Config");
      expect(cls!.docs).toBeDefined();
      expect(cls!.docs!.summary).toBe("A configuration class.");
    });

    it("extracts @param and @return tags", async () => {
      const result = await parser.parse(
        `<?php\nclass Calc\n{\n    /**\n     * Adds two numbers.\n     * @param int $a First number\n     * @param int $b Second number\n     * @return int The sum\n     */\n    public function add(int $a, int $b): int\n    {\n        return $a + $b;\n    }\n}`,
        "Calc.php"
      );
      const method = result.symbols.find((s) => s.name === "add");
      expect(method!.docs).toBeDefined();
      expect(method!.docs!.summary).toBe("Adds two numbers.");
      expect(method!.docs!.params).toBeDefined();
      expect(method!.docs!.params!["a"]).toBe("First number");
    });
  });

  describe("exports", () => {
    it("exports all top-level declarations", async () => {
      const result = await parser.parse(
        `<?php\nclass Config\n{\n}\nfunction helper(): void\n{\n}`,
        "app.php"
      );
      expect(result.exports).toHaveLength(2);
    });
  });
});
