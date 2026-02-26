/**
 * Language Detection
 *
 * Maps file extensions to language identifiers used by the analysis engine
 * and tree-sitter parser selection.
 */

export type LanguageId =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "csharp"
  | "ruby"
  | "php"
  | "swift"
  | "kotlin"
  | "scala"
  | "elixir"
  | "dart"
  | "lua"
  | "zig"
  | "haskell"
  | "c"
  | "cpp";

const EXTENSION_MAP: Record<string, LanguageId> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".pyi": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".cs": "csharp",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".scala": "scala",
  ".sc": "scala",
  ".ex": "elixir",
  ".exs": "elixir",
  ".dart": "dart",
  ".lua": "lua",
  ".zig": "zig",
  ".hs": "haskell",
  ".lhs": "haskell",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cxx": "cpp",
  ".cc": "cpp",
  ".hpp": "cpp",
  ".hxx": "cpp",
};

/**
 * Detect the programming language from a file path.
 * Returns undefined for unrecognized extensions.
 */
export function detectLanguage(filePath: string): LanguageId | undefined {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return EXTENSION_MAP[ext];
}

/**
 * Get all supported file extensions.
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(EXTENSION_MAP);
}

/**
 * Get all supported language IDs.
 */
export function getSupportedLanguages(): LanguageId[] {
  return [...new Set(Object.values(EXTENSION_MAP))];
}

/**
 * Get display name for a language ID.
 */
export function getLanguageDisplayName(lang: LanguageId): string {
  const names: Record<LanguageId, string> = {
    typescript: "TypeScript",
    javascript: "JavaScript",
    python: "Python",
    go: "Go",
    rust: "Rust",
    java: "Java",
    csharp: "C#",
    ruby: "Ruby",
    php: "PHP",
    swift: "Swift",
    kotlin: "Kotlin",
    scala: "Scala",
    elixir: "Elixir",
    dart: "Dart",
    lua: "Lua",
    zig: "Zig",
    haskell: "Haskell",
    c: "C",
    cpp: "C++",
  };
  return names[lang] ?? lang;
}
