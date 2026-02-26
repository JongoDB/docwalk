import { describe, it, expect } from "vitest";
import { RustParser } from "../../src/analysis/parsers/rust";

const parser = new RustParser();

describe("RustParser", () => {
  describe("imports", () => {
    it("extracts use statements", async () => {
      const result = await parser.parse(
        `use std::collections::HashMap;\nuse std::io;`,
        "main.rs"
      );
      expect(result.imports).toHaveLength(2);
      expect(result.imports[0].source).toBe("std::collections");
      expect(result.imports[0].specifiers[0].name).toBe("HashMap");
    });

    it("extracts grouped use statements", async () => {
      const result = await parser.parse(
        `use std::collections::{HashMap, BTreeMap};`,
        "main.rs"
      );
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].specifiers).toHaveLength(2);
      expect(result.imports[0].specifiers[0].name).toBe("HashMap");
      expect(result.imports[0].specifiers[1].name).toBe("BTreeMap");
    });

    it("identifies pub use as re-exports", async () => {
      const result = await parser.parse(
        `pub use crate::config::Config;`,
        "lib.rs"
      );
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0].name).toBe("Config");
      expect(result.exports[0].isReExport).toBe(true);
    });
  });

  describe("functions", () => {
    it("extracts pub function", async () => {
      const result = await parser.parse(
        `pub fn create_config(port: u16) -> Config {\n    Config { port }\n}`,
        "lib.rs"
      );
      const fn = result.symbols.find((s) => s.name === "create_config");
      expect(fn).toBeDefined();
      expect(fn!.kind).toBe("function");
      expect(fn!.exported).toBe(true);
      expect(fn!.visibility).toBe("public");
    });

    it("marks non-pub functions as private", async () => {
      const result = await parser.parse(
        `fn helper() {}`,
        "lib.rs"
      );
      expect(result.symbols[0].exported).toBe(false);
      expect(result.symbols[0].visibility).toBe("private");
    });

    it("extracts function parameters", async () => {
      const result = await parser.parse(
        `pub fn add(a: i32, b: i32) -> i32 {\n    a + b\n}`,
        "lib.rs"
      );
      expect(result.symbols[0].parameters).toHaveLength(2);
      expect(result.symbols[0].parameters![0].name).toBe("a");
      expect(result.symbols[0].parameters![0].type).toBe("i32");
    });

    it("detects async functions", async () => {
      const result = await parser.parse(
        `pub async fn fetch_data() -> Result<Data, Error> {\n    Ok(Data)\n}`,
        "lib.rs"
      );
      expect(result.symbols[0].async).toBe(true);
    });
  });

  describe("structs", () => {
    it("extracts pub struct", async () => {
      const result = await parser.parse(
        `pub struct Config {\n    pub port: u16,\n    host: String,\n}`,
        "lib.rs"
      );
      const sym = result.symbols.find((s) => s.name === "Config");
      expect(sym).toBeDefined();
      expect(sym!.kind).toBe("class");
      expect(sym!.exported).toBe(true);
    });

    it("marks non-pub struct as private", async () => {
      const result = await parser.parse(
        `struct Internal {}`,
        "lib.rs"
      );
      expect(result.symbols[0].exported).toBe(false);
    });
  });

  describe("enums", () => {
    it("extracts pub enum", async () => {
      const result = await parser.parse(
        `pub enum Color {\n    Red,\n    Green,\n    Blue,\n}`,
        "lib.rs"
      );
      const sym = result.symbols.find((s) => s.name === "Color");
      expect(sym).toBeDefined();
      expect(sym!.kind).toBe("enum");
      expect(sym!.exported).toBe(true);
    });
  });

  describe("traits", () => {
    it("extracts pub trait as interface", async () => {
      const result = await parser.parse(
        `pub trait Handler {\n    fn handle(&self) -> Result<(), Error>;\n}`,
        "lib.rs"
      );
      const sym = result.symbols.find((s) => s.name === "Handler");
      expect(sym).toBeDefined();
      expect(sym!.kind).toBe("interface");
      expect(sym!.exported).toBe(true);
    });
  });

  describe("impl blocks", () => {
    it("extracts methods from impl block", async () => {
      const result = await parser.parse(
        `struct Config {}\n\nimpl Config {\n    pub fn new() -> Self {\n        Config {}\n    }\n}`,
        "lib.rs"
      );
      const method = result.symbols.find((s) => s.name === "new");
      expect(method).toBeDefined();
      expect(method!.kind).toBe("method");
      expect(method!.parentId).toContain("Config");
    });
  });

  describe("constants", () => {
    it("extracts pub const", async () => {
      const result = await parser.parse(
        `pub const MAX_RETRIES: u32 = 3;`,
        "lib.rs"
      );
      expect(result.symbols[0].name).toBe("MAX_RETRIES");
      expect(result.symbols[0].kind).toBe("constant");
      expect(result.symbols[0].exported).toBe(true);
    });

    it("extracts static", async () => {
      const result = await parser.parse(
        `pub static DEFAULT_HOST: &str = "localhost";`,
        "lib.rs"
      );
      expect(result.symbols[0].name).toBe("DEFAULT_HOST");
      expect(result.symbols[0].kind).toBe("constant");
    });
  });

  describe("doc comments", () => {
    it("extracts /// doc comments", async () => {
      const result = await parser.parse(
        `/// Creates a new configuration.\npub fn new_config() {}`,
        "lib.rs"
      );
      expect(result.symbols[0].docs).toBeDefined();
      expect(result.symbols[0].docs!.summary).toBe("Creates a new configuration.");
    });

    it("extracts //! module doc comments", async () => {
      const result = await parser.parse(
        `//! This module provides configuration utilities.\n\npub fn foo() {}`,
        "lib.rs"
      );
      expect(result.moduleDoc).toBeDefined();
      expect(result.moduleDoc!.summary).toBe("This module provides configuration utilities.");
    });
  });

  describe("exports", () => {
    it("only exports pub items", async () => {
      const result = await parser.parse(
        `pub fn public_fn() {}\nfn private_fn() {}`,
        "lib.rs"
      );
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0].name).toBe("public_fn");
    });
  });
});
