import path from "path";

import type {
  AnalysisManifest,
  ModuleInfo,
  Symbol,
  GeneratedPage,
  NavigationItem,
} from "../analysis/types.js";
import { getLanguageDisplayName, type LanguageId } from "../analysis/language-detect.js";

// ─── Logical Sections ───────────────────────────────────────────────────────

/** Detect logical groups from file paths (routes, models, services, etc.) */
export const LOGICAL_SECTIONS: Record<string, string[]> = {
  "CLI": ["cli", "commands", "bin"],
  "Core": ["core", "engine", "kernel"],
  "Configuration": ["config", "configuration", "settings"],
  "Analysis": ["analysis", "parsers", "ast"],
  "Models": ["models", "entities", "schemas", "types"],
  "Services": ["services", "providers", "adapters"],
  "Routes": ["routes", "controllers", "handlers", "endpoints", "api"],
  "Components": ["components", "views", "pages", "layouts", "widgets"],
  "Hooks": ["hooks", "composables"],
  "Utilities": ["utils", "helpers", "lib", "common", "shared"],
  "Generators": ["generators", "templates", "renderers"],
  "Sync": ["sync", "replication"],
  "Deploy": ["deploy", "deployment", "providers"],
  "Tests": ["tests", "test", "__tests__", "spec"],
  "Middleware": ["middleware"],
  "Database": ["database", "db", "repositories", "dao"],
};

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface PackageManager {
  id: string;
  displayName: string;
}

export interface RenderSymbolOptions {
  repoUrl?: string;
  branch?: string;
  sourceLinks?: boolean;
  symbolPageMap?: Map<string, string>;
}

// ─── Module Grouping ────────────────────────────────────────────────────────

export function groupModulesLogically(
  modules: ModuleInfo[]
): Record<string, ModuleInfo[]> {
  const groups: Record<string, ModuleInfo[]> = {};
  for (const mod of modules) {
    const section = detectLogicalSection(mod.filePath);
    if (!groups[section]) groups[section] = [];
    groups[section].push(mod);
  }
  return groups;
}

export function detectLogicalSection(filePath: string): string {
  const parts = filePath.toLowerCase().split("/");

  for (const [section, keywords] of Object.entries(LOGICAL_SECTIONS)) {
    for (const part of parts) {
      if (keywords.includes(part)) return section;
    }
  }

  // Fall back to directory name
  const dirParts = filePath.split("/");
  if (dirParts.length > 1) {
    const dir = dirParts[dirParts.length - 2];
    return dir.charAt(0).toUpperCase() + dir.slice(1);
  }

  return "API Reference";
}

export function groupByLogicalSection(
  pages: GeneratedPage[]
): Record<string, GeneratedPage[]> {
  const sections: Record<string, GeneratedPage[]> = {};
  for (const page of pages) {
    const section = page.navGroup || "API Reference";
    if (!sections[section]) sections[section] = [];
    sections[section].push(page);
  }
  return sections;
}

// ─── Navigation ─────────────────────────────────────────────────────────────

export function renderNavYaml(items: NavigationItem[], depth: number): string {
  const indent = "  ".repeat(depth);
  let yaml = "";

  for (const item of items) {
    if (item.children && item.children.length > 0) {
      yaml += `${indent}  - "${item.title}":\n`;
      yaml += renderNavYaml(item.children, depth + 1);
    } else if (item.path) {
      yaml += `${indent}  - "${item.title}": ${item.path}\n`;
    }
  }

  return yaml;
}

// ─── Package Manager Detection ──────────────────────────────────────────────

export function detectPackageManager(modules: ModuleInfo[]): PackageManager {
  const allPaths = modules.map((m) => m.filePath);

  // Check for specific config files that indicate the project type
  const hasPackageJson = allPaths.some((p) => p === "package.json" || p.endsWith("/package.json"));
  const hasGoMod = allPaths.some((p) => p === "go.mod" || p.endsWith("/go.mod"));
  const hasCargoToml = allPaths.some((p) => p === "Cargo.toml" || p.endsWith("/Cargo.toml"));
  const hasRequirementsTxt = allPaths.some((p) => p === "requirements.txt" || p.endsWith("/requirements.txt"));
  const hasPyprojectToml = allPaths.some((p) => p === "pyproject.toml" || p.endsWith("/pyproject.toml"));
  const hasGemfile = allPaths.some((p) => p === "Gemfile" || p.endsWith("/Gemfile"));
  const hasMakefile = allPaths.some((p) => p === "Makefile" || p.endsWith("/Makefile"));

  // Check what languages are present
  const hasGo = allPaths.some((p) => p.endsWith(".go"));
  const hasPython = allPaths.some((p) => p.endsWith(".py"));
  const hasRust = allPaths.some((p) => p.endsWith(".rs"));
  const hasRuby = allPaths.some((p) => p.endsWith(".rb"));
  const hasJS = allPaths.some((p) => p.endsWith(".js") || p.endsWith(".ts") || p.endsWith(".jsx") || p.endsWith(".tsx"));
  const hasHCL = allPaths.some((p) => p.endsWith(".tf") || p.endsWith(".hcl"));
  const hasYAML = allPaths.some((p) => p.endsWith(".yml") || p.endsWith(".yaml"));
  const hasShell = allPaths.some((p) => p.endsWith(".sh") || p.endsWith(".bash"));

  // Prioritize config-file detection over language detection
  if (hasGoMod || (hasGo && !hasJS)) return { id: "go", displayName: "Go" };
  if (hasCargoToml || (hasRust && !hasJS)) return { id: "cargo", displayName: "Cargo" };
  if (hasPyprojectToml) return { id: "poetry", displayName: "Poetry" };
  if (hasRequirementsTxt || (hasPython && !hasJS)) return { id: "pip", displayName: "pip" };
  if (hasGemfile || (hasRuby && !hasJS)) return { id: "bundler", displayName: "Bundler" };
  if (hasPackageJson || hasJS) return { id: "npm", displayName: "npm" };
  if (hasMakefile) return { id: "make", displayName: "Make" };

  // Infrastructure-as-code repos
  if (hasHCL) return { id: "terraform", displayName: "Terraform" };
  if (hasYAML && !hasJS) return { id: "generic", displayName: "generic" };
  if (hasShell) return { id: "generic", displayName: "generic" };

  return { id: "generic", displayName: "generic" };
}

export function getInstallCommand(pm: PackageManager): string {
  switch (pm.id) {
    case "yarn": return "yarn install";
    case "pnpm": return "pnpm install";
    case "go": return "go mod download";
    case "pip": return "pip install -r requirements.txt";
    case "poetry": return "poetry install";
    case "cargo": return "cargo build";
    case "bundler": return "bundle install";
    case "make": return "make";
    case "terraform": return "terraform init";
    case "generic": return "# See project README for setup instructions";
    default: return "npm install";
  }
}

export function getRunCommand(pm: PackageManager): string {
  switch (pm.id) {
    case "yarn": return "yarn";
    case "pnpm": return "pnpm";
    case "go": return "go run .";
    case "pip": return "python";
    case "cargo": return "cargo run";
    default: return "npm run";
  }
}

/**
 * Get alternative install commands for tabbed display (npm/yarn/pnpm).
 * Only returns alternatives for JS-based package managers.
 * Returns null if the project doesn't use a JS package manager.
 */
export function getAlternativeInstallCommands(pm: PackageManager): { label: string; command: string }[] | null {
  const jsManagers = ["npm", "yarn", "pnpm"];
  if (!jsManagers.includes(pm.id)) return null;

  return [
    { label: "npm", command: "npm install" },
    { label: "yarn", command: "yarn install" },
    { label: "pnpm", command: "pnpm install" },
  ];
}

// ─── Directory Tree ─────────────────────────────────────────────────────────

export function generateDirectoryTree(modules: ModuleInfo[]): string {
  // Build a tree of directories with file counts
  const dirFiles = new Map<string, string[]>();
  for (const mod of modules) {
    const parts = mod.filePath.split("/");
    const fileName = parts.pop()!;
    const dir = parts.join("/") || ".";
    if (!dirFiles.has(dir)) dirFiles.set(dir, []);
    dirFiles.get(dir)!.push(fileName);
  }

  // Build tree nodes: directories only, with file counts at leaves
  const allDirs = new Set<string>();
  for (const dir of dirFiles.keys()) {
    const parts = dir.split("/");
    for (let i = 1; i <= parts.length; i++) {
      allDirs.add(parts.slice(0, i).join("/"));
    }
  }

  const sorted = [...allDirs].sort();
  const lines: string[] = [];
  const maxDepth = 3; // Limit depth to keep tree readable

  for (const dir of sorted) {
    const depth = dir.split("/").length - 1;
    if (depth > maxDepth) continue;

    const indent = "  ".repeat(depth);
    const name = dir.split("/").pop()!;
    const files = dirFiles.get(dir);

    if (files) {
      // Leaf directory with files — show count
      if (files.length <= 4) {
        lines.push(`${indent}${name}/`);
        for (const f of files.sort()) {
          lines.push(`${indent}  ${f}`);
        }
      } else {
        lines.push(`${indent}${name}/  (${files.length} files)`);
      }
    } else {
      lines.push(`${indent}${name}/`);
    }
  }

  return lines.join("\n");
}

// ─── Project Name ───────────────────────────────────────────────────────────

/** Resolve a human-readable project name from the manifest, with fallbacks */
export function resolveProjectName(manifest: AnalysisManifest): string {
  const raw = manifest.projectMeta.name;
  if (raw && raw !== ".") return raw;
  // Fall back to repo root basename if available from the repo field
  const repo = manifest.repo;
  if (repo && repo !== ".") {
    const lastSegment = repo.split("/").pop();
    if (lastSegment) return lastSegment;
  }
  return path.basename(process.cwd());
}

// ─── Token Estimation ────────────────────────────────────────────────────────

/** Estimate token count from text length (rough approximation: 1 token ≈ 4 chars). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Mermaid ────────────────────────────────────────────────────────────────

export function sanitizeMermaidId(filePath: string): string {
  return filePath.replace(/[^a-zA-Z0-9]/g, "_");
}

// ─── Language & Badge Helpers ───────────────────────────────────────────────

export function getLanguageTag(language: string): string {
  const map: Record<string, string> = {
    typescript: "typescript",
    javascript: "javascript",
    python: "python",
    go: "go",
    rust: "rust",
    java: "java",
    csharp: "csharp",
    ruby: "ruby",
    php: "php",
    swift: "swift",
    kotlin: "kotlin",
    scala: "scala",
    elixir: "elixir",
    dart: "dart",
    lua: "lua",
    zig: "zig",
    haskell: "haskell",
    c: "c",
    cpp: "cpp",
  };
  return map[language] || language;
}

export function getKindBadge(kind: string): string {
  const badges: Record<string, string> = {
    function: ":material-function: function",
    class: ":material-cube-outline: class",
    interface: ":material-shape-outline: interface",
    type: ":material-tag: type",
    enum: ":material-format-list-bulleted: enum",
    constant: ":material-alpha-c-circle: constant",
    variable: ":material-variable: variable",
    method: ":material-function-variant: method",
    property: ":material-code-braces: property",
    module: ":material-package-variant: module",
    namespace: ":material-folder-outline: namespace",
  };
  return badges[kind] || kind;
}

// ─── Conventional Commits ───────────────────────────────────────────────────

export function parseConventionalType(message: string): string {
  const match = message.match(/^(feat|fix|docs|refactor|test|chore|perf|ci|style|build)(\([^)]*\))?:/);
  return match ? match[1] : "other";
}

// ─── Symbol Cross-Reference Map ─────────────────────────────────────────────

// ─── Try Mode Upsell ─────────────────────────────────────────────────────

/**
 * Append an upsell banner to a page's content for try-mode builds.
 */
export function appendTryUpsell(content: string, totalModules: number): string {
  return content + `

!!! tip "Unlock Full Documentation"
    This is a preview. DocWalk Pro includes complete API reference for all ${totalModules} modules,
    AI-powered narratives, end-user guides, and more.
`;
}

// ─── Module Page Filter ──────────────────────────────────────────────────────

/**
 * Determine whether a module should get its own API reference page.
 * Filters out config/meta files, lockfiles, shell scripts, and trivial barrel files.
 */
export function shouldGenerateModulePage(mod: ModuleInfo): boolean {
  const basename = mod.filePath.split("/").pop()?.toLowerCase() || "";
  const ext = basename.slice(basename.lastIndexOf("."));

  // Skip config/meta files that aren't real source code
  const SKIP_BASENAMES = new Set([
    "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
    "tsconfig.json", "tsconfig.node.json", "tsconfig.preload.json",
    "postcss.config.js", "tailwind.config.ts", "tailwind.config.js",
    "vite.config.ts", "vite.config.js",
    "eslint.config.js", ".eslintrc.js", "jest.config.ts", "vitest.config.ts",
    "electron-builder-update.yml", "manifest.json",
    "pyproject.toml",
  ]);
  if (SKIP_BASENAMES.has(basename)) return false;

  // Skip non-source extensions (JSON, YAML, TOML, lockfiles, shell scripts)
  const SKIP_EXTENSIONS = new Set([".json", ".yaml", ".yml", ".toml", ".lock", ".sh", ".bash", ".zsh"]);
  if (SKIP_EXTENSIONS.has(ext)) return false;

  // Skip root-level markdown docs (README, CLAUDE_CONTEXT, etc.)
  // but keep markdown inside source directories (e.g. docs/knowledge/)
  if (ext === ".md") {
    const depth = mod.filePath.split("/").length;
    if (depth <= 2 || mod.filePath.includes("docs/plans/")) return false;
  }

  // Skip trivial barrel files (tiny files with 0 exported symbols)
  if (mod.lineCount <= 10 && mod.symbols.filter(s => s.exported).length === 0) return false;

  // Skip files where all exports are re-exports and no own symbols
  if (mod.exports.length > 0 && mod.exports.every(e => e.isReExport) && mod.symbols.length === 0) return false;

  return true;
}

export function buildSymbolPageMap(modules: ModuleInfo[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const mod of modules) {
    const slug = mod.filePath.replace(/\.[^.]+$/, "");
    const pagePath = `api/${slug}.md`;
    for (const sym of mod.symbols) {
      if (sym.exported && (sym.kind === "interface" || sym.kind === "type" || sym.kind === "class" || sym.kind === "enum")) {
        map.set(sym.name, pagePath);
      }
    }
  }
  return map;
}

// ─── Symbol Rendering ───────────────────────────────────────────────────────

/** Replace type names with links to their pages if found in the symbol map */
export function renderTypeWithLinks(typeStr: string, symbolPageMap?: Map<string, string>): string {
  if (!symbolPageMap || symbolPageMap.size === 0) return `\`${typeStr}\``;

  let result = typeStr;
  for (const [symName, pagePath] of symbolPageMap) {
    // Only replace whole-word matches
    const regex = new RegExp(`\\b${symName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (regex.test(result)) {
      const symAnchor = symName.toLowerCase().replace(/[^a-z0-9-_]/g, "");
      result = result.replace(regex, `[${symName}](../${pagePath}#${symAnchor})`);
      break; // Link the first match only to keep it readable
    }
  }
  if (result !== typeStr) return result;
  return `\`${typeStr}\``;
}

export function renderSymbol(sym: Symbol, langTag: string, opts?: RenderSymbolOptions): string {
  const anchor = sym.name.toLowerCase().replace(/[^a-z0-9-_]/g, "");

  // Badges for async/generator/static
  const badges: string[] = [];
  if (sym.async) badges.push(":material-sync: async");
  if (sym.generator) badges.push(":material-repeat: generator");
  if (sym.visibility === "protected") badges.push(":material-shield-half-full: protected");

  // attr_list { #id } MUST be at end of heading line
  let md = `### \`${sym.name}\``;
  if (badges.length > 0) md += ` ${badges.join(" · ")}`;
  md += ` { #${anchor} }`;
  md += "\n\n";

  // Decorators
  if (sym.decorators && sym.decorators.length > 0) {
    const hasDeprecated = sym.decorators.some((d) => d.toLowerCase().includes("deprecated"));
    for (const dec of sym.decorators) {
      if (!dec.toLowerCase().includes("deprecated")) {
        md += `\`@${dec}\` `;
      }
    }
    if (sym.decorators.some((d) => !d.toLowerCase().includes("deprecated"))) {
      md += "\n\n";
    }
    if (hasDeprecated && !sym.docs?.deprecated) {
      md += `!!! warning "Deprecated"\n    This symbol is deprecated.\n\n`;
    }
  }

  // Deprecation warning (from docs)
  if (sym.docs?.deprecated) {
    md += `!!! warning "Deprecated"\n    ${typeof sym.docs.deprecated === "string" ? sym.docs.deprecated : "This API is deprecated."}\n\n`;
  }

  // Signature with proper language tag
  if (sym.signature) {
    md += `\`\`\`${langTag}\n${sym.signature}\n\`\`\`\n\n`;
  }

  // Source link
  if (opts?.sourceLinks && opts.repoUrl && sym.location?.line) {
    const filePath = sym.location.file;
    const branch = opts.branch || "main";
    const lineRange = sym.location.endLine
      ? `#L${sym.location.line}-L${sym.location.endLine}`
      : `#L${sym.location.line}`;
    md += `:material-github: [View source](https://github.com/${opts.repoUrl}/blob/${branch}/${filePath}${lineRange})\n\n`;
  }

  // Summary
  if (sym.docs?.summary) {
    md += `${sym.docs.summary}\n\n`;
  }

  // Extended description
  if (sym.docs?.description && sym.docs.description !== sym.docs.summary) {
    md += `${sym.docs.description}\n\n`;
  }

  // AI-generated summary
  if (sym.aiSummary && !sym.docs?.summary) {
    md += `${sym.aiSummary}\n\n`;
  }

  // Class hierarchy
  if (sym.kind === "class" && (sym.extends || (sym.implements && sym.implements.length > 0))) {
    md += `**Hierarchy:**\n\n\`\`\`mermaid\nclassDiagram\n`;
    if (sym.extends) {
      md += `    ${sanitizeMermaidId(sym.extends)} <|-- ${sanitizeMermaidId(sym.name)}\n`;
    }
    if (sym.implements) {
      for (const iface of sym.implements) {
        md += `    ${sanitizeMermaidId(iface)} <|.. ${sanitizeMermaidId(sym.name)}\n`;
      }
    }
    md += `\`\`\`\n\n`;
  }

  // Parameters (prefer extracted params, fall back to JSDoc)
  if (sym.parameters && sym.parameters.length > 0) {
    if (sym.parameters.length > 5) {
      // Collapsible for large parameter tables
      md += `??? info "Parameters (${sym.parameters.length})"\n\n`;
      md += `    | Name | Type | Default | Description |\n`;
      md += `    |------|------|---------|-------------|\n`;
      for (const param of sym.parameters) {
        const docDesc = sym.docs?.params?.[param.name] || param.description || "";
        const opt = param.optional ? "?" : "";
        const def = param.defaultValue ? `\`${param.defaultValue}\`` : "";
        const typeStr = renderTypeWithLinks(param.type || "unknown", opts?.symbolPageMap);
        md += `    | \`${param.name}${opt}\` | ${typeStr} | ${def} | ${docDesc} |\n`;
      }
      md += "\n";
    } else {
      md += `**Parameters:**\n\n`;
      md += `| Name | Type | Default | Description |\n`;
      md += `|------|------|---------|-------------|\n`;
      for (const param of sym.parameters) {
        const docDesc = sym.docs?.params?.[param.name] || param.description || "";
        const opt = param.optional ? "?" : "";
        const def = param.defaultValue ? `\`${param.defaultValue}\`` : "";
        const typeStr = renderTypeWithLinks(param.type || "unknown", opts?.symbolPageMap);
        md += `| \`${param.name}${opt}\` | ${typeStr} | ${def} | ${docDesc} |\n`;
      }
      md += "\n";
    }
  } else if (sym.docs?.params) {
    md += `**Parameters:**\n\n`;
    md += `| Name | Description |\n`;
    md += `|------|-------------|\n`;
    for (const [name, desc] of Object.entries(sym.docs.params)) {
      md += `| \`${name}\` | ${desc} |\n`;
    }
    md += "\n";
  }

  // Return type
  if (sym.returns?.type || sym.docs?.returns) {
    const retType = sym.returns?.type ? renderTypeWithLinks(sym.returns.type, opts?.symbolPageMap) : "";
    md += `**Returns:** ${retType} ${sym.docs?.returns || ""}\n\n`;
  }

  // Example blocks
  if (sym.docs?.examples && sym.docs.examples.length > 0) {
    for (const example of sym.docs.examples) {
      md += `**Example:**\n\n\`\`\`${langTag}\n${example}\n\`\`\`\n\n`;
    }
  }

  // Since tag
  if (sym.docs?.since) {
    md += `*Since: ${sym.docs.since}*\n\n`;
  }

  md += "---\n\n";
  return md;
}
