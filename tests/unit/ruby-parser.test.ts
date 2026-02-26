import { describe, it, expect } from "vitest";
import { RubyParser } from "../../src/analysis/parsers/ruby";

const parser = new RubyParser();

describe("RubyParser", () => {
  describe("imports", () => {
    it("extracts require statements", async () => {
      const result = await parser.parse(
        `require "json"\nrequire_relative "config"`,
        "app.rb"
      );
      expect(result.imports).toHaveLength(2);
      expect(result.imports[0].source).toBe("json");
      expect(result.imports[1].source).toBe("config");
    });
  });

  describe("classes", () => {
    it("extracts class", async () => {
      const result = await parser.parse(
        `class Config\nend`,
        "config.rb"
      );
      const cls = result.symbols.find((s) => s.name === "Config");
      expect(cls).toBeDefined();
      expect(cls!.kind).toBe("class");
      expect(cls!.exported).toBe(true);
    });

    it("extracts class with inheritance", async () => {
      const result = await parser.parse(
        `class AppConfig < BaseConfig\nend`,
        "config.rb"
      );
      const cls = result.symbols.find((s) => s.name === "AppConfig");
      expect(cls).toBeDefined();
      expect(cls!.extends).toBe("BaseConfig");
    });
  });

  describe("modules", () => {
    it("extracts module", async () => {
      const result = await parser.parse(
        `module Helpers\nend`,
        "helpers.rb"
      );
      const mod = result.symbols.find((s) => s.name === "Helpers");
      expect(mod).toBeDefined();
      expect(mod!.kind).toBe("module");
    });
  });

  describe("methods", () => {
    it("extracts method definitions", async () => {
      const result = await parser.parse(
        `def greet(name)\n  puts "Hello #{name}"\nend`,
        "app.rb"
      );
      const method = result.symbols.find((s) => s.name === "greet");
      expect(method).toBeDefined();
      expect(method!.kind).toBe("method");
      expect(method!.exported).toBe(true);
    });

    it("extracts method parameters", async () => {
      const result = await parser.parse(
        `def add(a, b)\n  a + b\nend`,
        "calc.rb"
      );
      expect(result.symbols[0].parameters).toHaveLength(2);
      expect(result.symbols[0].parameters![0].name).toBe("a");
    });

    it("extracts methods from classes", async () => {
      const result = await parser.parse(
        `class Service\n  def run\n    true\n  end\nend`,
        "service.rb"
      );
      const method = result.symbols.find((s) => s.name === "run");
      expect(method).toBeDefined();
      expect(method!.kind).toBe("method");
      expect(method!.parentId).toContain("Service");
    });
  });

  describe("constants", () => {
    it("extracts uppercase constants", async () => {
      const result = await parser.parse(
        `MAX_RETRIES = 3`,
        "config.rb"
      );
      const sym = result.symbols.find((s) => s.name === "MAX_RETRIES");
      expect(sym).toBeDefined();
      expect(sym!.kind).toBe("constant");
    });
  });

  describe("doc comments", () => {
    it("extracts RDoc comment before method", async () => {
      const result = await parser.parse(
        `# Creates a new config.\ndef new_config\nend`,
        "config.rb"
      );
      expect(result.symbols[0].docs).toBeDefined();
      expect(result.symbols[0].docs!.summary).toBe("Creates a new config.");
    });

    it("extracts YARD @param tags", async () => {
      const result = await parser.parse(
        `# Adds two numbers.\n# @param a First number\n# @param b Second number\n# @return The sum\ndef add(a, b)\n  a + b\nend`,
        "calc.rb"
      );
      expect(result.symbols[0].docs!.summary).toBe("Adds two numbers.");
      expect(result.symbols[0].docs!.params).toBeDefined();
      expect(result.symbols[0].docs!.params!["a"]).toBe("First number");
      expect(result.symbols[0].docs!.returns).toBe("The sum");
    });
  });

  describe("visibility", () => {
    it("marks private methods from private declarations", async () => {
      const result = await parser.parse(
        `class Service\n  def public_method\n  end\n\n  private :secret_method\n\n  def secret_method\n  end\nend`,
        "service.rb"
      );
      const secret = result.symbols.find((s) => s.name === "secret_method");
      expect(secret).toBeDefined();
      expect(secret!.visibility).toBe("private");
      expect(secret!.exported).toBe(false);
    });
  });

  describe("exports", () => {
    it("exports classes and public methods", async () => {
      const result = await parser.parse(
        `class Service\n  def run\n  end\nend`,
        "service.rb"
      );
      expect(result.exports.some((e) => e.name === "Service")).toBe(true);
    });
  });
});
