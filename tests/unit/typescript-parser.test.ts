import { describe, it, expect } from "vitest";
import { TypeScriptParser } from "../../src/analysis/parsers/typescript";

const parser = new TypeScriptParser();

describe("TypeScriptParser", () => {
  describe("imports", () => {
    it("extracts named imports", async () => {
      const result = await parser.parse(
        `import { foo, bar } from './module';`,
        "test.ts"
      );
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].source).toBe("./module");
      expect(result.imports[0].specifiers).toHaveLength(2);
      expect(result.imports[0].specifiers[0].name).toBe("foo");
      expect(result.imports[0].specifiers[1].name).toBe("bar");
      expect(result.imports[0].isTypeOnly).toBe(false);
    });

    it("extracts type-only imports", async () => {
      const result = await parser.parse(
        `import type { Foo } from './types';`,
        "test.ts"
      );
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].isTypeOnly).toBe(true);
      expect(result.imports[0].specifiers[0].name).toBe("Foo");
    });

    it("extracts namespace imports", async () => {
      const result = await parser.parse(
        `import * as ns from 'package';`,
        "test.ts"
      );
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].specifiers[0].name).toBe("*");
      expect(result.imports[0].specifiers[0].alias).toBe("ns");
      expect(result.imports[0].specifiers[0].isNamespace).toBe(true);
    });

    it("extracts default imports", async () => {
      const result = await parser.parse(
        `import React from 'react';`,
        "test.ts"
      );
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].specifiers[0].name).toBe("React");
      expect(result.imports[0].specifiers[0].isDefault).toBe(true);
    });

    it("extracts side-effect imports", async () => {
      const result = await parser.parse(
        `import './polyfill';`,
        "test.ts"
      );
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].source).toBe("./polyfill");
      expect(result.imports[0].specifiers).toHaveLength(0);
    });

    it("extracts aliased imports", async () => {
      const result = await parser.parse(
        `import { foo as bar } from './module';`,
        "test.ts"
      );
      expect(result.imports[0].specifiers[0].name).toBe("foo");
      expect(result.imports[0].specifiers[0].alias).toBe("bar");
    });
  });

  describe("function declarations", () => {
    it("extracts exported function", async () => {
      const result = await parser.parse(
        `export function greet(name: string): string { return name; }`,
        "test.ts"
      );
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].name).toBe("greet");
      expect(result.symbols[0].kind).toBe("function");
      expect(result.symbols[0].exported).toBe(true);
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0].name).toBe("greet");
    });

    it("extracts async function", async () => {
      const result = await parser.parse(
        `export async function fetchData(): Promise<void> {}`,
        "test.ts"
      );
      expect(result.symbols[0].async).toBe(true);
      expect(result.symbols[0].name).toBe("fetchData");
    });

    it("extracts function parameters", async () => {
      const result = await parser.parse(
        `export function add(a: number, b: number): number { return a + b; }`,
        "test.ts"
      );
      expect(result.symbols[0].parameters).toHaveLength(2);
      expect(result.symbols[0].parameters![0].name).toBe("a");
      expect(result.symbols[0].parameters![0].type).toBe("number");
      expect(result.symbols[0].parameters![1].name).toBe("b");
    });

    it("extracts private function", async () => {
      const result = await parser.parse(
        `function helper(): void {}`,
        "test.ts"
      );
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].exported).toBe(false);
      expect(result.symbols[0].visibility).toBe("private");
      expect(result.exports).toHaveLength(0);
    });

    it("extracts return type", async () => {
      const result = await parser.parse(
        `export function create(): Promise<string> { return Promise.resolve(""); }`,
        "test.ts"
      );
      expect(result.symbols[0].returns?.type).toBe("Promise<string>");
    });
  });

  describe("class declarations", () => {
    it("extracts exported class", async () => {
      const result = await parser.parse(
        `export class MyService { run() {} }`,
        "test.ts"
      );
      expect(result.symbols[0].name).toBe("MyService");
      expect(result.symbols[0].kind).toBe("class");
      expect(result.symbols[0].exported).toBe(true);
    });

    it("extracts class with extends and implements", async () => {
      const result = await parser.parse(
        `export class Foo extends Base implements IFoo, IBar {}`,
        "test.ts"
      );
      expect(result.symbols[0].extends).toBe("Base");
      expect(result.symbols[0].implements).toContain("IFoo");
      expect(result.symbols[0].implements).toContain("IBar");
    });

    it("extracts default export class", async () => {
      const result = await parser.parse(
        `export default class Controller {}`,
        "test.ts"
      );
      expect(result.symbols[0].name).toBe("Controller");
      expect(result.exports[0].isDefault).toBe(true);
    });
  });

  describe("interface declarations", () => {
    it("extracts exported interface", async () => {
      const result = await parser.parse(
        `export interface Config {\n  port: number;\n  host?: string;\n}`,
        "test.ts"
      );
      expect(result.symbols[0].name).toBe("Config");
      expect(result.symbols[0].kind).toBe("interface");
      expect(result.symbols[0].exported).toBe(true);
    });
  });

  describe("type alias declarations", () => {
    it("extracts exported type alias", async () => {
      const result = await parser.parse(
        `export type ID = string | number;`,
        "test.ts"
      );
      expect(result.symbols[0].name).toBe("ID");
      expect(result.symbols[0].kind).toBe("type");
      expect(result.symbols[0].exported).toBe(true);
    });
  });

  describe("enum declarations", () => {
    it("extracts exported enum", async () => {
      const result = await parser.parse(
        `export enum Status { Active = 'active', Inactive = 'inactive' }`,
        "test.ts"
      );
      expect(result.symbols[0].name).toBe("Status");
      expect(result.symbols[0].kind).toBe("enum");
    });
  });

  describe("const/variable declarations", () => {
    it("extracts exported constant", async () => {
      const result = await parser.parse(
        `export const MAX_SIZE = 100;`,
        "test.ts"
      );
      expect(result.symbols[0].name).toBe("MAX_SIZE");
      expect(result.symbols[0].kind).toBe("constant");
    });

    it("extracts arrow function as function kind", async () => {
      const result = await parser.parse(
        `export const handler = (req: Request): Response => { return new Response(); };`,
        "test.ts"
      );
      expect(result.symbols[0].name).toBe("handler");
      expect(result.symbols[0].kind).toBe("function");
    });
  });

  describe("re-exports", () => {
    it("extracts named re-exports", async () => {
      const result = await parser.parse(
        `export { foo, bar as baz } from './module';`,
        "test.ts"
      );
      expect(result.exports).toHaveLength(2);
      expect(result.exports[0].isReExport).toBe(true);
      expect(result.exports[0].source).toBe("./module");
    });

    it("extracts star re-exports", async () => {
      const result = await parser.parse(
        `export * from './all';`,
        "test.ts"
      );
      expect(result.exports).toHaveLength(1);
      expect(result.exports[0].name).toBe("*");
      expect(result.exports[0].isReExport).toBe(true);
    });
  });

  describe("JSDoc comments", () => {
    it("associates JSDoc with function", async () => {
      const result = await parser.parse(
        `/**\n * Greet a person\n * @param name - The name\n * @returns The greeting\n */\nexport function greet(name: string): string { return "hi " + name; }`,
        "test.ts"
      );
      expect(result.symbols[0].docs).toBeDefined();
      expect(result.symbols[0].docs!.summary).toBe("Greet a person");
      expect(result.symbols[0].docs!.params?.name).toBe("The name");
      expect(result.symbols[0].docs!.returns).toBe("The greeting");
    });

    it("extracts module-level doc", async () => {
      const result = await parser.parse(
        `/**\n * This module does stuff.\n */\n\nexport function foo() {}`,
        "test.ts"
      );
      expect(result.moduleDoc).toBeDefined();
      expect(result.moduleDoc!.summary).toBe("This module does stuff.");
    });

    it("extracts @deprecated tag", async () => {
      const result = await parser.parse(
        `/**\n * Old function\n * @deprecated Use newFn instead\n */\nexport function oldFn() {}`,
        "test.ts"
      );
      expect(result.symbols[0].docs!.deprecated).toBe("Use newFn instead");
    });
  });

  describe("complex scenarios", () => {
    it("handles multiple exports in one file", async () => {
      const source = `
import { z } from 'zod';

export interface Config {
  port: number;
}

export type ID = string;

export function createConfig(): Config {
  return { port: 3000 };
}

export const DEFAULT_PORT = 3000;

function helper() {}
`;
      const result = await parser.parse(source, "test.ts");
      expect(result.imports).toHaveLength(1);
      expect(result.exports.length).toBeGreaterThanOrEqual(4);
      const exported = result.symbols.filter((s) => s.exported);
      expect(exported.length).toBeGreaterThanOrEqual(4);
      const privateSyms = result.symbols.filter((s) => !s.exported);
      expect(privateSyms.length).toBeGreaterThanOrEqual(1);
    });

    it("extracts location info", async () => {
      const result = await parser.parse(
        `export function foo() {}`,
        "test.ts"
      );
      expect(result.symbols[0].location.file).toBe("test.ts");
      expect(result.symbols[0].location.line).toBe(1);
    });
  });
});
