// src/generators/utils.ts
import path from "path";
var LOGICAL_SECTIONS = {
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
  "Database": ["database", "db", "repositories", "dao"]
};
function groupModulesLogically(modules) {
  const groups = {};
  for (const mod of modules) {
    const section = detectLogicalSection(mod.filePath);
    if (!groups[section]) groups[section] = [];
    groups[section].push(mod);
  }
  return groups;
}
function detectLogicalSection(filePath) {
  const parts = filePath.toLowerCase().split("/");
  for (const [section, keywords] of Object.entries(LOGICAL_SECTIONS)) {
    for (const part of parts) {
      if (keywords.includes(part)) return section;
    }
  }
  const dirParts = filePath.split("/");
  if (dirParts.length > 1) {
    const dir = dirParts[dirParts.length - 2];
    return dir.charAt(0).toUpperCase() + dir.slice(1);
  }
  return "API Reference";
}
function groupByLogicalSection(pages) {
  const sections = {};
  for (const page of pages) {
    const section = page.navGroup || "API Reference";
    if (!sections[section]) sections[section] = [];
    sections[section].push(page);
  }
  return sections;
}
function renderNavYaml(items, depth) {
  const indent = "  ".repeat(depth);
  let yaml = "";
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      yaml += `${indent}  - "${item.title}":
`;
      yaml += renderNavYaml(item.children, depth + 1);
    } else if (item.path) {
      yaml += `${indent}  - "${item.title}": ${item.path}
`;
    }
  }
  return yaml;
}
function detectPackageManager(modules) {
  const allPaths = modules.map((m) => m.filePath);
  const hasPackageJson = allPaths.some((p) => p === "package.json" || p.endsWith("/package.json"));
  const hasGoMod = allPaths.some((p) => p === "go.mod" || p.endsWith("/go.mod"));
  const hasCargoToml = allPaths.some((p) => p === "Cargo.toml" || p.endsWith("/Cargo.toml"));
  const hasRequirementsTxt = allPaths.some((p) => p === "requirements.txt" || p.endsWith("/requirements.txt"));
  const hasPyprojectToml = allPaths.some((p) => p === "pyproject.toml" || p.endsWith("/pyproject.toml"));
  const hasGemfile = allPaths.some((p) => p === "Gemfile" || p.endsWith("/Gemfile"));
  const hasMakefile = allPaths.some((p) => p === "Makefile" || p.endsWith("/Makefile"));
  const hasGo = allPaths.some((p) => p.endsWith(".go"));
  const hasPython = allPaths.some((p) => p.endsWith(".py"));
  const hasRust = allPaths.some((p) => p.endsWith(".rs"));
  const hasRuby = allPaths.some((p) => p.endsWith(".rb"));
  const hasJS = allPaths.some((p) => p.endsWith(".js") || p.endsWith(".ts") || p.endsWith(".jsx") || p.endsWith(".tsx"));
  const hasHCL = allPaths.some((p) => p.endsWith(".tf") || p.endsWith(".hcl"));
  const hasYAML = allPaths.some((p) => p.endsWith(".yml") || p.endsWith(".yaml"));
  const hasShell = allPaths.some((p) => p.endsWith(".sh") || p.endsWith(".bash"));
  if (hasGoMod || hasGo && !hasJS) return { id: "go", displayName: "Go" };
  if (hasCargoToml || hasRust && !hasJS) return { id: "cargo", displayName: "Cargo" };
  if (hasPyprojectToml) return { id: "poetry", displayName: "Poetry" };
  if (hasRequirementsTxt || hasPython && !hasJS) return { id: "pip", displayName: "pip" };
  if (hasGemfile || hasRuby && !hasJS) return { id: "bundler", displayName: "Bundler" };
  if (hasPackageJson || hasJS) return { id: "npm", displayName: "npm" };
  if (hasMakefile) return { id: "make", displayName: "Make" };
  if (hasHCL) return { id: "terraform", displayName: "Terraform" };
  if (hasYAML && !hasJS) return { id: "generic", displayName: "generic" };
  if (hasShell) return { id: "generic", displayName: "generic" };
  return { id: "generic", displayName: "generic" };
}
function getInstallCommand(pm) {
  switch (pm.id) {
    case "yarn":
      return "yarn install";
    case "pnpm":
      return "pnpm install";
    case "go":
      return "go mod download";
    case "pip":
      return "pip install -r requirements.txt";
    case "poetry":
      return "poetry install";
    case "cargo":
      return "cargo build";
    case "bundler":
      return "bundle install";
    case "make":
      return "make";
    case "terraform":
      return "terraform init";
    case "generic":
      return "# See project README for setup instructions";
    default:
      return "npm install";
  }
}
function getAlternativeInstallCommands(pm) {
  const jsManagers = ["npm", "yarn", "pnpm"];
  if (!jsManagers.includes(pm.id)) return null;
  return [
    { label: "npm", command: "npm install" },
    { label: "yarn", command: "yarn install" },
    { label: "pnpm", command: "pnpm install" }
  ];
}
function generateDirectoryTree(modules) {
  const dirs = /* @__PURE__ */ new Set();
  for (const mod of modules) {
    const parts = mod.filePath.split("/");
    for (let i = 1; i <= parts.length; i++) {
      dirs.add(parts.slice(0, i).join("/"));
    }
  }
  const sorted = [...dirs].sort();
  return sorted.slice(0, 40).map((d) => {
    const depth = d.split("/").length - 1;
    const indent = "  ".repeat(depth);
    const name = d.split("/").pop();
    const isFile = d.includes(".");
    return `${indent}${isFile ? "" : ""}${name}`;
  }).join("\n");
}
function resolveProjectName(manifest) {
  const raw = manifest.projectMeta.name;
  if (raw && raw !== ".") return raw;
  const repo = manifest.repo;
  if (repo && repo !== ".") {
    const lastSegment = repo.split("/").pop();
    if (lastSegment) return lastSegment;
  }
  return path.basename(process.cwd());
}
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}
function sanitizeMermaidId(filePath) {
  return filePath.replace(/[^a-zA-Z0-9]/g, "_");
}
function getLanguageTag(language) {
  const map = {
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
    cpp: "cpp"
  };
  return map[language] || language;
}
function getKindBadge(kind) {
  const badges = {
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
    namespace: ":material-folder-outline: namespace"
  };
  return badges[kind] || kind;
}
function parseConventionalType(message) {
  const match = message.match(/^(feat|fix|docs|refactor|test|chore|perf|ci|style|build)(\([^)]*\))?:/);
  return match ? match[1] : "other";
}
function buildSymbolPageMap(modules) {
  const map = /* @__PURE__ */ new Map();
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
function renderTypeWithLinks(typeStr, symbolPageMap) {
  if (!symbolPageMap || symbolPageMap.size === 0) return `\`${typeStr}\``;
  let result = typeStr;
  for (const [symName, pagePath] of symbolPageMap) {
    const regex = new RegExp(`\\b${symName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (regex.test(result)) {
      const symAnchor = symName.toLowerCase().replace(/[^a-z0-9-_]/g, "");
      result = result.replace(regex, `[${symName}](../${pagePath}#${symAnchor})`);
      break;
    }
  }
  if (result !== typeStr) return result;
  return `\`${typeStr}\``;
}
function renderSymbol(sym, langTag, opts) {
  const anchor = sym.name.toLowerCase().replace(/[^a-z0-9-_]/g, "");
  const badges = [];
  if (sym.async) badges.push(":material-sync: async");
  if (sym.generator) badges.push(":material-repeat: generator");
  if (sym.visibility === "protected") badges.push(":material-shield-half-full: protected");
  let md = `### \`${sym.name}\``;
  if (badges.length > 0) md += ` ${badges.join(" \xB7 ")}`;
  md += ` { #${anchor} }`;
  md += "\n\n";
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
      md += `!!! warning "Deprecated"
    This symbol is deprecated.

`;
    }
  }
  if (sym.docs?.deprecated) {
    md += `!!! warning "Deprecated"
    ${typeof sym.docs.deprecated === "string" ? sym.docs.deprecated : "This API is deprecated."}

`;
  }
  if (sym.signature) {
    md += `\`\`\`${langTag}
${sym.signature}
\`\`\`

`;
  }
  if (opts?.sourceLinks && opts.repoUrl && sym.location?.line) {
    const filePath = sym.location.file;
    const branch = opts.branch || "main";
    const lineRange = sym.location.endLine ? `#L${sym.location.line}-L${sym.location.endLine}` : `#L${sym.location.line}`;
    md += `:material-github: [View source](https://github.com/${opts.repoUrl}/blob/${branch}/${filePath}${lineRange})

`;
  }
  if (sym.docs?.summary) {
    md += `${sym.docs.summary}

`;
  }
  if (sym.docs?.description && sym.docs.description !== sym.docs.summary) {
    md += `${sym.docs.description}

`;
  }
  if (sym.aiSummary && !sym.docs?.summary) {
    md += `${sym.aiSummary}

`;
  }
  if (sym.kind === "class" && (sym.extends || sym.implements && sym.implements.length > 0)) {
    md += `**Hierarchy:**

\`\`\`mermaid
classDiagram
`;
    if (sym.extends) {
      md += `    ${sanitizeMermaidId(sym.extends)} <|-- ${sanitizeMermaidId(sym.name)}
`;
    }
    if (sym.implements) {
      for (const iface of sym.implements) {
        md += `    ${sanitizeMermaidId(iface)} <|.. ${sanitizeMermaidId(sym.name)}
`;
      }
    }
    md += `\`\`\`

`;
  }
  if (sym.parameters && sym.parameters.length > 0) {
    if (sym.parameters.length > 5) {
      md += `??? info "Parameters (${sym.parameters.length})"

`;
      md += `    | Name | Type | Default | Description |
`;
      md += `    |------|------|---------|-------------|
`;
      for (const param of sym.parameters) {
        const docDesc = sym.docs?.params?.[param.name] || param.description || "";
        const opt = param.optional ? "?" : "";
        const def = param.defaultValue ? `\`${param.defaultValue}\`` : "";
        const typeStr = renderTypeWithLinks(param.type || "unknown", opts?.symbolPageMap);
        md += `    | \`${param.name}${opt}\` | ${typeStr} | ${def} | ${docDesc} |
`;
      }
      md += "\n";
    } else {
      md += `**Parameters:**

`;
      md += `| Name | Type | Default | Description |
`;
      md += `|------|------|---------|-------------|
`;
      for (const param of sym.parameters) {
        const docDesc = sym.docs?.params?.[param.name] || param.description || "";
        const opt = param.optional ? "?" : "";
        const def = param.defaultValue ? `\`${param.defaultValue}\`` : "";
        const typeStr = renderTypeWithLinks(param.type || "unknown", opts?.symbolPageMap);
        md += `| \`${param.name}${opt}\` | ${typeStr} | ${def} | ${docDesc} |
`;
      }
      md += "\n";
    }
  } else if (sym.docs?.params) {
    md += `**Parameters:**

`;
    md += `| Name | Description |
`;
    md += `|------|-------------|
`;
    for (const [name, desc] of Object.entries(sym.docs.params)) {
      md += `| \`${name}\` | ${desc} |
`;
    }
    md += "\n";
  }
  if (sym.returns?.type || sym.docs?.returns) {
    const retType = sym.returns?.type ? renderTypeWithLinks(sym.returns.type, opts?.symbolPageMap) : "";
    md += `**Returns:** ${retType} ${sym.docs?.returns || ""}

`;
  }
  if (sym.docs?.examples && sym.docs.examples.length > 0) {
    for (const example of sym.docs.examples) {
      md += `**Example:**

\`\`\`${langTag}
${example}
\`\`\`

`;
    }
  }
  if (sym.docs?.since) {
    md += `*Since: ${sym.docs.since}*

`;
  }
  md += "---\n\n";
  return md;
}

export {
  LOGICAL_SECTIONS,
  groupModulesLogically,
  detectLogicalSection,
  groupByLogicalSection,
  renderNavYaml,
  detectPackageManager,
  getInstallCommand,
  getAlternativeInstallCommands,
  generateDirectoryTree,
  resolveProjectName,
  estimateTokens,
  sanitizeMermaidId,
  getLanguageTag,
  getKindBadge,
  parseConventionalType,
  buildSymbolPageMap,
  renderSymbol
};
