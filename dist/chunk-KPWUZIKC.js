// src/analysis/language-detect.ts
var EXTENSION_MAP = {
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
  // YAML/config
  ".yaml": "yaml",
  ".yml": "yaml",
  // Shell
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  // Terraform/HCL
  ".tf": "hcl",
  ".hcl": "hcl",
  // SQL
  ".sql": "sql",
  // Markdown
  ".md": "markdown",
  ".mdx": "markdown",
  // Dockerfile
  ".dockerfile": "dockerfile",
  // TOML
  ".toml": "toml",
  // JSON
  ".json": "json",
  // XML
  ".xml": "xml"
};
function detectLanguage(filePath) {
  const basename = filePath.split("/").pop() || "";
  if (basename === "Dockerfile" || basename.startsWith("Dockerfile.")) {
    return "dockerfile";
  }
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return EXTENSION_MAP[ext];
}
function getSupportedExtensions() {
  return Object.keys(EXTENSION_MAP);
}
function getSupportedLanguages() {
  return [...new Set(Object.values(EXTENSION_MAP))];
}
function getLanguageDisplayName(lang) {
  const names = {
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
    yaml: "YAML",
    shell: "Shell",
    hcl: "HCL",
    sql: "SQL",
    markdown: "Markdown",
    dockerfile: "Dockerfile",
    toml: "TOML",
    json: "JSON",
    xml: "XML"
  };
  return names[lang] ?? lang;
}

export {
  detectLanguage,
  getSupportedExtensions,
  getSupportedLanguages,
  getLanguageDisplayName
};
