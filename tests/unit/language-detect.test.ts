import { describe, it, expect } from "vitest";
import {
  detectLanguage,
  getSupportedExtensions,
  getSupportedLanguages,
  getLanguageDisplayName,
} from "../../src/analysis/language-detect";

describe("detectLanguage", () => {
  it("detects TypeScript", () => {
    expect(detectLanguage("src/index.ts")).toBe("typescript");
    expect(detectLanguage("src/App.tsx")).toBe("typescript");
    expect(detectLanguage("utils.mts")).toBe("typescript");
  });

  it("detects JavaScript", () => {
    expect(detectLanguage("src/index.js")).toBe("javascript");
    expect(detectLanguage("components/App.jsx")).toBe("javascript");
    expect(detectLanguage("config.mjs")).toBe("javascript");
  });

  it("detects Python", () => {
    expect(detectLanguage("main.py")).toBe("python");
    expect(detectLanguage("types.pyi")).toBe("python");
  });

  it("detects Go", () => {
    expect(detectLanguage("main.go")).toBe("go");
  });

  it("detects Rust", () => {
    expect(detectLanguage("lib.rs")).toBe("rust");
  });

  it("returns undefined for unknown extensions", () => {
    expect(detectLanguage("README.md")).toBeUndefined();
    expect(detectLanguage("data.json")).toBeUndefined();
    expect(detectLanguage("Makefile")).toBeUndefined();
  });

  it("is case-insensitive for extensions", () => {
    expect(detectLanguage("file.PY")).toBe("python");
    expect(detectLanguage("file.TS")).toBe("typescript");
  });
});

describe("getSupportedExtensions", () => {
  it("returns an array of strings", () => {
    const exts = getSupportedExtensions();
    expect(exts.length).toBeGreaterThan(10);
    expect(exts).toContain(".ts");
    expect(exts).toContain(".py");
    expect(exts).toContain(".go");
  });
});

describe("getSupportedLanguages", () => {
  it("returns unique language IDs", () => {
    const langs = getSupportedLanguages();
    expect(new Set(langs).size).toBe(langs.length);
    expect(langs).toContain("typescript");
    expect(langs).toContain("python");
  });
});

describe("getLanguageDisplayName", () => {
  it("returns proper display names", () => {
    expect(getLanguageDisplayName("typescript")).toBe("TypeScript");
    expect(getLanguageDisplayName("csharp")).toBe("C#");
    expect(getLanguageDisplayName("cpp")).toBe("C++");
  });
});
