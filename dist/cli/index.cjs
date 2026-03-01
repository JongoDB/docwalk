#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/utils/logger.ts
function setVerbose(v) {
  verbose = v;
}
function log(level, message) {
  if (level === "debug" && !verbose) return;
  const prefix = PREFIXES[level];
  const coloredMsg = level === "error" ? import_chalk.default.red(message) : level === "warn" ? import_chalk.default.yellow(message) : level === "success" ? import_chalk.default.green(message) : level === "debug" ? import_chalk.default.dim(message) : message;
  console.log(`${prefix} ${coloredMsg}`);
}
function header(text) {
  console.log();
  console.log(import_chalk.default.bold(text));
  console.log(import_chalk.default.dim("\u2500".repeat(Math.min(text.length + 4, 60))));
}
function blank() {
  console.log();
}
function banner() {
  console.log();
  console.log(
    import_chalk.default.hex("#5de4c7").bold("  \u2692  DocWalk") + import_chalk.default.dim(" \u2014 Your codebase, documented.")
  );
  console.log();
}
var import_chalk, PREFIXES, verbose;
var init_logger = __esm({
  "src/utils/logger.ts"() {
    "use strict";
    import_chalk = __toESM(require("chalk"), 1);
    PREFIXES = {
      debug: import_chalk.default.dim("  \u283F"),
      info: import_chalk.default.blue("  \u2139"),
      warn: import_chalk.default.yellow("  \u26A0"),
      error: import_chalk.default.red("  \u2717"),
      success: import_chalk.default.green("  \u2713")
    };
    verbose = false;
  }
});

// src/utils/secrets.ts
async function saveProjectApiKey(provider, key) {
  const dir = import_path.default.resolve(DOCWALK_DIR);
  await (0, import_promises.mkdir)(dir, { recursive: true });
  const envPath = import_path.default.join(dir, ENV_FILE);
  const envVar = PROVIDER_ENV_VARS[provider] || "DOCWALK_AI_KEY";
  let content = "";
  try {
    content = await (0, import_promises.readFile)(envPath, "utf-8");
  } catch {
  }
  const lines = content.split("\n").filter((l) => l.trim() !== "");
  const idx = lines.findIndex((l) => l.startsWith(`${envVar}=`));
  const newLine = `${envVar}=${key}`;
  if (idx >= 0) {
    lines[idx] = newLine;
  } else {
    lines.push(newLine);
  }
  await (0, import_promises.writeFile)(envPath, lines.join("\n") + "\n", { mode: 384 });
}
async function loadProjectEnv() {
  const envPath = import_path.default.resolve(DOCWALK_DIR, ENV_FILE);
  let content;
  try {
    content = await (0, import_promises.readFile)(envPath, "utf-8");
  } catch {
    return;
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const name = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[name]) {
      process.env[name] = value;
    }
  }
}
var import_promises, import_path, DOCWALK_DIR, ENV_FILE, PROVIDER_ENV_VARS;
var init_secrets = __esm({
  "src/utils/secrets.ts"() {
    "use strict";
    import_promises = require("fs/promises");
    import_path = __toESM(require("path"), 1);
    DOCWALK_DIR = ".docwalk";
    ENV_FILE = ".env";
    PROVIDER_ENV_VARS = {
      anthropic: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY",
      gemini: "GEMINI_API_KEY",
      openrouter: "OPENROUTER_API_KEY"
    };
  }
});

// src/analysis/providers/base.ts
function buildModuleSummaryPrompt(module2, fileContent) {
  const symbolList = module2.symbols.filter((s) => s.exported).map((s) => `- ${s.kind} ${s.name}${s.docs?.summary ? `: ${s.docs.summary}` : ""}`).join("\n");
  return `You are a technical documentation assistant. Summarize this source file in 2-3 sentences for a documentation site. Focus on what the module does and its role in the project. Be concise and precise.

File: ${module2.filePath}
Language: ${module2.language}
Exported symbols:
${symbolList || "(none)"}

File content (truncated):
\`\`\`
${fileContent.split("\n").slice(0, 80).join("\n")}
\`\`\`

Write only the summary, no preamble.`;
}
function buildSymbolSummaryPrompt(symbol, fileContent, filePath) {
  const lines = fileContent.split("\n");
  const startLine = symbol.location.line - 1;
  const endLine = symbol.location.endLine ? symbol.location.endLine : Math.min(startLine + 30, lines.length);
  const snippet = lines.slice(startLine, endLine).join("\n");
  return `You are a technical documentation assistant. Write a brief 1-2 sentence summary for this ${symbol.kind}. Focus on what it does and when to use it.

File: ${filePath}
Symbol: ${symbol.name} (${symbol.kind})
${symbol.parameters ? `Parameters: ${symbol.parameters.map((p) => p.name).join(", ")}` : ""}
${symbol.returns?.type ? `Returns: ${symbol.returns.type}` : ""}

Code:
\`\`\`
${snippet}
\`\`\`

Write only the summary, no preamble.`;
}
var init_base = __esm({
  "src/analysis/providers/base.ts"() {
    "use strict";
  }
});

// src/analysis/providers/anthropic.ts
var AnthropicProvider;
var init_anthropic = __esm({
  "src/analysis/providers/anthropic.ts"() {
    "use strict";
    init_base();
    AnthropicProvider = class {
      name = "Anthropic Claude";
      model;
      apiKey;
      _client;
      constructor(apiKey, model) {
        this.apiKey = apiKey;
        this.model = model || "claude-sonnet-4-20250514";
      }
      async getClient() {
        if (!this._client) {
          const { default: Anthropic } = await import("@anthropic-ai/sdk");
          this._client = new Anthropic({ apiKey: this.apiKey });
        }
        return this._client;
      }
      async summarizeModule(module2, fileContent) {
        return this.callAPI(buildModuleSummaryPrompt(module2, fileContent));
      }
      async summarizeSymbol(symbol, fileContent, filePath) {
        return this.callAPI(buildSymbolSummaryPrompt(symbol, fileContent, filePath));
      }
      async generate(prompt, options) {
        return this.callAPI(prompt, options);
      }
      async callAPI(prompt, options) {
        const client = await this.getClient();
        const messages = [
          { role: "user", content: prompt }
        ];
        const response = await client.messages.create({
          model: this.model,
          max_tokens: options?.maxTokens ?? 256,
          ...options?.systemPrompt ? { system: options.systemPrompt } : {},
          ...options?.temperature !== void 0 ? { temperature: options.temperature } : {},
          messages
        });
        const block = response.content[0];
        if (block.type === "text") {
          return block.text.trim();
        }
        return "";
      }
    };
  }
});

// src/analysis/providers/openai.ts
var OpenAIProvider;
var init_openai = __esm({
  "src/analysis/providers/openai.ts"() {
    "use strict";
    init_base();
    OpenAIProvider = class {
      name = "OpenAI GPT";
      model;
      apiKey;
      baseURL;
      _client;
      constructor(apiKey, model, baseURL) {
        this.apiKey = apiKey;
        this.model = model || "gpt-4o-mini";
        this.baseURL = baseURL;
      }
      async getClient() {
        if (!this._client) {
          const { default: OpenAI } = await import("openai");
          this._client = new OpenAI({
            apiKey: this.apiKey,
            ...this.baseURL ? { baseURL: this.baseURL } : {}
          });
        }
        return this._client;
      }
      async summarizeModule(module2, fileContent) {
        return this.generate(buildModuleSummaryPrompt(module2, fileContent));
      }
      async summarizeSymbol(symbol, fileContent, filePath) {
        return this.generate(buildSymbolSummaryPrompt(symbol, fileContent, filePath));
      }
      async generate(prompt, options) {
        const client = await this.getClient();
        const messages = [];
        if (options?.systemPrompt) {
          messages.push({ role: "system", content: options.systemPrompt });
        }
        messages.push({ role: "user", content: prompt });
        const response = await client.chat.completions.create({
          model: this.model,
          max_tokens: options?.maxTokens ?? 256,
          ...options?.temperature !== void 0 ? { temperature: options.temperature } : {},
          messages
        });
        return response.choices[0]?.message?.content?.trim() || "";
      }
    };
  }
});

// src/analysis/providers/gemini.ts
var GeminiProvider;
var init_gemini = __esm({
  "src/analysis/providers/gemini.ts"() {
    "use strict";
    init_base();
    GeminiProvider = class {
      name = "Google Gemini";
      model;
      apiKey;
      _genAI;
      constructor(apiKey, model) {
        this.apiKey = apiKey;
        this.model = model || "gemini-2.5-flash";
      }
      async getGenAI() {
        if (!this._genAI) {
          const { GoogleGenerativeAI } = await import("@google/generative-ai");
          this._genAI = new GoogleGenerativeAI(this.apiKey);
        }
        return this._genAI;
      }
      async summarizeModule(module2, fileContent) {
        return this.generate(buildModuleSummaryPrompt(module2, fileContent));
      }
      async summarizeSymbol(symbol, fileContent, filePath) {
        return this.generate(buildSymbolSummaryPrompt(symbol, fileContent, filePath));
      }
      async generate(prompt, options) {
        const genAI = await this.getGenAI();
        const model = genAI.getGenerativeModel({
          model: this.model,
          generationConfig: {
            maxOutputTokens: options?.maxTokens ?? 256,
            ...options?.temperature !== void 0 ? { temperature: options.temperature } : {}
          },
          ...options?.systemPrompt ? { systemInstruction: options.systemPrompt } : {}
        });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
      }
    };
  }
});

// src/analysis/providers/ollama.ts
var DEFAULT_OLLAMA_BASE_URL, OllamaProvider;
var init_ollama = __esm({
  "src/analysis/providers/ollama.ts"() {
    "use strict";
    init_openai();
    DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";
    OllamaProvider = class extends OpenAIProvider {
      name = "Ollama (Local)";
      constructor(model, baseURL) {
        super("ollama", model || "llama3.2", baseURL || DEFAULT_OLLAMA_BASE_URL);
      }
    };
  }
});

// src/analysis/providers/openrouter.ts
var OPENROUTER_BASE_URL, OpenRouterProvider;
var init_openrouter = __esm({
  "src/analysis/providers/openrouter.ts"() {
    "use strict";
    init_openai();
    OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
    OpenRouterProvider = class extends OpenAIProvider {
      name = "OpenRouter";
      constructor(apiKey, model) {
        super(apiKey, model || "anthropic/claude-3.5-sonnet", OPENROUTER_BASE_URL);
      }
    };
  }
});

// src/analysis/providers/docwalk-proxy.ts
var DEFAULT_BASE_URL, DocWalkProxyProvider;
var init_docwalk_proxy = __esm({
  "src/analysis/providers/docwalk-proxy.ts"() {
    "use strict";
    init_base();
    DEFAULT_BASE_URL = "https://docwalk-ai-proxy.jonathanrannabargar.workers.dev";
    DocWalkProxyProvider = class {
      name = "DocWalk Proxy (Gemini Flash)";
      baseURL;
      constructor(baseURL) {
        this.baseURL = (baseURL || DEFAULT_BASE_URL).replace(/\/+$/, "");
      }
      async summarizeModule(module2, fileContent) {
        return this.generate(buildModuleSummaryPrompt(module2, fileContent));
      }
      async summarizeSymbol(symbol, fileContent, filePath) {
        return this.generate(buildSymbolSummaryPrompt(symbol, fileContent, filePath));
      }
      async generate(prompt, options) {
        const res = await fetch(`${this.baseURL}/v1/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            maxTokens: options?.maxTokens,
            temperature: options?.temperature,
            systemPrompt: options?.systemPrompt
          })
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`DocWalk proxy error (${res.status}): ${body}`);
        }
        const data = await res.json();
        return data.text.trim();
      }
    };
  }
});

// src/analysis/providers/index.ts
var providers_exports = {};
__export(providers_exports, {
  AnthropicProvider: () => AnthropicProvider,
  DocWalkProxyProvider: () => DocWalkProxyProvider,
  GeminiProvider: () => GeminiProvider,
  OllamaProvider: () => OllamaProvider,
  OpenAIProvider: () => OpenAIProvider,
  OpenRouterProvider: () => OpenRouterProvider,
  createProvider: () => createProvider,
  createProxyFallback: () => createProxyFallback,
  resolveApiKey: () => resolveApiKey
});
function resolveApiKey(providerName, configuredEnvVar) {
  const fromConfigured = process.env[configuredEnvVar];
  if (fromConfigured) return fromConfigured;
  if (configuredEnvVar !== "DOCWALK_AI_KEY") {
    const fromUniversal = process.env.DOCWALK_AI_KEY;
    if (fromUniversal) return fromUniversal;
  }
  const wellKnown = WELL_KNOWN_ENV_VARS[providerName];
  if (wellKnown) {
    for (const envVar of wellKnown) {
      if (envVar === configuredEnvVar) continue;
      const val = process.env[envVar];
      if (val) return val;
    }
  }
  return void 0;
}
function createProvider(config) {
  const apiKey = resolveApiKey(config.name, config.api_key_env);
  switch (config.name) {
    case "anthropic": {
      if (!apiKey) return void 0;
      return new AnthropicProvider(apiKey, config.model);
    }
    case "openai": {
      if (!apiKey) return void 0;
      return new OpenAIProvider(apiKey, config.model, config.base_url);
    }
    case "gemini": {
      if (!apiKey) return void 0;
      return new GeminiProvider(apiKey, config.model);
    }
    case "ollama": {
      return new OllamaProvider(config.model, config.base_url || void 0);
    }
    case "openrouter": {
      if (!apiKey) return void 0;
      return new OpenRouterProvider(apiKey, config.model);
    }
    case "local": {
      return new OllamaProvider(config.model, config.base_url || void 0);
    }
    case "docwalk-proxy": {
      return new DocWalkProxyProvider(config.base_url || void 0);
    }
    default:
      return void 0;
  }
}
function createProxyFallback(baseURL) {
  return new DocWalkProxyProvider(baseURL);
}
var WELL_KNOWN_ENV_VARS;
var init_providers = __esm({
  "src/analysis/providers/index.ts"() {
    "use strict";
    init_anthropic();
    init_openai();
    init_gemini();
    init_ollama();
    init_openrouter();
    init_docwalk_proxy();
    init_anthropic();
    init_openai();
    init_gemini();
    init_ollama();
    init_openrouter();
    init_docwalk_proxy();
    WELL_KNOWN_ENV_VARS = {
      anthropic: ["ANTHROPIC_API_KEY"],
      openai: ["OPENAI_API_KEY"],
      gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
      openrouter: ["OPENROUTER_API_KEY"]
    };
  }
});

// src/cli/flows/ai-setup.ts
async function runAISetup() {
  const { enableAI } = await import_inquirer.default.prompt([
    {
      type: "confirm",
      name: "enableAI",
      message: "Enable AI-powered documentation? (summaries, narratives, diagrams)",
      default: true
    }
  ]);
  if (!enableAI) {
    return { enabled: false };
  }
  const { provider } = await import_inquirer.default.prompt([
    {
      type: "list",
      name: "provider",
      message: "AI provider:",
      choices: PROVIDER_CHOICES
    }
  ]);
  if (provider === "ollama" || provider === "docwalk-proxy") {
    return {
      enabled: true,
      providerName: provider,
      model: DEFAULT_MODELS[provider]
    };
  }
  const envVar = ENV_VAR_NAMES[provider];
  const existingKey = resolveApiKey(provider, envVar);
  if (existingKey) {
    log("success", `Found existing ${import_chalk2.default.cyan(envVar)} in environment`);
    return {
      enabled: true,
      providerName: provider,
      model: DEFAULT_MODELS[provider],
      keyStored: false
    };
  }
  const keyUrl = KEY_URLS[provider];
  if (keyUrl) {
    blank();
    console.log(`  Get your API key: ${import_chalk2.default.cyan.underline(keyUrl)}`);
    blank();
  }
  const { apiKey } = await import_inquirer.default.prompt([
    {
      type: "password",
      name: "apiKey",
      message: `${envVar}:`,
      mask: "*",
      validate: (input) => input.length > 0 || "API key is required"
    }
  ]);
  const spinner = (0, import_ora.default)("Validating API key...").start();
  try {
    await validateApiKey(provider, apiKey);
    spinner.succeed("API key is valid");
  } catch (err) {
    spinner.fail(`API key validation failed: ${err.message || "unknown error"}`);
    const { fallback } = await import_inquirer.default.prompt([
      {
        type: "list",
        name: "fallback",
        message: "What would you like to do?",
        choices: [
          { name: "Try a different key", value: "retry" },
          { name: "Save anyway (skip validation)", value: "save" },
          { name: "Use DocWalk free tier instead", value: "proxy" }
        ]
      }
    ]);
    if (fallback === "retry") {
      return runAISetup();
    }
    if (fallback === "proxy") {
      return {
        enabled: true,
        providerName: "docwalk-proxy",
        model: DEFAULT_MODELS["docwalk-proxy"]
      };
    }
  }
  await saveProjectApiKey(provider, apiKey);
  log("success", `API key saved to ${import_chalk2.default.dim(".docwalk/.env")}`);
  return {
    enabled: true,
    providerName: provider,
    model: DEFAULT_MODELS[provider],
    keyStored: true
  };
}
async function validateApiKey(provider, apiKey) {
  switch (provider) {
    case "gemini": {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { maxOutputTokens: 10 }
      });
      await model.generateContent("Say hi");
      break;
    }
    case "anthropic": {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say hi" }]
      });
      break;
    }
    case "openai": {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey });
      await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say hi" }]
      });
      break;
    }
    case "openrouter": {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1"
      });
      await client.chat.completions.create({
        model: "google/gemini-2.5-flash",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say hi" }]
      });
      break;
    }
    default:
      break;
  }
}
var import_inquirer, import_chalk2, import_ora, PROVIDER_CHOICES, KEY_URLS, ENV_VAR_NAMES, DEFAULT_MODELS;
var init_ai_setup = __esm({
  "src/cli/flows/ai-setup.ts"() {
    "use strict";
    import_inquirer = __toESM(require("inquirer"), 1);
    import_chalk2 = __toESM(require("chalk"), 1);
    import_ora = __toESM(require("ora"), 1);
    init_logger();
    init_secrets();
    init_providers();
    PROVIDER_CHOICES = [
      { name: "Google Gemini    \u2014 free tier, fast, great for docs", value: "gemini" },
      { name: "Anthropic Claude \u2014 best quality, requires API key", value: "anthropic" },
      { name: "OpenAI GPT      \u2014 widely available", value: "openai" },
      { name: "OpenRouter       \u2014 multi-model gateway", value: "openrouter" },
      { name: "Local / Ollama   \u2014 no API key, runs locally", value: "ollama" },
      { name: "Skip             \u2014 use DocWalk free tier (Gemini Flash)", value: "docwalk-proxy" }
    ];
    KEY_URLS = {
      gemini: "https://aistudio.google.com/app/apikey",
      anthropic: "https://console.anthropic.com/settings/keys",
      openai: "https://platform.openai.com/api-keys",
      openrouter: "https://openrouter.ai/keys"
    };
    ENV_VAR_NAMES = {
      gemini: "GEMINI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY",
      openrouter: "OPENROUTER_API_KEY"
    };
    DEFAULT_MODELS = {
      gemini: "gemini-2.5-flash",
      anthropic: "claude-sonnet-4-6",
      openai: "gpt-4o-mini",
      openrouter: "google/gemini-2.5-flash",
      ollama: "llama3.2"
    };
  }
});

// src/config/schema.ts
var import_zod, SourceSchema, AnalysisSchema, SyncSchema, DeploySchema, DomainSchema, ThemeSchema, VersioningSchema, PluginSchema, HooksSchema, DocWalkConfigSchema;
var init_schema = __esm({
  "src/config/schema.ts"() {
    "use strict";
    import_zod = require("zod");
    SourceSchema = import_zod.z.object({
      /** GitHub/GitLab/Bitbucket repo in owner/name format, or local path */
      repo: import_zod.z.string().describe("Repository identifier (owner/repo) or local path"),
      /** Branch to track for documentation */
      branch: import_zod.z.string().default("main"),
      /** Glob patterns for files to include in analysis */
      include: import_zod.z.array(import_zod.z.string()).default([
        "**/*.ts",
        "**/*.tsx",
        "**/*.js",
        "**/*.jsx",
        "**/*.py",
        "**/*.pyi",
        "**/*.go",
        "**/*.rs",
        "**/*.java",
        "**/*.cs",
        "**/*.rb",
        "**/*.php",
        "**/*.sh",
        "**/*.bash",
        "**/*.yaml",
        "**/*.yml",
        "**/*.tf",
        "**/*.hcl",
        "**/*.md",
        "**/*.json",
        "**/*.toml",
        "**/*.xml",
        "**/*.sql",
        "**/*.dockerfile",
        "**/Dockerfile",
        "**/*.c",
        "**/*.h",
        "**/*.cpp",
        "**/*.hpp",
        "**/*.cc",
        "**/*.cxx",
        "**/*.swift",
        "**/*.kt",
        "**/*.kts",
        "**/*.scala"
      ]),
      /** Glob patterns for files to exclude from analysis */
      exclude: import_zod.z.array(import_zod.z.string()).default([
        "node_modules/**",
        "dist/**",
        "build/**",
        "out/**",
        ".git/**",
        ".next/**",
        ".nuxt/**",
        ".output/**",
        "vendor/**",
        "__pycache__/**",
        "venv/**",
        ".venv/**",
        "env/**",
        "target/**",
        "**/*.test.*",
        "**/*.spec.*",
        "**/__tests__/**",
        "**/test/**",
        "**/tests/**",
        "coverage/**",
        ".docwalk/**",
        "docwalk-output/**",
        "site/**",
        "**/*.d.ts",
        "**/*.min.js",
        "**/migrations/**"
      ]),
      /** Language detection mode — 'auto' detects from file extensions */
      languages: import_zod.z.union([import_zod.z.literal("auto"), import_zod.z.array(import_zod.z.string())]).default("auto"),
      /** Remote provider type for API-based repo access */
      provider: import_zod.z.enum(["github", "gitlab", "bitbucket", "local"]).default("github")
    });
    AnalysisSchema = import_zod.z.object({
      /**
       * Analysis depth:
       * - full: AST parsing, cross-refs, dependency graphs, everything
       * - surface: File-level overview, exports, top-level docs
       * - api-only: Only public API surface (exports, types, interfaces)
       */
      depth: import_zod.z.enum(["full", "surface", "api-only"]).default("full"),
      /** Enable AI-powered summaries for modules and functions */
      ai_summaries: import_zod.z.boolean().default(false),
      /** AI provider for summaries and narrative generation */
      ai_provider: import_zod.z.object({
        name: import_zod.z.enum(["openai", "anthropic", "gemini", "ollama", "openrouter", "local", "docwalk-proxy"]).default("anthropic"),
        model: import_zod.z.string().optional(),
        api_key_env: import_zod.z.string().default("DOCWALK_AI_KEY").describe("Environment variable name holding the API key"),
        base_url: import_zod.z.string().optional().describe("Custom base URL for the provider (e.g., Ollama endpoint)")
      }).optional(),
      /** Generate dependency graph visualization */
      dependency_graph: import_zod.z.boolean().default(true),
      /** Auto-generate changelog from git history */
      changelog: import_zod.z.boolean().default(true),
      /** Max number of git log entries for changelog */
      changelog_depth: import_zod.z.number().int().positive().default(100),
      /** Extract and document configuration schemas */
      config_docs: import_zod.z.boolean().default(true),
      /** Generate aggregate types/interfaces page */
      types_page: import_zod.z.boolean().default(true),
      /** Generate external dependencies listing page */
      dependencies_page: import_zod.z.boolean().default(true),
      /** Generate "How to use these docs" usage guide page */
      usage_guide_page: import_zod.z.boolean().default(false),
      /** Maximum file size to analyze (bytes) — skip huge generated files */
      max_file_size: import_zod.z.number().int().positive().default(5e5),
      /** Parallelism for analysis workers */
      concurrency: import_zod.z.number().int().positive().default(4),
      /** Audience separation: auto-detect library vs app, split into user/dev tabs, or unified */
      audience: import_zod.z.enum(["auto", "unified", "split"]).default("split"),
      /** Multi-level architecture pages (system → package → module) */
      architecture_tiers: import_zod.z.boolean().default(true),
      /** Generate Software Bill of Materials page */
      sbom: import_zod.z.boolean().default(true),
      /** Add GitHub source links on symbols */
      source_links: import_zod.z.boolean().default(true),
      /** Generate code insights page (static analyzers) */
      insights: import_zod.z.boolean().default(true),
      /** Enable AI-powered insights (requires license + API key) */
      insights_ai: import_zod.z.boolean().default(false),
      /** Enable AI-generated narrative prose on pages (requires AI provider) */
      ai_narrative: import_zod.z.boolean().default(false),
      /** Enable AI-generated diagrams (sequence, flowcharts) */
      ai_diagrams: import_zod.z.boolean().default(false),
      /** Enable AI-driven dynamic page structure suggestions */
      ai_structure: import_zod.z.boolean().default(false),
      /** Enable monorepo workspace package resolution for dependency graphs */
      monorepo: import_zod.z.boolean().default(true),
      /** Generate end-user documentation (user guides, troubleshooting, FAQ) */
      user_docs: import_zod.z.boolean().default(true),
      /** Per-page toggles for end-user documentation */
      user_docs_config: import_zod.z.object({
        overview: import_zod.z.boolean().default(true),
        getting_started: import_zod.z.boolean().default(true),
        features: import_zod.z.boolean().default(true),
        troubleshooting: import_zod.z.boolean().default(true),
        faq: import_zod.z.boolean().default(true),
        section_title: import_zod.z.string().default("User Guide")
      }).optional(),
      /** Enable Q&A chat widget in generated docs (Team feature) */
      qa_widget: import_zod.z.boolean().default(false),
      /** Q&A widget configuration */
      qa_config: import_zod.z.object({
        provider: import_zod.z.enum(["openai", "anthropic", "gemini", "ollama", "local"]).default("openai"),
        model: import_zod.z.string().optional(),
        embedding_model: import_zod.z.string().default("text-embedding-3-small"),
        context_window: import_zod.z.number().default(4e3),
        position: import_zod.z.enum(["bottom-right", "bottom-left"]).default("bottom-right"),
        greeting: import_zod.z.string().default("Ask me anything about this project."),
        daily_limit: import_zod.z.number().default(50),
        api_key_env: import_zod.z.string().optional().describe("Environment variable name for Q&A API key (overrides ai_provider key)"),
        base_url: import_zod.z.string().optional().describe("Custom base URL for Q&A embedding provider")
      }).optional()
    });
    SyncSchema = import_zod.z.object({
      /**
       * When to trigger doc sync:
       * - on_push: CI triggers on every push to tracked branch
       * - cron: Scheduled interval
       * - manual: Only via `docwalk sync` CLI
       * - webhook: HTTP endpoint trigger
       */
      trigger: import_zod.z.enum(["on_push", "cron", "manual", "webhook"]).default("on_push"),
      /** Cron expression for scheduled sync (only used when trigger=cron) */
      cron: import_zod.z.string().optional(),
      /** Diff strategy — incremental only re-analyzes changed files */
      diff_strategy: import_zod.z.enum(["incremental", "full"]).default("incremental"),
      /** Cross-file impact analysis — detect downstream doc changes */
      impact_analysis: import_zod.z.boolean().default(true),
      /** Commit SHA storage location */
      state_file: import_zod.z.string().default(".docwalk/state.json"),
      /** Auto-commit generated docs back to repo (for gh-pages flow) */
      auto_commit: import_zod.z.boolean().default(false),
      /** Commit message template for auto-commit */
      commit_message: import_zod.z.string().default("docs: update documentation [docwalk]")
    });
    DeploySchema = import_zod.z.object({
      /**
       * Hosting provider:
       * - gh-pages: GitHub Pages via Actions
       * - cloudflare: Cloudflare Pages via Wrangler
       * - vercel: Vercel via CLI/API
       * - netlify: Netlify via CLI
       * - s3: AWS S3 + optional CloudFront
       */
      provider: import_zod.z.enum(["gh-pages", "cloudflare", "vercel", "netlify", "s3"]).default("gh-pages"),
      /** Project name on the hosting platform */
      project: import_zod.z.string().optional(),
      /** Automatic SSL provisioning */
      auto_ssl: import_zod.z.boolean().default(true),
      /** Build output directory */
      output_dir: import_zod.z.string().default("site"),
      /** Provider-specific configuration overrides */
      provider_config: import_zod.z.record(import_zod.z.string(), import_zod.z.unknown()).optional()
    });
    DomainSchema = import_zod.z.object({
      /** Custom domain for docs */
      custom: import_zod.z.string().optional(),
      /** Base path prefix (e.g., /cyroid for docs.example.com/cyroid) */
      base_path: import_zod.z.string().default("/"),
      /** Auto-configure DNS records via provider API */
      dns_auto: import_zod.z.boolean().default(true),
      /** Additional domain aliases */
      aliases: import_zod.z.array(import_zod.z.string()).optional()
    });
    ThemeSchema = import_zod.z.object({
      /** Theme preset — provides palette, fonts, features, and custom CSS out of the box.
       *  Built-in: corporate, startup, developer, minimal (free) + api-reference, knowledge-base (premium).
       *  Additional presets can be registered via @docwalk/themes-premium or custom packages. */
      preset: import_zod.z.string().default("developer"),
      /** Layout mode — controls tab/sidebar behavior */
      layout: import_zod.z.enum(["tabs", "sidebar", "tabs-sticky"]).default("tabs"),
      /** MkDocs Material color palette preset */
      palette: import_zod.z.enum(["default", "slate", "indigo", "deep-purple", "teal", "custom"]).default("slate"),
      /** Primary accent color (hex) */
      accent: import_zod.z.string().default("#5de4c7"),
      /** Path to logo file */
      logo: import_zod.z.string().optional(),
      /** Path to favicon */
      favicon: import_zod.z.string().optional(),
      /** Material theme features to enable */
      features: import_zod.z.array(import_zod.z.string()).default([
        "navigation.tabs",
        "navigation.sections",
        "navigation.expand",
        "navigation.top",
        "search.suggest",
        "search.highlight",
        "content.code.copy",
        "content.tabs.link"
      ]),
      /** Custom CSS file paths */
      custom_css: import_zod.z.array(import_zod.z.string()).optional(),
      /** Custom JS file paths */
      custom_js: import_zod.z.array(import_zod.z.string()).optional(),
      /** Social links for footer */
      social: import_zod.z.array(
        import_zod.z.object({
          icon: import_zod.z.string(),
          link: import_zod.z.string(),
          name: import_zod.z.string().optional()
        })
      ).optional()
    });
    VersioningSchema = import_zod.z.object({
      /** Enable versioned documentation */
      enabled: import_zod.z.boolean().default(false),
      /** Version source — git tags or branches */
      source: import_zod.z.enum(["tags", "branches"]).default("tags"),
      /** Tag pattern to match (regex) */
      tag_pattern: import_zod.z.string().default("^v\\d+\\.\\d+\\.\\d+$"),
      /** Default version alias (e.g., 'latest', 'stable') */
      default_alias: import_zod.z.string().default("latest"),
      /** Maximum number of versions to keep deployed */
      max_versions: import_zod.z.number().int().positive().default(10)
    });
    PluginSchema = import_zod.z.object({
      /** Plugin package name or local path */
      name: import_zod.z.string(),
      /** Plugin-specific configuration */
      config: import_zod.z.record(import_zod.z.string(), import_zod.z.unknown()).optional(),
      /** Whether plugin is enabled */
      enabled: import_zod.z.boolean().default(true)
    });
    HooksSchema = import_zod.z.object({
      /** Run before analysis */
      pre_analyze: import_zod.z.array(import_zod.z.string()).optional(),
      /** Run after analysis */
      post_analyze: import_zod.z.array(import_zod.z.string()).optional(),
      /** Run before MkDocs build */
      pre_build: import_zod.z.array(import_zod.z.string()).optional(),
      /** Run after MkDocs build */
      post_build: import_zod.z.array(import_zod.z.string()).optional(),
      /** Run before deploy */
      pre_deploy: import_zod.z.array(import_zod.z.string()).optional(),
      /** Run after deploy */
      post_deploy: import_zod.z.array(import_zod.z.string()).optional()
    });
    DocWalkConfigSchema = import_zod.z.object({
      /** Source repository configuration */
      source: SourceSchema,
      /** Analysis engine configuration */
      analysis: AnalysisSchema.default({}),
      /** Sync strategy configuration */
      sync: SyncSchema.default({}),
      /** Deployment configuration */
      deploy: DeploySchema.default({}),
      /** Domain routing configuration */
      domain: DomainSchema.default({}),
      /** Theme and appearance */
      theme: ThemeSchema.default({}),
      /** Documentation versioning */
      versioning: VersioningSchema.default({}),
      /** Plugins */
      plugins: import_zod.z.array(PluginSchema).optional(),
      /** Lifecycle hooks */
      hooks: HooksSchema.optional(),
      /** License key for premium features (themes, AI summaries, etc.) */
      license_key: import_zod.z.string().optional()
    });
  }
});

// src/config/loader.ts
async function loadConfig(searchFrom) {
  const result = await explorer.search(searchFrom);
  if (!result || result.isEmpty) {
    throw new ConfigNotFoundError(
      `No docwalk configuration found. Run ${import_chalk3.default.cyan("docwalk init")} to create one.`
    );
  }
  const parsed = DocWalkConfigSchema.safeParse(result.config);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const path26 = issue.path.join(".");
      return `  ${import_chalk3.default.red("\u2717")} ${import_chalk3.default.dim(path26)}: ${issue.message}`;
    }).join("\n");
    throw new ConfigValidationError(
      `Invalid configuration in ${import_chalk3.default.dim(result.filepath)}:
${errors}`
    );
  }
  return {
    config: parsed.data,
    filepath: result.filepath
  };
}
async function loadConfigFile(filepath) {
  const result = await explorer.load(filepath);
  if (!result || result.isEmpty) {
    throw new ConfigNotFoundError(
      `Configuration file is empty: ${import_chalk3.default.dim(filepath)}`
    );
  }
  const parsed = DocWalkConfigSchema.safeParse(result.config);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => {
      const path26 = issue.path.join(".");
      return `  ${import_chalk3.default.red("\u2717")} ${import_chalk3.default.dim(path26)}: ${issue.message}`;
    }).join("\n");
    throw new ConfigValidationError(
      `Invalid configuration in ${import_chalk3.default.dim(filepath)}:
${errors}`
    );
  }
  return {
    config: parsed.data,
    filepath: result.filepath
  };
}
var import_cosmiconfig, import_chalk3, MODULE_NAME, explorer, ConfigNotFoundError, ConfigValidationError;
var init_loader = __esm({
  "src/config/loader.ts"() {
    "use strict";
    import_cosmiconfig = require("cosmiconfig");
    init_schema();
    import_chalk3 = __toESM(require("chalk"), 1);
    MODULE_NAME = "docwalk";
    explorer = (0, import_cosmiconfig.cosmiconfig)(MODULE_NAME, {
      searchPlaces: [
        "docwalk.config.yml",
        "docwalk.config.yaml",
        "docwalk.config.json",
        "docwalk.config.js",
        "docwalk.config.ts",
        ".docwalkrc",
        ".docwalkrc.yml",
        ".docwalkrc.yaml",
        ".docwalkrc.json"
      ]
    });
    ConfigNotFoundError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "ConfigNotFoundError";
      }
    };
    ConfigValidationError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "ConfigValidationError";
      }
    };
  }
});

// src/utils/hooks.ts
async function executeHooks(hookName, hooksConfig, options = {}) {
  if (!hooksConfig) return;
  const commands = hooksConfig[hookName];
  if (!commands || commands.length === 0) return;
  const { execa } = await import("execa");
  for (const command of commands) {
    try {
      const result = await execa(command, {
        shell: true,
        cwd: options.cwd,
        stdout: "pipe",
        stderr: "pipe"
      });
      if (result.stdout && options.onOutput) {
        for (const line of result.stdout.split("\n")) {
          options.onOutput(line);
        }
      }
    } catch (error) {
      const err = error;
      throw new Error(
        `Hook "${hookName}" failed on command: ${command}
Exit code: ${err.exitCode ?? "unknown"}
${err.message ?? ""}`
      );
    }
  }
}
var init_hooks = __esm({
  "src/utils/hooks.ts"() {
    "use strict";
  }
});

// src/analysis/language-detect.ts
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
var EXTENSION_MAP;
var init_language_detect = __esm({
  "src/analysis/language-detect.ts"() {
    "use strict";
    EXTENSION_MAP = {
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
  }
});

// src/analysis/parsers/tree-sitter-loader.ts
async function ensureInit() {
  if (ParserClass) return ParserClass;
  if (!initPromise) {
    initPromise = (async () => {
      const mod = await import("web-tree-sitter");
      ParserClass = mod.default ?? mod;
      await ParserClass.init();
    })();
  }
  await initPromise;
  return ParserClass;
}
async function initParser(language) {
  if (parserCache.has(language)) {
    return parserCache.get(language);
  }
  const Parser = await ensureInit();
  if (!languageCache.has(language)) {
    const wasmFile = GRAMMAR_MAP[language];
    if (!wasmFile) {
      throw new Error(
        `No tree-sitter grammar available for language: ${language}. Supported languages: ${Object.keys(GRAMMAR_MAP).join(", ")}`
      );
    }
    const wasmDir = import_path2.default.dirname(require2.resolve("tree-sitter-wasms/package.json"));
    const wasmPath = import_path2.default.join(wasmDir, "out", wasmFile);
    const lang = await Parser.Language.load(wasmPath);
    languageCache.set(language, lang);
  }
  const parser = new Parser();
  parser.setLanguage(languageCache.get(language));
  parserCache.set(language, parser);
  return parser;
}
var import_module, import_path2, import_meta, require2, GRAMMAR_MAP, ParserClass, initPromise, languageCache, parserCache;
var init_tree_sitter_loader = __esm({
  "src/analysis/parsers/tree-sitter-loader.ts"() {
    "use strict";
    import_module = require("module");
    import_path2 = __toESM(require("path"), 1);
    import_meta = {};
    require2 = (0, import_module.createRequire)(import_meta.url);
    GRAMMAR_MAP = {
      typescript: "tree-sitter-typescript.wasm",
      javascript: "tree-sitter-javascript.wasm",
      python: "tree-sitter-python.wasm",
      go: "tree-sitter-go.wasm",
      rust: "tree-sitter-rust.wasm",
      java: "tree-sitter-java.wasm",
      csharp: "tree-sitter-c_sharp.wasm",
      ruby: "tree-sitter-ruby.wasm",
      php: "tree-sitter-php.wasm",
      c: "tree-sitter-c.wasm",
      cpp: "tree-sitter-cpp.wasm",
      swift: "tree-sitter-swift.wasm",
      kotlin: "tree-sitter-kotlin.wasm",
      scala: "tree-sitter-scala.wasm",
      elixir: "tree-sitter-elixir.wasm",
      dart: "tree-sitter-dart.wasm",
      lua: "tree-sitter-lua.wasm",
      zig: "tree-sitter-zig.wasm",
      haskell: "tree-sitter-haskell.wasm"
    };
    ParserClass = null;
    initPromise = null;
    languageCache = /* @__PURE__ */ new Map();
    parserCache = /* @__PURE__ */ new Map();
  }
});

// src/analysis/parsers/typescript.ts
function extractImport(node) {
  const sourceNode = node.childForFieldName("source");
  if (!sourceNode) return null;
  const source = stripQuotes(sourceNode.text);
  const isTypeOnly = node.text.startsWith("import type");
  const clause = findChild(node, "import_clause");
  if (!clause) {
    return { source, specifiers: [], isTypeOnly: false };
  }
  const specifiers = [];
  for (let i = 0; i < clause.childCount; i++) {
    const child = clause.child(i);
    if (child.type === "identifier") {
      specifiers.push({
        name: child.text,
        isDefault: true,
        isNamespace: false
      });
    } else if (child.type === "namespace_import") {
      const alias = findChild(child, "identifier");
      specifiers.push({
        name: "*",
        alias: alias?.text,
        isDefault: false,
        isNamespace: true
      });
    } else if (child.type === "named_imports") {
      for (let j = 0; j < child.childCount; j++) {
        const spec = child.child(j);
        if (spec.type === "import_specifier") {
          const nameNode = spec.childForFieldName("name");
          const aliasNode = spec.childForFieldName("alias");
          specifiers.push({
            name: nameNode?.text ?? spec.text,
            alias: aliasNode?.text,
            isDefault: false,
            isNamespace: false
          });
        }
      }
    }
  }
  return { source, specifiers, isTypeOnly };
}
function processExportStatement(node, filePath, symbols, exports2, root, nodeIndex) {
  const isDefault = node.text.includes("export default");
  const sourceNode = node.childForFieldName("source");
  if (sourceNode) {
    const source = stripQuotes(sourceNode.text);
    const exportClause2 = findChild(node, "export_clause");
    if (exportClause2) {
      for (let i = 0; i < exportClause2.childCount; i++) {
        const spec = exportClause2.child(i);
        if (spec.type === "export_specifier") {
          const nameNode = spec.childForFieldName("name");
          const aliasNode = spec.childForFieldName("alias");
          exports2.push({
            name: aliasNode?.text ?? nameNode?.text ?? spec.text,
            alias: aliasNode?.text,
            isDefault: false,
            isReExport: true,
            source
          });
        }
      }
    } else {
      exports2.push({
        name: "*",
        isDefault: false,
        isReExport: true,
        source
      });
    }
    return;
  }
  const exportClause = findChild(node, "export_clause");
  if (exportClause) {
    for (let i = 0; i < exportClause.childCount; i++) {
      const spec = exportClause.child(i);
      if (spec.type === "export_specifier") {
        const nameNode = spec.childForFieldName("name");
        const aliasNode = spec.childForFieldName("alias");
        exports2.push({
          name: aliasNode?.text ?? nameNode?.text ?? spec.text,
          alias: aliasNode?.text,
          isDefault: false,
          isReExport: false
        });
      }
    }
    return;
  }
  const declaration = findDeclarationChild(node);
  if (declaration) {
    const sym = extractDeclaration(
      declaration,
      filePath,
      true,
      isDefault,
      root,
      nodeIndex
    );
    if (sym) {
      symbols.push(sym);
      exports2.push({
        name: sym.name,
        isDefault,
        isReExport: false,
        symbolId: sym.id
      });
    }
    return;
  }
  if (isDefault) {
    const expr = findChild(node, "identifier") ?? findChild(node, "call_expression") ?? findChild(node, "new_expression");
    if (expr) {
      const name = expr.type === "identifier" ? expr.text : "default";
      exports2.push({
        name,
        isDefault: true,
        isReExport: false
      });
    }
  }
}
function extractDeclaration(node, filePath, exported, isDefault, root, nodeIndex) {
  const docs = findPrecedingJSDoc(root, nodeIndex);
  switch (node.type) {
    case "function_declaration":
    case "generator_function_declaration":
      return extractFunction(node, filePath, exported, docs);
    case "class_declaration":
    case "abstract_class_declaration":
      return extractClass(node, filePath, exported, docs);
    case "interface_declaration":
      return extractInterface(node, filePath, exported, docs);
    case "type_alias_declaration":
      return extractTypeAlias(node, filePath, exported, docs);
    case "enum_declaration":
      return extractEnum(node, filePath, exported, docs);
    case "lexical_declaration":
      return extractLexicalDeclaration(node, filePath, exported, docs);
    default:
      return null;
  }
}
function extractFunction(node, filePath, exported, docs) {
  const nameNode = node.childForFieldName("name");
  const name = nameNode?.text ?? "anonymous";
  const isAsync = node.text.startsWith("async ");
  const isGenerator = node.type === "generator_function_declaration" || node.text.includes("function*");
  const params = extractParameters(node);
  const returnType = extractReturnType(node);
  const typeParams = extractTypeParameters(node);
  const sig = buildSignature(node);
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "function",
    visibility: exported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported,
    async: isAsync,
    generator: isGenerator,
    parameters: params,
    returns: returnType ? { type: returnType } : void 0,
    typeParameters: typeParams.length > 0 ? typeParams : void 0,
    docs,
    signature: sig
  };
}
function extractClass(node, filePath, exported, docs) {
  const nameNode = node.childForFieldName("name");
  const name = nameNode?.text ?? "anonymous";
  const isAbstract = node.type === "abstract_class_declaration" || node.text.startsWith("abstract ");
  let extendsClause;
  const implementsList = [];
  const typeParams = extractTypeParameters(node);
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "class_heritage") {
      for (let j = 0; j < child.childCount; j++) {
        const clause = child.child(j);
        if (clause.type === "extends_clause") {
          const typeNode = findChild(clause, "identifier") ?? findChild(clause, "member_expression");
          if (typeNode) extendsClause = typeNode.text;
        }
        if (clause.type === "implements_clause") {
          for (let k = 0; k < clause.childCount; k++) {
            const impl = clause.child(k);
            if (impl.isNamed && impl.type !== "implements") {
              implementsList.push(impl.text);
            }
          }
        }
      }
    }
    if (child.type === "extends_clause") {
      const typeNode = findChild(child, "identifier") ?? findChild(child, "member_expression");
      if (typeNode) extendsClause = typeNode.text;
    }
    if (child.type === "implements_clause") {
      for (let k = 0; k < child.childCount; k++) {
        const impl = child.child(k);
        if (impl.isNamed && impl.type !== "implements") {
          implementsList.push(impl.text);
        }
      }
    }
  }
  const children = [];
  const body = findChild(node, "class_body");
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i);
      const memberSym = extractClassMember(member, filePath, name);
      if (memberSym) {
        children.push(memberSym.id);
      }
    }
  }
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "class",
    visibility: exported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported,
    extends: extendsClause,
    implements: implementsList.length > 0 ? implementsList : void 0,
    typeParameters: typeParams.length > 0 ? typeParams : void 0,
    docs,
    children: children.length > 0 ? children : void 0
  };
}
function extractClassMember(node, filePath, className) {
  if (node.type === "method_definition" || node.type === "public_field_definition" || node.type === "property_definition") {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return null;
    const name = nameNode.text;
    const isMethod = node.type === "method_definition";
    return {
      id: `${filePath}:${className}.${name}`,
      name,
      kind: isMethod ? "method" : "property",
      visibility: getVisibility(node),
      location: {
        file: filePath,
        line: node.startPosition.row + 1,
        column: node.startPosition.column
      },
      exported: false,
      parentId: `${filePath}:${className}`
    };
  }
  return null;
}
function extractInterface(node, filePath, exported, docs) {
  const nameNode = node.childForFieldName("name");
  const name = nameNode?.text ?? "anonymous";
  const typeParams = extractTypeParameters(node);
  let extendsClause;
  const extendsNode = findChild(node, "extends_type_clause") ?? findChild(node, "extends_clause");
  if (extendsNode) {
    const typeNode = findChild(extendsNode, "identifier") ?? findChild(extendsNode, "type_identifier");
    if (typeNode) extendsClause = typeNode.text;
  }
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "interface",
    visibility: exported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported,
    extends: extendsClause,
    typeParameters: typeParams.length > 0 ? typeParams : void 0,
    docs,
    signature: node.text.split("{")[0]?.trim()
  };
}
function extractTypeAlias(node, filePath, exported, docs) {
  const nameNode = node.childForFieldName("name");
  const name = nameNode?.text ?? "anonymous";
  const typeParams = extractTypeParameters(node);
  const valueNode = node.childForFieldName("value");
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "type",
    visibility: exported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported,
    typeAnnotation: valueNode?.text,
    typeParameters: typeParams.length > 0 ? typeParams : void 0,
    docs,
    signature: node.text.replace(/;$/, "").trim()
  };
}
function extractEnum(node, filePath, exported, docs) {
  const nameNode = node.childForFieldName("name");
  const name = nameNode?.text ?? "anonymous";
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "enum",
    visibility: exported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported,
    docs
  };
}
function extractLexicalDeclaration(node, filePath, exported, docs) {
  const declarator = findChild(node, "variable_declarator");
  if (!declarator) return null;
  const nameNode = declarator.childForFieldName("name");
  if (!nameNode) return null;
  const name = nameNode.text;
  const value = declarator.childForFieldName("value");
  const isArrowFunc = value?.type === "arrow_function";
  const isFuncExpr = value?.type === "function_expression" || value?.type === "function";
  const kind = isArrowFunc || isFuncExpr ? "function" : "constant";
  let params;
  let returnType;
  let isAsync = false;
  if (isArrowFunc && value) {
    isAsync = value.text.startsWith("async ");
    params = extractParameters(value);
    returnType = extractReturnType(value);
  }
  const sig = buildSignature(node);
  return {
    id: `${filePath}:${name}`,
    name,
    kind,
    visibility: exported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported,
    async: isAsync || void 0,
    parameters: params,
    returns: returnType ? { type: returnType } : void 0,
    docs,
    signature: sig
  };
}
function extractParameters(node) {
  const params = [];
  const paramsNode = node.childForFieldName("parameters") ?? findChild(node, "formal_parameters");
  if (!paramsNode) return params;
  for (let i = 0; i < paramsNode.childCount; i++) {
    const param = paramsNode.child(i);
    if (param.type === "required_parameter" || param.type === "optional_parameter" || param.type === "rest_parameter") {
      const patternNode = param.childForFieldName("pattern") ?? findChild(param, "identifier");
      const typeNode = param.childForFieldName("type") ?? findChild(param, "type_annotation");
      const defaultNode = param.childForFieldName("value");
      const name = patternNode?.text ?? param.text;
      const isRest = param.type === "rest_parameter";
      const isOptional = param.type === "optional_parameter";
      let typeText;
      if (typeNode) {
        typeText = typeNode.text.replace(/^:\s*/, "");
      }
      params.push({
        name: isRest ? name.replace(/^\.\.\./, "") : name,
        type: typeText,
        optional: isOptional,
        rest: isRest,
        defaultValue: defaultNode?.text
      });
    } else if (param.type === "identifier") {
      params.push({
        name: param.text,
        optional: false,
        rest: false
      });
    }
  }
  return params;
}
function extractReturnType(node) {
  const returnType = node.childForFieldName("return_type") ?? findChild(node, "type_annotation");
  if (!returnType) return void 0;
  return returnType.text.replace(/^:\s*/, "");
}
function extractTypeParameters(node) {
  const typeParams = findChild(node, "type_parameters");
  if (!typeParams) return [];
  const params = [];
  for (let i = 0; i < typeParams.childCount; i++) {
    const child = typeParams.child(i);
    if (child.type === "type_parameter") {
      params.push(child.text);
    }
  }
  return params;
}
function findPrecedingJSDoc(root, nodeIndex) {
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = root.child(i);
    if (!prev) break;
    if (prev.type === "comment" && prev.text.startsWith("/**")) {
      return parseJSDoc(prev.text);
    }
    if (prev.type !== "comment") break;
  }
  return void 0;
}
function extractModuleDoc(root) {
  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i);
    if (child.type === "comment" && child.text.startsWith("/**")) {
      return parseJSDoc(child.text);
    }
    if (child.type !== "comment") break;
  }
  return void 0;
}
function parseJSDoc(raw) {
  const lines = raw.split("\n").map(
    (l) => l.trim().replace(/^\/\*\*\s?/, "").replace(/\s?\*\/$/, "").replace(/^\*\s?/, "")
  ).filter((l) => l !== "");
  const docBlock = lines.join("\n");
  const summaryLines = [];
  let hitTag = false;
  for (const line of lines) {
    if (line.startsWith("@")) {
      hitTag = true;
      continue;
    }
    if (!hitTag) summaryLines.push(line);
  }
  const summary = summaryLines[0] || "";
  const description = summaryLines.length > 1 ? summaryLines.join("\n") : void 0;
  const params = {};
  const paramRegex = /@param\s+(?:\{[^}]+\}\s+)?(\w+)\s*[-–]?\s*(.*)/g;
  let match;
  while ((match = paramRegex.exec(docBlock)) !== null) {
    params[match[1]] = match[2];
  }
  const returnMatch = docBlock.match(/@returns?\s+(.*)/);
  const deprecatedMatch = docBlock.match(/@deprecated\s*(.*)/);
  const sinceMatch = docBlock.match(/@since\s+(.*)/);
  const throwsMatches = [];
  const throwsRegex = /@throws?\s+(?:\{[^}]+\}\s+)?(.*)/g;
  while ((match = throwsRegex.exec(docBlock)) !== null) {
    throwsMatches.push(match[1]);
  }
  const examples = [];
  const exampleRegex = /@example\s*([\s\S]*?)(?=@\w|$)/g;
  while ((match = exampleRegex.exec(docBlock)) !== null) {
    examples.push(match[1].trim());
  }
  const tags = {};
  const tagRegex = /@(\w+)\s+(.*)/g;
  while ((match = tagRegex.exec(docBlock)) !== null) {
    const tagName = match[1];
    if (!["param", "returns", "return", "deprecated", "since", "throws", "example", "see"].includes(
      tagName
    )) {
      tags[tagName] = match[2];
    }
  }
  return {
    summary,
    description,
    params: Object.keys(params).length > 0 ? params : void 0,
    returns: returnMatch?.[1],
    deprecated: deprecatedMatch ? deprecatedMatch[1] || true : void 0,
    since: sinceMatch?.[1],
    throws: throwsMatches.length > 0 ? throwsMatches : void 0,
    examples: examples.length > 0 ? examples : void 0,
    tags: Object.keys(tags).length > 0 ? tags : void 0
  };
}
function findChild(node, type) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === type) return child;
  }
  return null;
}
function findDeclarationChild(node) {
  const declTypes = [
    "function_declaration",
    "generator_function_declaration",
    "class_declaration",
    "abstract_class_declaration",
    "interface_declaration",
    "type_alias_declaration",
    "enum_declaration",
    "lexical_declaration"
  ];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (declTypes.includes(child.type)) return child;
  }
  return null;
}
function getVisibility(node) {
  const text = node.text;
  if (text.startsWith("private ") || text.includes(" private "))
    return "private";
  if (text.startsWith("protected ") || text.includes(" protected "))
    return "protected";
  return "public";
}
function stripQuotes(s) {
  return s.replace(/^['"]|['"]$/g, "");
}
function buildSignature(node) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  const semiIndex = text.indexOf(";");
  if (semiIndex > 0) {
    return text.slice(0, semiIndex).trim();
  }
  return text.split("\n")[0].trim();
}
var TypeScriptParser;
var init_typescript = __esm({
  "src/analysis/parsers/typescript.ts"() {
    "use strict";
    init_tree_sitter_loader();
    TypeScriptParser = class {
      language = "typescript";
      async parse(content, filePath) {
        const symbols = [];
        const imports = [];
        const exports2 = [];
        let moduleDoc;
        const parser = await initParser("typescript");
        const tree = parser.parse(content);
        const root = tree.rootNode;
        moduleDoc = extractModuleDoc(root);
        for (let i = 0; i < root.childCount; i++) {
          const node = root.child(i);
          if (node.type === "import_statement") {
            const imp = extractImport(node);
            if (imp) imports.push(imp);
            continue;
          }
          if (node.type === "export_statement") {
            processExportStatement(node, filePath, symbols, exports2, root, i);
            continue;
          }
          const sym = extractDeclaration(node, filePath, false, false, root, i);
          if (sym) symbols.push(sym);
        }
        return { symbols, imports, exports: exports2, moduleDoc };
      }
    };
  }
});

// src/analysis/parsers/javascript.ts
var JavaScriptParser;
var init_javascript = __esm({
  "src/analysis/parsers/javascript.ts"() {
    "use strict";
    init_typescript();
    JavaScriptParser = class extends TypeScriptParser {
      language = "javascript";
    };
  }
});

// src/analysis/parsers/python.ts
function extractImport2(node) {
  const names = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "dotted_name") {
      names.push({
        name: child.text,
        isDefault: false,
        isNamespace: false
      });
    } else if (child.type === "aliased_import") {
      const nameNode = findChild2(child, "dotted_name");
      const aliasNode = findChild2(child, "identifier");
      names.push({
        name: nameNode?.text ?? child.text,
        alias: aliasNode?.text,
        isDefault: false,
        isNamespace: false
      });
    }
  }
  if (names.length === 0) return null;
  return {
    source: names[0].name,
    specifiers: names,
    isTypeOnly: false
  };
}
function extractFromImport(node) {
  let source = "";
  const specifiers = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "dotted_name" || child.type === "relative_import") {
      if (!source) source = child.text;
      else {
        specifiers.push({
          name: child.text,
          isDefault: false,
          isNamespace: false
        });
      }
    } else if (child.type === "aliased_import") {
      const nameNode = findChild2(child, "dotted_name") ?? findChild2(child, "identifier");
      const parts = child.text.split(/\s+as\s+/);
      specifiers.push({
        name: nameNode?.text ?? parts[0],
        alias: parts[1],
        isDefault: false,
        isNamespace: false
      });
    } else if (child.type === "wildcard_import") {
      specifiers.push({
        name: "*",
        isDefault: false,
        isNamespace: true
      });
    }
  }
  if (!source) return null;
  return { source, specifiers, isTypeOnly: false };
}
function extractFunction2(node, filePath, exported, docs) {
  const name = nameOf(node);
  if (!name) return null;
  const isAsync = node.text.startsWith("async ");
  const params = extractParameters2(node);
  const returnType = extractReturnType2(node);
  const decorators = extractDecorators(node);
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "function",
    visibility: name.startsWith("_") ? "private" : "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported,
    async: isAsync || void 0,
    parameters: params.length > 0 ? params : void 0,
    returns: returnType ? { type: returnType } : void 0,
    decorators: decorators.length > 0 ? decorators : void 0,
    docs,
    signature: buildSignature2(node)
  };
}
function extractClass2(node, filePath, exported, docs) {
  const name = nameOf(node);
  if (!name) return null;
  const bases = [];
  const argList = findChild2(node, "argument_list");
  if (argList) {
    for (let i = 0; i < argList.childCount; i++) {
      const child = argList.child(i);
      if (child.isNamed) {
        bases.push(child.text);
      }
    }
  }
  const decorators = extractDecorators(node);
  const children = [];
  const body = findChild2(node, "block");
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i);
      if (member.type === "function_definition") {
        const methodName = nameOf(member);
        if (methodName) {
          children.push(`${filePath}:${name}.${methodName}`);
        }
      }
    }
  }
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "class",
    visibility: name.startsWith("_") ? "private" : "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported,
    extends: bases[0],
    implements: bases.length > 1 ? bases.slice(1) : void 0,
    decorators: decorators.length > 0 ? decorators : void 0,
    children: children.length > 0 ? children : void 0,
    docs
  };
}
function extractAssignment(node, filePath, allExports) {
  const leftNode = node.child(0);
  if (!leftNode) return null;
  const name = leftNode.text;
  if (name === "__all__" || name.startsWith("_")) return null;
  const isExported = allExports === null || allExports.includes(name);
  const isUpperCase = name === name.toUpperCase() && name.length > 1;
  return {
    id: `${filePath}:${name}`,
    name,
    kind: isUpperCase ? "constant" : "variable",
    visibility: "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column
    },
    exported: isExported
  };
}
function extractDocstring(node) {
  const body = findChild2(node, "block");
  if (!body || body.childCount === 0) return void 0;
  const first = body.child(0);
  if (!first || first.type !== "expression_statement") return void 0;
  const str = findChild2(first, "string");
  if (!str) return void 0;
  return parseDocstring(str.text);
}
function extractModuleDocstring(root) {
  const first = root.child(0);
  if (!first || first.type !== "expression_statement") return void 0;
  const str = findChild2(first, "string");
  if (!str || !str.text.startsWith('"""') && !str.text.startsWith("'''"))
    return void 0;
  return parseDocstring(str.text);
}
function parseDocstring(raw) {
  let content = raw;
  if (content.startsWith('"""') || content.startsWith("'''")) {
    content = content.slice(3, -3);
  } else if (content.startsWith('"') || content.startsWith("'")) {
    content = content.slice(1, -1);
  }
  const lines = content.split("\n").map((l) => l.trim());
  const summary = lines[0] || "";
  const params = {};
  let returns;
  let section = "";
  for (const line of lines.slice(1)) {
    if (/^Args?:/i.test(line)) {
      section = "args";
      continue;
    }
    if (/^Returns?:/i.test(line)) {
      section = "returns";
      continue;
    }
    if (/^(Raises?|Yields?|Notes?|Examples?|Attributes?|See Also|References?|Warnings?|Todo):/i.test(line)) {
      section = "other";
      continue;
    }
    if (section === "args") {
      const paramMatch = line.match(/^(\w+)\s*(?:\([^)]*\))?\s*:\s*(.*)/);
      if (paramMatch) {
        params[paramMatch[1]] = paramMatch[2];
      }
    }
    if (section === "returns" && line) {
      returns = (returns ? returns + " " : "") + line;
    }
  }
  const numpyParamMatch = content.match(
    /Parameters\s*\n\s*-+\s*\n([\s\S]*?)(?=\n\s*\w+\s*\n\s*-+|$)/
  );
  if (numpyParamMatch) {
    const paramLines = numpyParamMatch[1].split("\n");
    let currentParam = "";
    for (const line of paramLines) {
      const nameMatch = line.trim().match(/^(\w+)\s*:/);
      if (nameMatch) {
        currentParam = nameMatch[1];
        const desc = line.trim().slice(nameMatch[0].length).trim();
        if (desc) params[currentParam] = desc;
      } else if (currentParam && line.trim()) {
        params[currentParam] = (params[currentParam] ? params[currentParam] + " " : "") + line.trim();
      }
    }
  }
  const restParamRegex = /:param\s+(\w+):\s*(.*)/g;
  let match;
  while ((match = restParamRegex.exec(content)) !== null) {
    params[match[1]] = match[2];
  }
  const restReturnMatch = content.match(/:returns?:\s*(.*)/);
  if (restReturnMatch) returns = restReturnMatch[1];
  return {
    summary,
    description: lines.length > 1 ? content.trim() : void 0,
    params: Object.keys(params).length > 0 ? params : void 0,
    returns
  };
}
function extractParameters2(node) {
  const params = [];
  const paramsNode = findChild2(node, "parameters");
  if (!paramsNode) return params;
  for (let i = 0; i < paramsNode.childCount; i++) {
    const param = paramsNode.child(i);
    if (param.type === "identifier") {
      if (param.text === "self" || param.text === "cls") continue;
      params.push({ name: param.text, optional: false, rest: false });
    } else if (param.type === "typed_parameter") {
      const nameNode = findChild2(param, "identifier");
      const typeNode = findChild2(param, "type");
      const name = nameNode?.text ?? param.text;
      if (name === "self" || name === "cls") continue;
      params.push({
        name,
        type: typeNode?.text,
        optional: false,
        rest: false
      });
    } else if (param.type === "default_parameter" || param.type === "typed_default_parameter") {
      const nameNode = param.childForFieldName("name") ?? findChild2(param, "identifier");
      const typeNode = findChild2(param, "type");
      const valueNode = param.childForFieldName("value");
      const name = nameNode?.text ?? param.text.split("=")[0].trim().split(":")[0].trim();
      if (name === "self" || name === "cls") continue;
      params.push({
        name,
        type: typeNode?.text,
        defaultValue: valueNode?.text,
        optional: true,
        rest: false
      });
    } else if (param.type === "list_splat_pattern") {
      const nameNode = findChild2(param, "identifier");
      params.push({
        name: nameNode?.text ?? param.text.replace("*", ""),
        optional: true,
        rest: true
      });
    } else if (param.type === "dictionary_splat_pattern") {
      const nameNode = findChild2(param, "identifier");
      params.push({
        name: nameNode?.text ?? param.text.replace("**", ""),
        optional: true,
        rest: true
      });
    }
  }
  return params;
}
function extractReturnType2(node) {
  const returnType = node.childForFieldName("return_type") ?? findChild2(node, "type");
  return returnType?.text;
}
function extractDecorators(node) {
  const decorators = [];
  let sibling = node.previousSibling;
  while (sibling) {
    if (sibling.type === "decorator") {
      decorators.unshift(sibling.text.replace(/^@/, ""));
    } else if (sibling.type !== "comment") {
      break;
    }
    sibling = sibling.previousSibling;
  }
  return decorators;
}
function extractAllExports(root) {
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i);
    if (node.type !== "expression_statement") continue;
    const assign = findChild2(node, "assignment");
    if (!assign) continue;
    const left = assign.child(0);
    if (!left || left.text !== "__all__") continue;
    const right = assign.child(assign.childCount - 1);
    if (!right) continue;
    const names = [];
    const listNode = right.type === "list" ? right : findChild2(right, "list");
    if (listNode) {
      for (let j = 0; j < listNode.childCount; j++) {
        const el = listNode.child(j);
        if (el.type === "string") {
          names.push(stripQuotes2(el.text));
        }
      }
    }
    return names;
  }
  return null;
}
function findChild2(node, type) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === type) return child;
  }
  return null;
}
function nameOf(node) {
  const nameNode = node.childForFieldName("name") ?? findChild2(node, "identifier");
  return nameNode?.text ?? "";
}
function isPublicName(name) {
  return !!name && !name.startsWith("_");
}
function stripQuotes2(s) {
  return s.replace(/^['"]|['"]$/g, "");
}
function buildSignature2(node) {
  const text = node.text;
  const colonIndex = text.indexOf(":");
  const firstLine = text.split("\n")[0];
  return firstLine.replace(/:$/, "").trim();
}
var PythonParser;
var init_python = __esm({
  "src/analysis/parsers/python.ts"() {
    "use strict";
    init_tree_sitter_loader();
    PythonParser = class {
      language = "python";
      async parse(content, filePath) {
        const symbols = [];
        const imports = [];
        const exports2 = [];
        let moduleDoc;
        const parser = await initParser("python");
        const tree = parser.parse(content);
        const root = tree.rootNode;
        const allExports = extractAllExports(root);
        moduleDoc = extractModuleDocstring(root);
        for (let i = 0; i < root.childCount; i++) {
          const node = root.child(i);
          if (node.type === "import_statement") {
            const imp = extractImport2(node);
            if (imp) imports.push(imp);
            continue;
          }
          if (node.type === "import_from_statement") {
            const imp = extractFromImport(node);
            if (imp) imports.push(imp);
            continue;
          }
          if (node.type === "function_definition") {
            const docstring = extractDocstring(node);
            const isExported = isPublicName(nameOf(node)) && (allExports === null || allExports.includes(nameOf(node)));
            const sym = extractFunction2(node, filePath, isExported, docstring);
            if (sym) {
              symbols.push(sym);
              if (isExported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
          if (node.type === "class_definition") {
            const docstring = extractDocstring(node);
            const name = nameOf(node);
            const isExported = isPublicName(name) && (allExports === null || allExports.includes(name));
            const sym = extractClass2(node, filePath, isExported, docstring);
            if (sym) {
              symbols.push(sym);
              if (isExported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
          if (node.type === "expression_statement") {
            const assign = findChild2(node, "assignment");
            if (assign) {
              const sym = extractAssignment(assign, filePath, allExports);
              if (sym) {
                symbols.push(sym);
                if (sym.exported) {
                  exports2.push({
                    name: sym.name,
                    isDefault: false,
                    isReExport: false,
                    symbolId: sym.id
                  });
                }
              }
            }
          }
        }
        return { symbols, imports, exports: exports2, moduleDoc };
      }
    };
  }
});

// src/analysis/parsers/go.ts
function extractImports(node) {
  const results = [];
  const specList = findChild3(node, "import_spec_list");
  if (specList) {
    for (let i = 0; i < specList.childCount; i++) {
      const spec = specList.child(i);
      if (spec.type === "import_spec") {
        const imp = parseImportSpec(spec);
        if (imp) results.push(imp);
      }
    }
  } else {
    const spec = findChild3(node, "import_spec");
    if (spec) {
      const imp = parseImportSpec(spec);
      if (imp) results.push(imp);
    }
    const strNode = findChild3(node, "interpreted_string_literal");
    if (strNode && results.length === 0) {
      results.push({
        source: stripQuotes3(strNode.text),
        specifiers: [],
        isTypeOnly: false
      });
    }
  }
  return results;
}
function parseImportSpec(node) {
  let alias;
  let source = "";
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "package_identifier" || child.type === "dot" || child.type === "blank_identifier") {
      alias = child.text;
    }
    if (child.type === "interpreted_string_literal") {
      source = stripQuotes3(child.text);
    }
  }
  if (!source) return null;
  const pkgName = source.split("/").pop() ?? source;
  const specifiers = [
    {
      name: pkgName,
      alias,
      isDefault: false,
      isNamespace: alias === "."
    }
  ];
  return { source, specifiers, isTypeOnly: false };
}
function extractFunction3(node, filePath, docs) {
  const nameNode = node.childForFieldName("name") ?? findChild3(node, "identifier");
  if (!nameNode) return null;
  const name = nameNode.text;
  const isExported = isUpperFirst(name);
  const params = extractParams(node);
  const returnType = extractGoReturnType(node);
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "function",
    visibility: isExported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: isExported,
    parameters: params.length > 0 ? params : void 0,
    returns: returnType ? { type: returnType } : void 0,
    docs,
    signature: buildSignature3(node)
  };
}
function extractMethod(node, filePath, docs) {
  const nameNode = findChild3(node, "field_identifier");
  if (!nameNode) return null;
  const name = nameNode.text;
  const isExported = isUpperFirst(name);
  let receiverType = "";
  const paramLists = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "parameter_list") {
      paramLists.push(child);
    }
  }
  if (paramLists.length >= 1) {
    receiverType = paramLists[0].text.replace(/^\(/, "").replace(/\)$/, "").trim();
    const parts = receiverType.split(/\s+/);
    if (parts.length > 1) receiverType = parts.slice(1).join(" ");
  }
  const params = paramLists.length >= 2 ? extractParamsFromList(paramLists[1]) : [];
  const returnType = extractGoReturnType(node);
  const parentName = receiverType.replace(/^\*/, "");
  return {
    id: `${filePath}:${parentName}.${name}`,
    name,
    kind: "method",
    visibility: isExported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: isExported,
    parameters: params.length > 0 ? params : void 0,
    returns: returnType ? { type: returnType } : void 0,
    parentId: `${filePath}:${parentName}`,
    typeAnnotation: receiverType,
    docs,
    signature: buildSignature3(node)
  };
}
function extractTypeDeclaration(node, filePath, docs) {
  const results = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "type_spec") {
      const sym = extractTypeSpec(child, filePath, docs);
      if (sym) results.push(sym);
    } else if (child.type === "type_alias") {
      const sym = extractTypeAlias2(child, filePath, docs);
      if (sym) results.push(sym);
    }
  }
  return results;
}
function extractTypeSpec(node, filePath, docs) {
  const nameNode = node.childForFieldName("name") ?? findChild3(node, "type_identifier");
  if (!nameNode) return null;
  const name = nameNode.text;
  const isExported = isUpperFirst(name);
  const typeBody = node.childForFieldName("type");
  let kind = "type";
  if (typeBody) {
    if (typeBody.type === "struct_type") kind = "class";
    else if (typeBody.type === "interface_type") kind = "interface";
  }
  const children = [];
  if (typeBody?.type === "struct_type") {
    const fieldList = findChild3(typeBody, "field_declaration_list");
    if (fieldList) {
      for (let i = 0; i < fieldList.childCount; i++) {
        const field = fieldList.child(i);
        if (field.type === "field_declaration") {
          const fieldName = findChild3(field, "field_identifier");
          if (fieldName) {
            children.push(`${filePath}:${name}.${fieldName.text}`);
          }
        }
      }
    }
  }
  return {
    id: `${filePath}:${name}`,
    name,
    kind,
    visibility: isExported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: isExported,
    children: children.length > 0 ? children : void 0,
    docs,
    signature: `type ${name} ${typeBody?.type === "struct_type" ? "struct" : typeBody?.type === "interface_type" ? "interface" : typeBody?.text ?? ""}`.trim()
  };
}
function extractTypeAlias2(node, filePath, docs) {
  const nameNode = findChild3(node, "type_identifier");
  if (!nameNode) return null;
  const name = nameNode.text;
  const isExported = isUpperFirst(name);
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "type",
    visibility: isExported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column
    },
    exported: isExported,
    docs,
    signature: `type ${node.text}`
  };
}
function extractVarConst(node, filePath, docs) {
  const results = [];
  const isConst = node.type === "const_declaration";
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "const_spec" || child.type === "var_spec") {
      const nameNode = findChild3(child, "identifier");
      if (!nameNode) continue;
      const name = nameNode.text;
      const isExported = isUpperFirst(name);
      results.push({
        id: `${filePath}:${name}`,
        name,
        kind: isConst ? "constant" : "variable",
        visibility: isExported ? "public" : "private",
        location: {
          file: filePath,
          line: child.startPosition.row + 1,
          column: child.startPosition.column
        },
        exported: isExported,
        docs
      });
    }
  }
  return results;
}
function extractParams(node) {
  const paramLists = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "parameter_list") {
      paramLists.push(child);
    }
  }
  if (paramLists.length === 0) return [];
  return extractParamsFromList(paramLists[0]);
}
function extractParamsFromList(node) {
  const params = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "parameter_declaration") {
      const nameNode = findChild3(child, "identifier");
      let typeText = "";
      let foundName = false;
      for (let j = 0; j < child.childCount; j++) {
        const part = child.child(j);
        if (part.type === "identifier") {
          foundName = true;
          continue;
        }
        if (foundName && part.isNamed) {
          typeText = part.text;
          break;
        }
      }
      if (nameNode) {
        params.push({
          name: nameNode.text,
          type: typeText || void 0,
          optional: false,
          rest: false
        });
      }
    } else if (child.type === "variadic_parameter_declaration") {
      const nameNode = findChild3(child, "identifier");
      params.push({
        name: nameNode?.text ?? "args",
        optional: true,
        rest: true
      });
    }
  }
  return params;
}
function extractGoReturnType(node) {
  const result = node.childForFieldName("result");
  if (result) return result.text;
  let foundParams = false;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "parameter_list") {
      if (foundParams) {
        return child.text;
      }
      foundParams = true;
      continue;
    }
    if (foundParams && child.type !== "block" && child.isNamed) {
      if (child.type === "type_identifier" || child.type === "pointer_type" || child.type === "slice_type" || child.type === "map_type" || child.type === "qualified_type" || child.type === "interface_type") {
        return child.text;
      }
    }
  }
  return void 0;
}
function findPrecedingComment(root, nodeIndex) {
  const commentLines = [];
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = root.child(i);
    if (!prev) break;
    if (prev.type === "comment") {
      const text = prev.text.replace(/^\/\/\s?/, "").trim();
      commentLines.unshift(text);
    } else {
      break;
    }
  }
  if (commentLines.length === 0) return void 0;
  const summary = commentLines[0];
  const description = commentLines.length > 1 ? commentLines.join("\n") : void 0;
  return { summary, description };
}
function extractPackageDoc(root) {
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i);
    if (node.type === "package_clause") {
      return findPrecedingComment(root, i);
    }
  }
  return void 0;
}
function findChild3(node, type) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === type) return child;
  }
  return null;
}
function isUpperFirst(name) {
  if (!name) return false;
  const first = name[0];
  return first === first.toUpperCase() && first !== first.toLowerCase();
}
function stripQuotes3(s) {
  return s.replace(/^["'`]|["'`]$/g, "");
}
function buildSignature3(node) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return text.split("\n")[0].trim();
}
var GoParser;
var init_go = __esm({
  "src/analysis/parsers/go.ts"() {
    "use strict";
    init_tree_sitter_loader();
    GoParser = class {
      language = "go";
      async parse(content, filePath) {
        const symbols = [];
        const imports = [];
        const exports2 = [];
        let moduleDoc;
        const parser = await initParser("go");
        const tree = parser.parse(content);
        const root = tree.rootNode;
        moduleDoc = extractPackageDoc(root);
        for (let i = 0; i < root.childCount; i++) {
          const node = root.child(i);
          if (node.type === "import_declaration") {
            const imps = extractImports(node);
            imports.push(...imps);
            continue;
          }
          if (node.type === "function_declaration") {
            const docs = findPrecedingComment(root, i);
            const sym = extractFunction3(node, filePath, docs);
            if (sym) {
              symbols.push(sym);
              if (sym.exported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
          if (node.type === "method_declaration") {
            const docs = findPrecedingComment(root, i);
            const sym = extractMethod(node, filePath, docs);
            if (sym) {
              symbols.push(sym);
              if (sym.exported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
          if (node.type === "type_declaration") {
            const docs = findPrecedingComment(root, i);
            const syms = extractTypeDeclaration(node, filePath, docs);
            for (const sym of syms) {
              symbols.push(sym);
              if (sym.exported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
          if (node.type === "const_declaration" || node.type === "var_declaration") {
            const docs = findPrecedingComment(root, i);
            const syms = extractVarConst(node, filePath, docs);
            for (const sym of syms) {
              symbols.push(sym);
              if (sym.exported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
        }
        return { symbols, imports, exports: exports2, moduleDoc };
      }
    };
  }
});

// src/analysis/parsers/rust.ts
function extractUseDeclaration(node) {
  const text = node.text;
  const useMatch = text.match(/^(?:pub\s+)?use\s+(.+);$/s);
  if (!useMatch) return null;
  const usePath = useMatch[1].trim();
  const specifiers = [];
  const baseMatch = usePath.match(/^([^{]+)(?:::?\{([^}]+)\})?$/);
  if (baseMatch) {
    const base = baseMatch[1].replace(/::$/, "");
    if (baseMatch[2]) {
      const items = baseMatch[2].split(",").map((s) => s.trim());
      for (const item of items) {
        const aliasMatch = item.match(/^(\w+)\s+as\s+(\w+)$/);
        if (aliasMatch) {
          specifiers.push({
            name: aliasMatch[1],
            alias: aliasMatch[2],
            isDefault: false,
            isNamespace: false
          });
        } else if (item === "self") {
          specifiers.push({
            name: base.split("::").pop() || base,
            isDefault: false,
            isNamespace: false
          });
        } else if (item === "*") {
          specifiers.push({
            name: "*",
            isDefault: false,
            isNamespace: true
          });
        } else {
          specifiers.push({
            name: item,
            isDefault: false,
            isNamespace: false
          });
        }
      }
    } else {
      const parts = base.split("::");
      const last = parts[parts.length - 1];
      specifiers.push({
        name: last,
        isDefault: false,
        isNamespace: last === "*"
      });
    }
    return {
      source: baseMatch[2] ? baseMatch[1].replace(/::$/, "") : usePath.split("::").slice(0, -1).join("::"),
      specifiers,
      isTypeOnly: false
    };
  }
  return {
    source: usePath,
    specifiers: [],
    isTypeOnly: false
  };
}
function extractFunction4(node, filePath, docs) {
  const nameNode = findChild4(node, "identifier");
  if (!nameNode) return null;
  const name = nameNode.text;
  const isExported = isPub(node);
  const params = extractParams2(node);
  const returnType = extractReturnType3(node);
  const isAsync = node.text.startsWith("async") || node.text.includes("async fn");
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "function",
    visibility: isExported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: isExported,
    parameters: params.length > 0 ? params : void 0,
    returns: returnType ? { type: returnType } : void 0,
    async: isAsync,
    docs,
    signature: buildSignature4(node)
  };
}
function extractStruct(node, filePath, docs) {
  const nameNode = findChild4(node, "type_identifier");
  if (!nameNode) return null;
  const name = nameNode.text;
  const isExported = isPub(node);
  const children = [];
  const fieldList = findChild4(node, "field_declaration_list");
  if (fieldList) {
    for (let i = 0; i < fieldList.childCount; i++) {
      const field = fieldList.child(i);
      if (field.type === "field_declaration") {
        const fieldName = findChild4(field, "field_identifier");
        if (fieldName) {
          children.push(`${filePath}:${name}.${fieldName.text}`);
        }
      }
    }
  }
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "class",
    visibility: isExported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: isExported,
    children: children.length > 0 ? children : void 0,
    docs,
    signature: `struct ${name}`
  };
}
function extractEnum2(node, filePath, docs) {
  const nameNode = findChild4(node, "type_identifier");
  if (!nameNode) return null;
  const name = nameNode.text;
  const isExported = isPub(node);
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "enum",
    visibility: isExported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: isExported,
    docs,
    signature: `enum ${name}`
  };
}
function extractTrait(node, filePath, docs) {
  const nameNode = findChild4(node, "type_identifier");
  if (!nameNode) return null;
  const name = nameNode.text;
  const isExported = isPub(node);
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "interface",
    visibility: isExported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: isExported,
    docs,
    signature: `trait ${name}`
  };
}
function extractImplMethods(node, filePath, content) {
  const results = [];
  const typeNode = findChild4(node, "type_identifier");
  const typeName = typeNode?.text || "Unknown";
  const body = findChild4(node, "declaration_list");
  if (!body) return results;
  for (let i = 0; i < body.childCount; i++) {
    const child = body.child(i);
    if (child.type === "function_item") {
      const docs = findPrecedingDocCommentInner(body, i, content);
      const nameNode = findChild4(child, "identifier");
      if (!nameNode) continue;
      const name = nameNode.text;
      const isExported = isPub(child);
      const params = extractParams2(child);
      const returnType = extractReturnType3(child);
      results.push({
        id: `${filePath}:${typeName}.${name}`,
        name,
        kind: "method",
        visibility: isExported ? "public" : "private",
        location: {
          file: filePath,
          line: child.startPosition.row + 1,
          column: child.startPosition.column,
          endLine: child.endPosition.row + 1,
          endColumn: child.endPosition.column
        },
        exported: isExported,
        parameters: params.length > 0 ? params : void 0,
        returns: returnType ? { type: returnType } : void 0,
        parentId: `${filePath}:${typeName}`,
        docs,
        signature: buildSignature4(child)
      });
    }
  }
  return results;
}
function extractTypeAlias3(node, filePath, docs) {
  const nameNode = findChild4(node, "type_identifier");
  if (!nameNode) return null;
  const name = nameNode.text;
  const isExported = isPub(node);
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "type",
    visibility: isExported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column
    },
    exported: isExported,
    docs,
    signature: `type ${name}`
  };
}
function extractConstStatic(node, filePath, docs) {
  const nameNode = findChild4(node, "identifier");
  if (!nameNode) return null;
  const name = nameNode.text;
  const isExported = isPub(node);
  const isConst = node.type === "const_item";
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "constant",
    visibility: isExported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column
    },
    exported: isExported,
    docs,
    signature: isConst ? `const ${name}` : `static ${name}`
  };
}
function extractParams2(node) {
  const params = [];
  const paramList = findChild4(node, "parameters");
  if (!paramList) return params;
  for (let i = 0; i < paramList.childCount; i++) {
    const child = paramList.child(i);
    if (child.type === "parameter") {
      const pattern = findChild4(child, "identifier");
      if (pattern && pattern.text !== "self") {
        const typeNode = child.childForFieldName("type");
        params.push({
          name: pattern.text,
          type: typeNode?.text || void 0,
          optional: false,
          rest: false
        });
      }
    } else if (child.type === "self_parameter") {
    }
  }
  return params;
}
function extractReturnType3(node) {
  const text = node.text;
  const arrowMatch = text.match(/->\s*([^{]+)/);
  if (arrowMatch) {
    return arrowMatch[1].trim();
  }
  return void 0;
}
function extractModuleDoc2(root, content) {
  const lines = content.split("\n");
  const docLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//!")) {
      docLines.push(trimmed.replace(/^\/\/!\s?/, ""));
    } else if (trimmed === "" && docLines.length > 0) {
      continue;
    } else if (docLines.length > 0) {
      break;
    } else if (trimmed !== "" && !trimmed.startsWith("//")) {
      break;
    }
  }
  if (docLines.length === 0) return void 0;
  return {
    summary: docLines[0],
    description: docLines.length > 1 ? docLines.join("\n") : void 0
  };
}
function findPrecedingDocComment(root, nodeIndex, content) {
  const docLines = [];
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = root.child(i);
    if (!prev) break;
    if (prev.type === "line_comment" || prev.type === "block_comment") {
      const text = prev.text;
      if (text.startsWith("///")) {
        docLines.unshift(text.replace(/^\/\/\/\s?/, ""));
      } else if (text.startsWith("/**")) {
        const cleaned = text.replace(/^\/\*\*\s*/, "").replace(/\s*\*\/$/, "").split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trim()).filter(Boolean);
        docLines.unshift(...cleaned);
      } else {
        break;
      }
    } else if (prev.type === "attribute_item") {
      continue;
    } else {
      break;
    }
  }
  if (docLines.length === 0) return void 0;
  return {
    summary: docLines[0],
    description: docLines.length > 1 ? docLines.join("\n") : void 0
  };
}
function findPrecedingDocCommentInner(parent, nodeIndex, content) {
  const docLines = [];
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = parent.child(i);
    if (!prev) break;
    if (prev.type === "line_comment" || prev.type === "block_comment") {
      const text = prev.text;
      if (text.startsWith("///")) {
        docLines.unshift(text.replace(/^\/\/\/\s?/, ""));
      } else {
        break;
      }
    } else if (prev.type === "attribute_item") {
      continue;
    } else {
      break;
    }
  }
  if (docLines.length === 0) return void 0;
  return {
    summary: docLines[0],
    description: docLines.length > 1 ? docLines.join("\n") : void 0
  };
}
function findChild4(node, type) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === type) return child;
  }
  return null;
}
function isPub(node) {
  const text = node.text;
  return text.startsWith("pub ") || text.startsWith("pub(");
}
function buildSignature4(node) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return text.split("\n")[0].trim();
}
var RustParser;
var init_rust = __esm({
  "src/analysis/parsers/rust.ts"() {
    "use strict";
    init_tree_sitter_loader();
    RustParser = class {
      language = "rust";
      async parse(content, filePath) {
        const symbols = [];
        const imports = [];
        const exports2 = [];
        let moduleDoc;
        const parser = await initParser("rust");
        const tree = parser.parse(content);
        const root = tree.rootNode;
        moduleDoc = extractModuleDoc2(root, content);
        for (let i = 0; i < root.childCount; i++) {
          const node = root.child(i);
          if (node.type === "use_declaration") {
            const imp = extractUseDeclaration(node);
            if (imp) {
              imports.push(imp);
              if (isPub(node)) {
                for (const spec of imp.specifiers) {
                  exports2.push({
                    name: spec.alias || spec.name,
                    isDefault: false,
                    isReExport: true,
                    symbolId: `${filePath}:${spec.name}`
                  });
                }
              }
            }
            continue;
          }
          if (node.type === "function_item") {
            const docs = findPrecedingDocComment(root, i, content);
            const sym = extractFunction4(node, filePath, docs);
            if (sym) {
              symbols.push(sym);
              if (sym.exported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
          if (node.type === "struct_item") {
            const docs = findPrecedingDocComment(root, i, content);
            const sym = extractStruct(node, filePath, docs);
            if (sym) {
              symbols.push(sym);
              if (sym.exported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
          if (node.type === "enum_item") {
            const docs = findPrecedingDocComment(root, i, content);
            const sym = extractEnum2(node, filePath, docs);
            if (sym) {
              symbols.push(sym);
              if (sym.exported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
          if (node.type === "trait_item") {
            const docs = findPrecedingDocComment(root, i, content);
            const sym = extractTrait(node, filePath, docs);
            if (sym) {
              symbols.push(sym);
              if (sym.exported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
          if (node.type === "impl_item") {
            const methods = extractImplMethods(node, filePath, content);
            for (const sym of methods) {
              symbols.push(sym);
              if (sym.exported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
          if (node.type === "type_item") {
            const docs = findPrecedingDocComment(root, i, content);
            const sym = extractTypeAlias3(node, filePath, docs);
            if (sym) {
              symbols.push(sym);
              if (sym.exported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
          if (node.type === "const_item" || node.type === "static_item") {
            const docs = findPrecedingDocComment(root, i, content);
            const sym = extractConstStatic(node, filePath, docs);
            if (sym) {
              symbols.push(sym);
              if (sym.exported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
        }
        return { symbols, imports, exports: exports2, moduleDoc };
      }
    };
  }
});

// src/analysis/parsers/java.ts
function extractImport3(node) {
  const text = node.text;
  const isStatic = text.includes("import static");
  const match = text.match(/import\s+(?:static\s+)?([\w.]+(?:\.\*)?)\s*;/);
  if (!match) return null;
  const source = match[1];
  const parts = source.split(".");
  const lastName = parts[parts.length - 1];
  return {
    source: parts.slice(0, -1).join("."),
    specifiers: [{
      name: lastName,
      isDefault: false,
      isNamespace: lastName === "*"
    }],
    isTypeOnly: !isStatic
  };
}
function extractTypeDeclaration2(node, filePath, docs, content) {
  const results = [];
  const nameNode = findChild5(node, "identifier");
  if (!nameNode) return results;
  const name = nameNode.text;
  const isPublic = hasModifier(node, "public");
  let kind = "class";
  if (node.type === "interface_declaration") kind = "interface";
  else if (node.type === "enum_declaration") kind = "enum";
  else if (node.type === "record_declaration") kind = "class";
  let extendsName;
  const implementsList = [];
  const superclass = findChild5(node, "superclass");
  if (superclass) {
    const typeNode = findChild5(superclass, "type_identifier");
    extendsName = typeNode?.text;
  }
  const interfaces = findChild5(node, "super_interfaces");
  if (interfaces) {
    const typeList = findChild5(interfaces, "type_list");
    if (typeList) {
      for (let i = 0; i < typeList.childCount; i++) {
        const child = typeList.child(i);
        if (child.type === "type_identifier") {
          implementsList.push(child.text);
        }
      }
    }
  }
  const children = [];
  const body = findChild5(node, "class_body") || findChild5(node, "interface_body") || findChild5(node, "enum_body");
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i);
      if (member.type === "method_declaration" || member.type === "constructor_declaration") {
        const memberDocs = findPrecedingJavadocInner(body, i, content);
        const memberName = findChild5(member, "identifier");
        if (!memberName) continue;
        const mName = memberName.text;
        const mIsPublic = hasModifier(member, "public");
        const params = extractMethodParams(member);
        const returnType = extractMethodReturnType(member);
        const methodSym = {
          id: `${filePath}:${name}.${mName}`,
          name: mName,
          kind: member.type === "constructor_declaration" ? "method" : "method",
          visibility: mIsPublic ? "public" : hasModifier(member, "protected") ? "protected" : "private",
          location: {
            file: filePath,
            line: member.startPosition.row + 1,
            column: member.startPosition.column,
            endLine: member.endPosition.row + 1,
            endColumn: member.endPosition.column
          },
          exported: mIsPublic,
          parameters: params.length > 0 ? params : void 0,
          returns: returnType ? { type: returnType } : void 0,
          parentId: `${filePath}:${name}`,
          docs: memberDocs,
          signature: buildSignature5(member)
        };
        results.push(methodSym);
        children.push(methodSym.id);
      }
      if (member.type === "field_declaration") {
        const fieldName = findChild5(member, "variable_declarator");
        if (fieldName) {
          const fName = findChild5(fieldName, "identifier");
          if (fName) {
            children.push(`${filePath}:${name}.${fName.text}`);
          }
        }
      }
    }
  }
  const typeSym = {
    id: `${filePath}:${name}`,
    name,
    kind,
    visibility: isPublic ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: isPublic,
    extends: extendsName,
    implements: implementsList.length > 0 ? implementsList : void 0,
    children: children.length > 0 ? children : void 0,
    docs,
    signature: buildTypeSignature(node, name, kind)
  };
  results.unshift(typeSym);
  return results;
}
function extractMethodParams(node) {
  const params = [];
  const formalParams = findChild5(node, "formal_parameters");
  if (!formalParams) return params;
  for (let i = 0; i < formalParams.childCount; i++) {
    const child = formalParams.child(i);
    if (child.type === "formal_parameter" || child.type === "spread_parameter") {
      const nameNode = findChild5(child, "identifier");
      const typeNode = child.childCount > 0 ? child.child(0) : null;
      let typeName = "";
      for (let j = 0; j < child.childCount; j++) {
        const part = child.child(j);
        if (part.type === "identifier") break;
        if (part.isNamed) typeName = part.text;
      }
      if (nameNode) {
        params.push({
          name: nameNode.text,
          type: typeName || void 0,
          optional: false,
          rest: child.type === "spread_parameter"
        });
      }
    }
  }
  return params;
}
function extractMethodReturnType(node) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "identifier" || child.type === "formal_parameters") break;
    if (child.type === "void_type" || child.type === "type_identifier" || child.type === "generic_type" || child.type === "array_type" || child.type === "integral_type" || child.type === "floating_point_type" || child.type === "boolean_type") {
      return child.text;
    }
  }
  return void 0;
}
function extractPackageDoc2(root, content) {
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i);
    if (node.type === "package_declaration") {
      return findPrecedingJavadoc(root, i, content);
    }
  }
  return void 0;
}
function findPrecedingJavadoc(root, nodeIndex, content) {
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = root.child(i);
    if (!prev) break;
    if (prev.type === "block_comment" || prev.type === "comment") {
      return parseJavadoc(prev.text);
    } else if (prev.type === "marker_annotation" || prev.type === "annotation") {
      continue;
    } else {
      break;
    }
  }
  return void 0;
}
function findPrecedingJavadocInner(parent, nodeIndex, content) {
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = parent.child(i);
    if (!prev) break;
    if (prev.type === "block_comment" || prev.type === "comment") {
      return parseJavadoc(prev.text);
    } else if (prev.type === "marker_annotation" || prev.type === "annotation") {
      continue;
    } else {
      break;
    }
  }
  return void 0;
}
function parseJavadoc(text) {
  if (!text.startsWith("/**")) return void 0;
  const lines = text.replace(/^\/\*\*\s*/, "").replace(/\s*\*\/$/, "").split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trim()).filter(Boolean);
  if (lines.length === 0) return void 0;
  const descLines = [];
  const params = {};
  let returns;
  let deprecated;
  for (const line of lines) {
    if (line.startsWith("@param ")) {
      const match = line.match(/@param\s+(\w+)\s+(.*)/);
      if (match) params[match[1]] = match[2];
    } else if (line.startsWith("@return ") || line.startsWith("@returns ")) {
      returns = line.replace(/@returns?\s+/, "");
    } else if (line.startsWith("@deprecated")) {
      deprecated = line.replace(/@deprecated\s*/, "") || true;
    } else if (!line.startsWith("@")) {
      descLines.push(line);
    }
  }
  const summary = descLines[0] || "";
  const description = descLines.length > 1 ? descLines.join("\n") : void 0;
  return {
    summary,
    description,
    params: Object.keys(params).length > 0 ? params : void 0,
    returns,
    deprecated
  };
}
function findChild5(node, type) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === type) return child;
  }
  return null;
}
function hasModifier(node, modifier) {
  const modifiers = findChild5(node, "modifiers");
  if (modifiers) {
    return modifiers.text.includes(modifier);
  }
  const text = node.text;
  const firstLine = text.split("\n")[0];
  return firstLine.includes(modifier);
}
function buildSignature5(node) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return text.split("\n")[0].trim();
}
function buildTypeSignature(node, name, kind) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return `${kind} ${name}`;
}
var JavaParser;
var init_java = __esm({
  "src/analysis/parsers/java.ts"() {
    "use strict";
    init_tree_sitter_loader();
    JavaParser = class {
      language = "java";
      async parse(content, filePath) {
        const symbols = [];
        const imports = [];
        const exports2 = [];
        let moduleDoc;
        const parser = await initParser("java");
        const tree = parser.parse(content);
        const root = tree.rootNode;
        moduleDoc = extractPackageDoc2(root, content);
        for (let i = 0; i < root.childCount; i++) {
          const node = root.child(i);
          if (node.type === "import_declaration") {
            const imp = extractImport3(node);
            if (imp) imports.push(imp);
            continue;
          }
          if (node.type === "class_declaration" || node.type === "interface_declaration" || node.type === "enum_declaration" || node.type === "record_declaration") {
            const docs = findPrecedingJavadoc(root, i, content);
            const syms = extractTypeDeclaration2(node, filePath, docs, content);
            for (const sym of syms) {
              symbols.push(sym);
              if (sym.exported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
        }
        return { symbols, imports, exports: exports2, moduleDoc };
      }
    };
  }
});

// src/analysis/parsers/csharp.ts
function extractUsing(node) {
  const text = node.text;
  const match = text.match(/using\s+(?:static\s+)?([\w.]+)\s*;/);
  if (!match) return null;
  const source = match[1];
  const parts = source.split(".");
  const lastName = parts[parts.length - 1];
  return {
    source,
    specifiers: [{
      name: lastName,
      isDefault: false,
      isNamespace: !text.includes("static")
    }],
    isTypeOnly: !text.includes("static")
  };
}
function extractTypeDeclaration3(node, filePath, docs, content) {
  const results = [];
  const nameNode = findChild6(node, "identifier");
  if (!nameNode) return results;
  const name = nameNode.text;
  const isPublic = hasModifier2(node, "public");
  const isInternal = hasModifier2(node, "internal");
  let kind = "class";
  if (node.type === "interface_declaration") kind = "interface";
  else if (node.type === "struct_declaration") kind = "class";
  else if (node.type === "enum_declaration") kind = "enum";
  else if (node.type === "record_declaration") kind = "class";
  const baseList = findChild6(node, "base_list");
  let extendsName;
  const implementsList = [];
  if (baseList) {
    for (let i = 0; i < baseList.childCount; i++) {
      const child = baseList.child(i);
      if (child.isNamed) {
        const typeName = child.text;
        if (!extendsName && kind === "class") {
          extendsName = typeName;
        } else {
          implementsList.push(typeName);
        }
      }
    }
  }
  const children = [];
  const body = findChild6(node, "declaration_list");
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i);
      if (member.type === "method_declaration" || member.type === "constructor_declaration") {
        const memberDocs = findPrecedingXmlDocInner(body, i, content);
        const memberName = findChild6(member, "identifier");
        if (!memberName) continue;
        const mName = memberName.text;
        const mIsPublic = hasModifier2(member, "public");
        const params = extractMethodParams2(member);
        const returnType = extractReturnType4(member);
        const methodSym = {
          id: `${filePath}:${name}.${mName}`,
          name: mName,
          kind: "method",
          visibility: mIsPublic ? "public" : hasModifier2(member, "protected") ? "protected" : hasModifier2(member, "internal") ? "internal" : "private",
          location: {
            file: filePath,
            line: member.startPosition.row + 1,
            column: member.startPosition.column,
            endLine: member.endPosition.row + 1,
            endColumn: member.endPosition.column
          },
          exported: mIsPublic || hasModifier2(member, "internal"),
          parameters: params.length > 0 ? params : void 0,
          returns: returnType ? { type: returnType } : void 0,
          parentId: `${filePath}:${name}`,
          docs: memberDocs,
          signature: buildSignature6(member)
        };
        results.push(methodSym);
        children.push(methodSym.id);
      }
      if (member.type === "property_declaration") {
        const memberDocs = findPrecedingXmlDocInner(body, i, content);
        const propName = findChild6(member, "identifier");
        if (propName) {
          const mIsPublic = hasModifier2(member, "public");
          const propSym = {
            id: `${filePath}:${name}.${propName.text}`,
            name: propName.text,
            kind: "property",
            visibility: mIsPublic ? "public" : "private",
            location: {
              file: filePath,
              line: member.startPosition.row + 1,
              column: member.startPosition.column
            },
            exported: mIsPublic,
            parentId: `${filePath}:${name}`,
            docs: memberDocs,
            signature: buildSignature6(member)
          };
          results.push(propSym);
          children.push(propSym.id);
        }
      }
    }
  }
  const typeSym = {
    id: `${filePath}:${name}`,
    name,
    kind,
    visibility: isPublic ? "public" : isInternal ? "internal" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: isPublic || isInternal,
    extends: extendsName,
    implements: implementsList.length > 0 ? implementsList : void 0,
    children: children.length > 0 ? children : void 0,
    docs,
    signature: buildTypeSignature2(node, name, kind)
  };
  results.unshift(typeSym);
  return results;
}
function extractMethodParams2(node) {
  const params = [];
  const paramList = findChild6(node, "parameter_list");
  if (!paramList) return params;
  for (let i = 0; i < paramList.childCount; i++) {
    const child = paramList.child(i);
    if (child.type === "parameter") {
      const nameNode = findChild6(child, "identifier");
      let typeName = "";
      for (let j = 0; j < child.childCount; j++) {
        const part = child.child(j);
        if (part.type === "identifier") break;
        if (part.isNamed && part.type !== "modifier") typeName = part.text;
      }
      if (nameNode) {
        params.push({
          name: nameNode.text,
          type: typeName || void 0,
          optional: child.text.includes("="),
          rest: child.text.startsWith("params")
        });
      }
    }
  }
  return params;
}
function extractReturnType4(node) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "identifier" || child.type === "parameter_list") break;
    if (child.type === "predefined_type" || child.type === "identifier" || child.type === "generic_name" || child.type === "nullable_type" || child.type === "array_type" || child.type === "void_keyword") {
      return child.text;
    }
  }
  return void 0;
}
function extractFileDoc(content) {
  const lines = content.split("\n");
  const docLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("///")) {
      const xmlContent = trimmed.replace(/^\/\/\/\s?/, "");
      docLines.push(xmlContent);
    } else if (trimmed === "" && docLines.length === 0) {
      continue;
    } else {
      break;
    }
  }
  return parseXmlDocLines(docLines);
}
function findPrecedingXmlDoc(root, nodeIndex, content) {
  const docLines = [];
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = root.child(i);
    if (!prev) break;
    if (prev.type === "comment") {
      const text = prev.text.trim();
      if (text.startsWith("///")) {
        docLines.unshift(text.replace(/^\/\/\/\s?/, ""));
      } else {
        break;
      }
    } else if (prev.type === "attribute_list") {
      continue;
    } else {
      break;
    }
  }
  return parseXmlDocLines(docLines);
}
function findPrecedingXmlDocInner(parent, nodeIndex, content) {
  const docLines = [];
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = parent.child(i);
    if (!prev) break;
    if (prev.type === "comment") {
      const text = prev.text.trim();
      if (text.startsWith("///")) {
        docLines.unshift(text.replace(/^\/\/\/\s?/, ""));
      } else {
        break;
      }
    } else if (prev.type === "attribute_list") {
      continue;
    } else {
      break;
    }
  }
  return parseXmlDocLines(docLines);
}
function parseXmlDocLines(lines) {
  if (lines.length === 0) return void 0;
  const fullText = lines.join("\n");
  const summaryMatch = fullText.match(/<summary>\s*([\s\S]*?)\s*<\/summary>/);
  const summary = summaryMatch ? summaryMatch[1].replace(/\s+/g, " ").trim() : lines[0].replace(/<[^>]+>/g, "").trim();
  if (!summary) return void 0;
  const params = {};
  const paramRegex = /<param\s+name="(\w+)">(.*?)<\/param>/g;
  let match;
  while ((match = paramRegex.exec(fullText)) !== null) {
    params[match[1]] = match[2].trim();
  }
  const returnsMatch = fullText.match(/<returns>(.*?)<\/returns>/);
  const returns = returnsMatch ? returnsMatch[1].trim() : void 0;
  return {
    summary,
    description: lines.length > 1 ? fullText.replace(/<[^>]+>/g, "").trim() : void 0,
    params: Object.keys(params).length > 0 ? params : void 0,
    returns
  };
}
function findChild6(node, type) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === type) return child;
  }
  return null;
}
function hasModifier2(node, modifier) {
  const text = node.text;
  const firstLine = text.split("{")[0] || text.split("\n")[0];
  return new RegExp(`\\b${modifier}\\b`).test(firstLine);
}
function buildSignature6(node) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return text.split("\n")[0].trim();
}
function buildTypeSignature2(node, name, kind) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return `${kind} ${name}`;
}
var CSharpParser;
var init_csharp = __esm({
  "src/analysis/parsers/csharp.ts"() {
    "use strict";
    init_tree_sitter_loader();
    CSharpParser = class {
      language = "csharp";
      async parse(content, filePath) {
        const symbols = [];
        const imports = [];
        const exports2 = [];
        let moduleDoc;
        const parser = await initParser("csharp");
        const tree = parser.parse(content);
        const root = tree.rootNode;
        this.walkNode(root, filePath, content, symbols, imports, exports2);
        moduleDoc = extractFileDoc(content);
        return { symbols, imports, exports: exports2, moduleDoc };
      }
      walkNode(node, filePath, content, symbols, imports, exports2) {
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child.type === "using_directive") {
            const imp = extractUsing(child);
            if (imp) imports.push(imp);
            continue;
          }
          if (child.type === "namespace_declaration" || child.type === "file_scoped_namespace_declaration") {
            const body = findChild6(child, "declaration_list");
            if (body) {
              this.walkNode(body, filePath, content, symbols, imports, exports2);
            }
            continue;
          }
          if (child.type === "class_declaration" || child.type === "interface_declaration" || child.type === "struct_declaration" || child.type === "enum_declaration" || child.type === "record_declaration") {
            const docs = findPrecedingXmlDoc(node, i, content);
            const syms = extractTypeDeclaration3(child, filePath, docs, content);
            for (const sym of syms) {
              symbols.push(sym);
              if (sym.exported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
        }
      }
    };
  }
});

// src/analysis/parsers/ruby.ts
function extractRequire(node) {
  const text = node.text;
  const match = text.match(/^(require|require_relative)\s+["']([^"']+)["']/);
  if (!match) return null;
  return {
    source: match[2],
    specifiers: [{
      name: match[2].split("/").pop() || match[2],
      isDefault: true,
      isNamespace: false
    }],
    isTypeOnly: false
  };
}
function extractClass3(node, filePath, docs, content, privateMethodNames, protectedMethodNames) {
  const results = [];
  const nameNode = findChild7(node, "constant") || findChild7(node, "scope_resolution");
  if (!nameNode) return results;
  const name = nameNode.text;
  const superclass = findChild7(node, "superclass");
  const extendsName = superclass ? superclass.text.replace(/^<\s*/, "") : void 0;
  const children = [];
  const body = findChild7(node, "body_statement");
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i);
      if (member.type === "method") {
        const memberDocs = findPrecedingComment2(body, i, content);
        const sym = extractMethod2(member, filePath, memberDocs, privateMethodNames, protectedMethodNames, name);
        if (sym) {
          results.push(sym);
          children.push(sym.id);
        }
      }
    }
  }
  const classSym = {
    id: `${filePath}:${name}`,
    name,
    kind: "class",
    visibility: "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: true,
    extends: extendsName,
    children: children.length > 0 ? children : void 0,
    docs,
    signature: `class ${name}${extendsName ? ` < ${extendsName}` : ""}`
  };
  results.unshift(classSym);
  return results;
}
function extractModule(node, filePath, docs) {
  const nameNode = findChild7(node, "constant") || findChild7(node, "scope_resolution");
  if (!nameNode) return null;
  const name = nameNode.text;
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "module",
    visibility: "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: true,
    docs,
    signature: `module ${name}`
  };
}
function extractMethod2(node, filePath, docs, privateMethodNames, protectedMethodNames, parentName) {
  const nameNode = findChild7(node, "identifier");
  if (!nameNode) return null;
  const name = nameNode.text;
  const isPrivate = privateMethodNames.has(name);
  const isProtected = protectedMethodNames.has(name);
  const visibility = isPrivate ? "private" : isProtected ? "protected" : "public";
  const params = extractParams3(node);
  return {
    id: parentName ? `${filePath}:${parentName}.${name}` : `${filePath}:${name}`,
    name,
    kind: "method",
    visibility,
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: !isPrivate,
    parameters: params.length > 0 ? params : void 0,
    parentId: parentName ? `${filePath}:${parentName}` : void 0,
    docs,
    signature: buildSignature7(node)
  };
}
function extractConstant(node, filePath) {
  const text = node.text;
  const match = text.match(/^([A-Z][A-Z0-9_]*)\s*=/);
  if (!match) return null;
  const name = match[1];
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "constant",
    visibility: "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column
    },
    exported: true
  };
}
function extractParams3(node) {
  const params = [];
  const paramList = findChild7(node, "method_parameters");
  if (!paramList) return params;
  for (let i = 0; i < paramList.childCount; i++) {
    const child = paramList.child(i);
    if (child.type === "identifier") {
      params.push({
        name: child.text,
        optional: false,
        rest: false
      });
    } else if (child.type === "optional_parameter") {
      const nameNode = findChild7(child, "identifier");
      if (nameNode) {
        params.push({
          name: nameNode.text,
          optional: true,
          rest: false
        });
      }
    } else if (child.type === "splat_parameter") {
      const nameNode = findChild7(child, "identifier");
      params.push({
        name: nameNode?.text ?? "args",
        optional: true,
        rest: true
      });
    } else if (child.type === "keyword_parameter") {
      const nameNode = findChild7(child, "identifier");
      if (nameNode) {
        params.push({
          name: nameNode.text,
          optional: true,
          rest: false
        });
      }
    }
  }
  return params;
}
function extractVisibilityBlocks(root, content, privateNames, protectedNames) {
  const lines = content.split("\n");
  let currentVisibility = "public";
  let inBody = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const explicitMatch = trimmed.match(/^(private|protected)\s+:(\w+(?:\s*,\s*:\w+)*)/);
    if (explicitMatch) {
      const vis = explicitMatch[1];
      const names = explicitMatch[2].split(",").map((n) => n.trim().replace(/^:/, ""));
      for (const name of names) {
        if (vis === "private") privateNames.add(name);
        else protectedNames.add(name);
      }
    }
  }
}
function findFirstDocComment(root, content) {
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i);
    if (node.type === "comment") {
      const text = node.text.replace(/^#\s?/, "").trim();
      if (text) {
        return { summary: text };
      }
    } else if (node.type !== "call" && node.type !== "command") {
      break;
    }
  }
  return void 0;
}
function findPrecedingComment2(root, nodeIndex, content) {
  const commentLines = [];
  const params = {};
  let returns;
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = root.child(i);
    if (!prev) break;
    if (prev.type === "comment") {
      const text = prev.text.replace(/^#\s?/, "").trim();
      const paramMatch = text.match(/^@param\s+(?:\[[\w:]+\]\s+)?(\w+)\s+(.*)/);
      if (paramMatch) {
        params[paramMatch[1]] = paramMatch[2];
        continue;
      }
      const returnMatch = text.match(/^@return\s+(.*)/);
      if (returnMatch) {
        returns = returnMatch[1];
        continue;
      }
      if (!text.startsWith("@")) {
        commentLines.unshift(text);
      }
    } else {
      break;
    }
  }
  if (commentLines.length === 0 && Object.keys(params).length === 0) return void 0;
  return {
    summary: commentLines[0] || "",
    description: commentLines.length > 1 ? commentLines.join("\n") : void 0,
    params: Object.keys(params).length > 0 ? params : void 0,
    returns
  };
}
function findChild7(node, type) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === type) return child;
  }
  return null;
}
function buildSignature7(node) {
  const text = node.text;
  const lines = text.split("\n");
  return lines[0].trim();
}
var RubyParser;
var init_ruby = __esm({
  "src/analysis/parsers/ruby.ts"() {
    "use strict";
    init_tree_sitter_loader();
    RubyParser = class {
      language = "ruby";
      async parse(content, filePath) {
        const symbols = [];
        const imports = [];
        const exports2 = [];
        let moduleDoc;
        const parser = await initParser("ruby");
        const tree = parser.parse(content);
        const root = tree.rootNode;
        const privateMethodNames = /* @__PURE__ */ new Set();
        const protectedMethodNames = /* @__PURE__ */ new Set();
        extractVisibilityBlocks(root, content, privateMethodNames, protectedMethodNames);
        moduleDoc = findFirstDocComment(root, content);
        for (let i = 0; i < root.childCount; i++) {
          const node = root.child(i);
          if (node.type === "call" || node.type === "command") {
            const imp = extractRequire(node);
            if (imp) {
              imports.push(imp);
              continue;
            }
          }
          if (node.type === "class") {
            const docs = findPrecedingComment2(root, i, content);
            const syms = extractClass3(node, filePath, docs, content, privateMethodNames, protectedMethodNames);
            for (const sym of syms) {
              symbols.push(sym);
              if (sym.exported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
          if (node.type === "module") {
            const docs = findPrecedingComment2(root, i, content);
            const sym = extractModule(node, filePath, docs);
            if (sym) {
              symbols.push(sym);
              exports2.push({
                name: sym.name,
                isDefault: false,
                isReExport: false,
                symbolId: sym.id
              });
            }
            continue;
          }
          if (node.type === "method") {
            const docs = findPrecedingComment2(root, i, content);
            const sym = extractMethod2(node, filePath, docs, privateMethodNames, protectedMethodNames);
            if (sym) {
              symbols.push(sym);
              if (sym.exported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
          if (node.type === "assignment") {
            const sym = extractConstant(node, filePath);
            if (sym) {
              symbols.push(sym);
              exports2.push({
                name: sym.name,
                isDefault: false,
                isReExport: false,
                symbolId: sym.id
              });
            }
            continue;
          }
        }
        return { symbols, imports, exports: exports2, moduleDoc };
      }
    };
  }
});

// src/analysis/parsers/php.ts
function extractUseDeclaration2(node) {
  const results = [];
  const text = node.text;
  const groupMatch = text.match(/use\s+([\w\\]+)\\\{([^}]+)\}/);
  if (groupMatch) {
    const base = groupMatch[1];
    const items = groupMatch[2].split(",").map((s) => s.trim());
    for (const item of items) {
      const aliasMatch = item.match(/(\w+)\s+as\s+(\w+)/);
      results.push({
        source: base,
        specifiers: [{
          name: aliasMatch ? aliasMatch[1] : item,
          alias: aliasMatch ? aliasMatch[2] : void 0,
          isDefault: false,
          isNamespace: false
        }],
        isTypeOnly: false
      });
    }
    return results;
  }
  const singleMatch = text.match(/use\s+([\w\\]+?)(?:\s+as\s+(\w+))?;/);
  if (singleMatch) {
    const source = singleMatch[1];
    const parts = source.split("\\");
    const name = parts[parts.length - 1];
    results.push({
      source: parts.slice(0, -1).join("\\"),
      specifiers: [{
        name,
        alias: singleMatch[2],
        isDefault: false,
        isNamespace: false
      }],
      isTypeOnly: false
    });
  }
  return results;
}
function extractClassDeclaration(node, filePath, docs, content) {
  const results = [];
  const nameNode = findChild8(node, "name");
  if (!nameNode) return results;
  const name = nameNode.text;
  const baseClause = findChild8(node, "base_clause");
  const extendsName = baseClause?.text.replace(/extends\s+/, "").trim();
  const interfaceClause = findChild8(node, "class_interface_clause");
  const implementsList = [];
  if (interfaceClause) {
    const text = interfaceClause.text.replace(/implements\s+/, "");
    implementsList.push(...text.split(",").map((s) => s.trim()).filter(Boolean));
  }
  const children = [];
  const body = findChild8(node, "declaration_list");
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i);
      if (member.type === "method_declaration") {
        const memberDocs = findPrecedingPhpDoc(body, i, content);
        const nameNode2 = findChild8(member, "name");
        if (!nameNode2) continue;
        const mName = nameNode2.text;
        const isPublic = hasVisibility(member, "public") || !hasAnyVisibility(member);
        const params = extractMethodParams3(member);
        const returnType = extractReturnType5(member);
        const methodSym = {
          id: `${filePath}:${name}.${mName}`,
          name: mName,
          kind: "method",
          visibility: isPublic ? "public" : hasVisibility(member, "protected") ? "protected" : "private",
          location: {
            file: filePath,
            line: member.startPosition.row + 1,
            column: member.startPosition.column,
            endLine: member.endPosition.row + 1,
            endColumn: member.endPosition.column
          },
          exported: isPublic,
          parameters: params.length > 0 ? params : void 0,
          returns: returnType ? { type: returnType } : void 0,
          parentId: `${filePath}:${name}`,
          docs: memberDocs,
          signature: buildSignature8(member)
        };
        results.push(methodSym);
        children.push(methodSym.id);
      }
      if (member.type === "property_declaration") {
        const propName = findChild8(member, "property_element");
        if (propName) {
          const varNode = findChild8(propName, "variable_name");
          if (varNode) {
            children.push(`${filePath}:${name}.${varNode.text}`);
          }
        }
      }
    }
  }
  const classSym = {
    id: `${filePath}:${name}`,
    name,
    kind: "class",
    visibility: "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: true,
    extends: extendsName,
    implements: implementsList.length > 0 ? implementsList : void 0,
    children: children.length > 0 ? children : void 0,
    docs,
    signature: buildTypeSignature3(node, name)
  };
  results.unshift(classSym);
  return results;
}
function extractInterfaceOrTrait(node, filePath, docs, kind) {
  const nameNode = findChild8(node, "name");
  if (!nameNode) return null;
  const name = nameNode.text;
  return {
    id: `${filePath}:${name}`,
    name,
    kind,
    visibility: "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: true,
    docs,
    signature: `${node.type.replace("_declaration", "")} ${name}`
  };
}
function extractFunction5(node, filePath, docs) {
  const nameNode = findChild8(node, "name");
  if (!nameNode) return null;
  const name = nameNode.text;
  const params = extractMethodParams3(node);
  const returnType = extractReturnType5(node);
  return {
    id: `${filePath}:${name}`,
    name,
    kind: "function",
    visibility: "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: true,
    parameters: params.length > 0 ? params : void 0,
    returns: returnType ? { type: returnType } : void 0,
    docs,
    signature: buildSignature8(node)
  };
}
function extractMethodParams3(node) {
  const params = [];
  const paramList = findChild8(node, "formal_parameters");
  if (!paramList) return params;
  for (let i = 0; i < paramList.childCount; i++) {
    const child = paramList.child(i);
    if (child.type === "simple_parameter" || child.type === "property_promotion_parameter") {
      const varNode = findChild8(child, "variable_name");
      const typeNode = findChild8(child, "type_list") || findChild8(child, "named_type") || findChild8(child, "primitive_type");
      if (varNode) {
        params.push({
          name: varNode.text.replace(/^\$/, ""),
          type: typeNode?.text || void 0,
          optional: child.text.includes("="),
          rest: false
        });
      }
    } else if (child.type === "variadic_parameter") {
      const varNode = findChild8(child, "variable_name");
      params.push({
        name: varNode?.text.replace(/^\$/, "") ?? "args",
        optional: true,
        rest: true
      });
    }
  }
  return params;
}
function extractReturnType5(node) {
  const text = node.text;
  const match = text.match(/\)\s*:\s*([\w|\\?]+)/);
  if (match) return match[1];
  return void 0;
}
function findFileDoc(root, content) {
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i);
    if (node.type === "comment") {
      return parsePhpDoc(node.text);
    } else if (node.type === "php_tag" || node.type === "text") {
      continue;
    } else {
      break;
    }
  }
  return void 0;
}
function findPrecedingPhpDoc(parent, nodeIndex, content) {
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = parent.child(i);
    if (!prev) break;
    if (prev.type === "comment") {
      return parsePhpDoc(prev.text);
    } else if (prev.type === "attribute_list" || prev.type === "attribute_group") {
      continue;
    } else {
      break;
    }
  }
  return void 0;
}
function parsePhpDoc(text) {
  if (!text.startsWith("/**")) return void 0;
  const lines = text.replace(/^\/\*\*\s*/, "").replace(/\s*\*\/$/, "").split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trim()).filter(Boolean);
  if (lines.length === 0) return void 0;
  const descLines = [];
  const params = {};
  let returns;
  let deprecated;
  for (const line of lines) {
    if (line.startsWith("@param")) {
      const match = line.match(/@param\s+\S+\s+\$(\w+)\s*(.*)/);
      if (match) params[match[1]] = match[2];
    } else if (line.startsWith("@return")) {
      returns = line.replace(/@returns?\s+\S+\s*/, "");
    } else if (line.startsWith("@deprecated")) {
      deprecated = line.replace(/@deprecated\s*/, "") || true;
    } else if (line.startsWith("@throws")) {
    } else if (!line.startsWith("@")) {
      descLines.push(line);
    }
  }
  const summary = descLines[0] || "";
  const description = descLines.length > 1 ? descLines.join("\n") : void 0;
  return {
    summary,
    description,
    params: Object.keys(params).length > 0 ? params : void 0,
    returns,
    deprecated
  };
}
function findChild8(node, type) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === type) return child;
  }
  return null;
}
function hasVisibility(node, visibility) {
  const text = node.text;
  const firstLine = text.split("{")[0] || text.split("\n")[0];
  return new RegExp(`\\b${visibility}\\b`).test(firstLine);
}
function hasAnyVisibility(node) {
  return hasVisibility(node, "public") || hasVisibility(node, "protected") || hasVisibility(node, "private");
}
function buildSignature8(node) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return text.split("\n")[0].trim();
}
function buildTypeSignature3(node, name) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return `class ${name}`;
}
var PhpParser;
var init_php = __esm({
  "src/analysis/parsers/php.ts"() {
    "use strict";
    init_tree_sitter_loader();
    PhpParser = class {
      language = "php";
      async parse(content, filePath) {
        const symbols = [];
        const imports = [];
        const exports2 = [];
        let moduleDoc;
        const parser = await initParser("php");
        const tree = parser.parse(content);
        const root = tree.rootNode;
        const program2 = root.type === "program" ? root : root;
        moduleDoc = findFileDoc(program2, content);
        this.walkNode(program2, filePath, content, symbols, imports, exports2);
        return { symbols, imports, exports: exports2, moduleDoc };
      }
      walkNode(node, filePath, content, symbols, imports, exports2) {
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child.type === "namespace_use_declaration") {
            const imps = extractUseDeclaration2(child);
            imports.push(...imps);
            continue;
          }
          if (child.type === "namespace_definition") {
            const body = findChild8(child, "compound_statement") || findChild8(child, "declaration_list");
            if (body) {
              this.walkNode(body, filePath, content, symbols, imports, exports2);
            }
            continue;
          }
          if (child.type === "class_declaration") {
            const docs = findPrecedingPhpDoc(node, i, content);
            const syms = extractClassDeclaration(child, filePath, docs, content);
            for (const sym of syms) {
              symbols.push(sym);
              if (sym.exported) {
                exports2.push({
                  name: sym.name,
                  isDefault: false,
                  isReExport: false,
                  symbolId: sym.id
                });
              }
            }
            continue;
          }
          if (child.type === "interface_declaration") {
            const docs = findPrecedingPhpDoc(node, i, content);
            const sym = extractInterfaceOrTrait(child, filePath, docs, "interface");
            if (sym) {
              symbols.push(sym);
              exports2.push({
                name: sym.name,
                isDefault: false,
                isReExport: false,
                symbolId: sym.id
              });
            }
            continue;
          }
          if (child.type === "trait_declaration") {
            const docs = findPrecedingPhpDoc(node, i, content);
            const sym = extractInterfaceOrTrait(child, filePath, docs, "class");
            if (sym) {
              symbols.push(sym);
              exports2.push({
                name: sym.name,
                isDefault: false,
                isReExport: false,
                symbolId: sym.id
              });
            }
            continue;
          }
          if (child.type === "enum_declaration") {
            const docs = findPrecedingPhpDoc(node, i, content);
            const sym = extractInterfaceOrTrait(child, filePath, docs, "enum");
            if (sym) {
              symbols.push(sym);
              exports2.push({
                name: sym.name,
                isDefault: false,
                isReExport: false,
                symbolId: sym.id
              });
            }
            continue;
          }
          if (child.type === "function_definition") {
            const docs = findPrecedingPhpDoc(node, i, content);
            const sym = extractFunction5(child, filePath, docs);
            if (sym) {
              symbols.push(sym);
              exports2.push({
                name: sym.name,
                isDefault: false,
                isReExport: false,
                symbolId: sym.id
              });
            }
            continue;
          }
        }
      }
    };
  }
});

// src/analysis/parsers/text.ts
var TextParser;
var init_text = __esm({
  "src/analysis/parsers/text.ts"() {
    "use strict";
    TextParser = class {
      language;
      constructor(language) {
        this.language = language;
      }
      async parse(content, filePath) {
        const lines = content.split("\n");
        let summary = "";
        const commentPatterns = [
          /^\s*#\s*(.+)$/,
          // Shell/Python/YAML/TOML comments
          /^\s*\/\/\s*(.+)$/,
          // C-style line comments
          /^\s*\/\*\*?\s*(.+)$/,
          // C-style block comments start
          /^\s*--\s*(.+)$/,
          // SQL comments
          /^\s*<!--\s*(.+)$/
          // XML/HTML comments
        ];
        for (const line of lines.slice(0, 10)) {
          if (line.trim() === "") continue;
          for (const pattern of commentPatterns) {
            const match = line.match(pattern);
            if (match) {
              summary = match[1].trim();
              break;
            }
          }
          if (summary) break;
          break;
        }
        return {
          symbols: [],
          imports: [],
          exports: [],
          moduleDoc: summary ? { summary } : void 0
        };
      }
    };
  }
});

// src/analysis/parsers/yaml.ts
function detectYamlPurpose(content, filePath) {
  const lower = content.toLowerCase();
  const basename = filePath.split("/").pop()?.toLowerCase() || "";
  if (lower.includes("hosts:") && lower.includes("tasks:")) {
    return "Ansible playbook";
  }
  if (lower.includes("- role:") || lower.includes("ansible.builtin")) {
    return "Ansible role configuration";
  }
  if (lower.includes("services:") && (lower.includes("image:") || lower.includes("build:"))) {
    return "Docker Compose file";
  }
  if (lower.includes("apiversion:") && lower.includes("kind:")) {
    const kindMatch = content.match(/kind:\s*(\S+)/i);
    const kind = kindMatch ? kindMatch[1] : "resource";
    return `Kubernetes ${kind}`;
  }
  if ((lower.includes("on:") || lower.includes("'on':")) && lower.includes("jobs:")) {
    return "GitHub Actions workflow";
  }
  if (basename === "chart.yaml" || basename === "chart.yml") {
    return "Helm chart definition";
  }
  if (basename === "values.yaml" || basename === "values.yml") {
    return "Helm values configuration";
  }
  if (basename === ".gitlab-ci.yml") {
    return "GitLab CI/CD configuration";
  }
  if (basename === ".travis.yml") {
    return "Travis CI configuration";
  }
  if (basename.endsWith(".yml") || basename.endsWith(".yaml")) {
    return "YAML configuration file";
  }
  return "";
}
var YamlParser;
var init_yaml = __esm({
  "src/analysis/parsers/yaml.ts"() {
    "use strict";
    YamlParser = class {
      language = "yaml";
      async parse(content, filePath) {
        const symbols = [];
        const lines = content.split("\n");
        const topLevelKeyPattern = /^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/;
        let lineNum = 0;
        for (const line of lines) {
          lineNum++;
          const match = line.match(topLevelKeyPattern);
          if (match) {
            symbols.push({
              id: `${filePath}:${match[1]}`,
              name: match[1],
              kind: "property",
              visibility: "public",
              location: { file: filePath, line: lineNum, column: 0 },
              exported: true
            });
          }
        }
        const summary = detectYamlPurpose(content, filePath);
        return {
          symbols,
          imports: [],
          exports: [],
          moduleDoc: summary ? { summary } : void 0
        };
      }
    };
  }
});

// src/analysis/parsers/shell.ts
var ShellParser;
var init_shell = __esm({
  "src/analysis/parsers/shell.ts"() {
    "use strict";
    ShellParser = class {
      language = "shell";
      async parse(content, filePath) {
        const symbols = [];
        const lines = content.split("\n");
        let shellType = "shell";
        if (lines[0]?.startsWith("#!")) {
          const shebang = lines[0];
          if (shebang.includes("bash")) shellType = "bash";
          else if (shebang.includes("zsh")) shellType = "zsh";
          else if (shebang.includes("sh")) shellType = "sh";
        }
        const funcPattern1 = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\)\s*\{?/;
        const funcPattern2 = /^function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\(\))?\s*\{?/;
        const exportPattern = /^export\s+([A-Z_][A-Z0-9_]*)=/;
        const readonlyPattern = /^(?:readonly|declare\s+-r)\s+([A-Z_][A-Z0-9_]*)=/;
        let lineNum = 0;
        let prevComment = "";
        for (const line of lines) {
          lineNum++;
          const trimmed = line.trim();
          if (trimmed.startsWith("#") && !trimmed.startsWith("#!")) {
            prevComment = trimmed.replace(/^#\s*/, "");
            continue;
          }
          let match;
          match = trimmed.match(funcPattern1) || trimmed.match(funcPattern2);
          if (match) {
            symbols.push({
              id: `${filePath}:${match[1]}`,
              name: match[1],
              kind: "function",
              visibility: "public",
              location: { file: filePath, line: lineNum, column: 0 },
              exported: true,
              docs: prevComment ? { summary: prevComment } : void 0
            });
            prevComment = "";
            continue;
          }
          match = trimmed.match(exportPattern);
          if (match) {
            symbols.push({
              id: `${filePath}:${match[1]}`,
              name: match[1],
              kind: "variable",
              visibility: "public",
              location: { file: filePath, line: lineNum, column: 0 },
              exported: true,
              docs: prevComment ? { summary: prevComment } : void 0
            });
            prevComment = "";
            continue;
          }
          match = trimmed.match(readonlyPattern);
          if (match) {
            symbols.push({
              id: `${filePath}:${match[1]}`,
              name: match[1],
              kind: "constant",
              visibility: "public",
              location: { file: filePath, line: lineNum, column: 0 },
              exported: true,
              docs: prevComment ? { summary: prevComment } : void 0
            });
            prevComment = "";
            continue;
          }
          if (trimmed !== "") {
            prevComment = "";
          }
        }
        let summary = `${shellType.charAt(0).toUpperCase() + shellType.slice(1)} script`;
        const firstCommentLines = [];
        const startLine = lines[0]?.startsWith("#!") ? 1 : 0;
        for (let i = startLine; i < Math.min(lines.length, 20); i++) {
          const l = lines[i].trim();
          if (l.startsWith("#") && !l.startsWith("#!")) {
            firstCommentLines.push(l.replace(/^#\s*/, ""));
          } else if (l === "") {
            if (firstCommentLines.length > 0) break;
          } else {
            break;
          }
        }
        if (firstCommentLines.length > 0) {
          summary = firstCommentLines[0];
        }
        return {
          symbols,
          imports: [],
          exports: [],
          moduleDoc: { summary }
        };
      }
    };
  }
});

// src/analysis/parsers/hcl.ts
var HclParser;
var init_hcl = __esm({
  "src/analysis/parsers/hcl.ts"() {
    "use strict";
    HclParser = class {
      language = "hcl";
      async parse(content, filePath) {
        const symbols = [];
        const lines = content.split("\n");
        const blockPattern = /^(resource|data|variable|output|module|provider|terraform|locals)\s+(?:"([^"]+)"\s+)?(?:"([^"]+)"\s*)?\{/;
        const kindMap = {
          resource: "class",
          data: "property",
          variable: "variable",
          output: "property",
          module: "module",
          provider: "namespace",
          terraform: "namespace",
          locals: "namespace"
        };
        let lineNum = 0;
        let prevComment = "";
        for (const line of lines) {
          lineNum++;
          const trimmed = line.trim();
          if (trimmed.startsWith("#") || trimmed.startsWith("//")) {
            prevComment = trimmed.replace(/^[#/]+\s*/, "");
            continue;
          }
          const match = trimmed.match(blockPattern);
          if (match) {
            const blockType = match[1];
            const type = match[2] || "";
            const name = match[3] || match[2] || blockType;
            const displayName = type && match[3] ? `${blockType}.${type}.${match[3]}` : type ? `${blockType}.${type}` : blockType;
            symbols.push({
              id: `${filePath}:${displayName}`,
              name: displayName,
              kind: kindMap[blockType] || "property",
              visibility: "public",
              location: { file: filePath, line: lineNum, column: 0 },
              exported: true,
              typeAnnotation: blockType,
              docs: prevComment ? { summary: prevComment } : void 0
            });
            prevComment = "";
            continue;
          }
          if (trimmed !== "") {
            prevComment = "";
          }
        }
        const basename = filePath.split("/").pop() || "";
        let summary = "Terraform configuration";
        if (basename === "main.tf") summary = "Main Terraform configuration";
        else if (basename === "variables.tf") summary = "Terraform variable definitions";
        else if (basename === "outputs.tf") summary = "Terraform output definitions";
        else if (basename === "providers.tf") summary = "Terraform provider configuration";
        else if (basename === "versions.tf") summary = "Terraform version constraints";
        else if (basename === "backend.tf") summary = "Terraform backend configuration";
        else if (basename.endsWith(".hcl")) summary = "HCL configuration";
        return {
          symbols,
          imports: [],
          exports: [],
          moduleDoc: { summary }
        };
      }
    };
  }
});

// src/analysis/parsers/sql.ts
var SqlParser;
var init_sql = __esm({
  "src/analysis/parsers/sql.ts"() {
    "use strict";
    SqlParser = class {
      language = "sql";
      async parse(content, filePath) {
        const symbols = [];
        const lines = content.split("\n");
        const createPattern = /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP(?:ORARY)?\s+)?(TABLE|VIEW|(?:MATERIALIZED\s+)?VIEW|FUNCTION|PROCEDURE|TRIGGER|INDEX|TYPE|SCHEMA|SEQUENCE|ENUM)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|')?([a-zA-Z_][a-zA-Z0-9_.]*?)(?:`|"|')?\s*(?:\(|AS|;|\s)/i;
        const alterPattern = /^\s*ALTER\s+TABLE\s+(?:`|"|')?([a-zA-Z_][a-zA-Z0-9_.]*?)(?:`|"|')?\s/i;
        const kindMap = {
          table: "class",
          view: "interface",
          "materialized view": "interface",
          function: "function",
          procedure: "function",
          trigger: "function",
          index: "property",
          type: "type",
          schema: "namespace",
          sequence: "variable",
          enum: "enum"
        };
        let lineNum = 0;
        let prevComment = "";
        for (const line of lines) {
          lineNum++;
          const trimmed = line.trim();
          if (trimmed.startsWith("--")) {
            prevComment = trimmed.replace(/^--\s*/, "");
            continue;
          }
          const match = trimmed.match(createPattern);
          if (match) {
            const objType = match[1].toLowerCase();
            const objName = match[2];
            symbols.push({
              id: `${filePath}:${objName}`,
              name: objName,
              kind: kindMap[objType] || "property",
              visibility: "public",
              location: { file: filePath, line: lineNum, column: 0 },
              exported: true,
              typeAnnotation: objType.toUpperCase(),
              docs: prevComment ? { summary: prevComment } : void 0
            });
            prevComment = "";
            continue;
          }
          if (trimmed !== "" && !trimmed.startsWith("/*")) {
            prevComment = "";
          }
        }
        const tableCount = symbols.filter((s) => s.typeAnnotation === "TABLE").length;
        const funcCount = symbols.filter((s) => s.kind === "function").length;
        let summary = "SQL file";
        if (tableCount > 0 && funcCount > 0) {
          summary = `SQL schema (${tableCount} tables, ${funcCount} functions)`;
        } else if (tableCount > 0) {
          summary = `SQL schema (${tableCount} tables)`;
        } else if (funcCount > 0) {
          summary = `SQL functions (${funcCount} functions)`;
        } else if (symbols.length > 0) {
          summary = `SQL definitions (${symbols.length} objects)`;
        }
        const basename = filePath.split("/").pop()?.toLowerCase() || "";
        if (basename.includes("migration") || basename.includes("migrate")) {
          summary = `Database migration \u2014 ${summary}`;
        } else if (basename.includes("seed")) {
          summary = "Database seed data";
        }
        return {
          symbols,
          imports: [],
          exports: [],
          moduleDoc: { summary }
        };
      }
    };
  }
});

// src/analysis/parsers/markdown.ts
var MarkdownParser;
var init_markdown = __esm({
  "src/analysis/parsers/markdown.ts"() {
    "use strict";
    MarkdownParser = class {
      language = "markdown";
      async parse(content, filePath) {
        const symbols = [];
        const lines = content.split("\n");
        const headingPattern = /^(#{1,6})\s+(.+)$/;
        let lineNum = 0;
        for (const line of lines) {
          lineNum++;
          const match = line.match(headingPattern);
          if (match) {
            const level = match[1].length;
            const text = match[2].trim().replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/`([^`]*)`/g, "$1").replace(/\*\*([^*]*)\*\*/g, "$1").replace(/\*([^*]*)\*/g, "$1").trim();
            symbols.push({
              id: `${filePath}:${text}`,
              name: text,
              kind: "property",
              visibility: "public",
              location: { file: filePath, line: lineNum, column: 0 },
              exported: true,
              typeAnnotation: `h${level}`
            });
          }
        }
        let summary = "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === "") continue;
          const headingMatch = trimmed.match(headingPattern);
          if (headingMatch) {
            summary = headingMatch[2].trim();
          } else if (!trimmed.startsWith("---") && !trimmed.startsWith("```")) {
            if (!summary) summary = trimmed.slice(0, 120);
          }
          if (summary) break;
        }
        const basename = filePath.split("/").pop()?.toLowerCase() || "";
        if (basename === "readme.md") summary = summary || "Project README";
        else if (basename === "contributing.md") summary = summary || "Contributing guide";
        else if (basename === "changelog.md") summary = summary || "Project changelog";
        else if (basename === "license.md") summary = summary || "License information";
        return {
          symbols,
          imports: [],
          exports: [],
          moduleDoc: summary ? { summary } : void 0
        };
      }
    };
  }
});

// src/analysis/parsers/index.ts
function registerParser(parser) {
  parsers.set(parser.language, parser);
}
function getParser(language) {
  return parsers.get(language);
}
var parsers;
var init_parsers = __esm({
  "src/analysis/parsers/index.ts"() {
    "use strict";
    init_typescript();
    init_javascript();
    init_python();
    init_go();
    init_rust();
    init_java();
    init_csharp();
    init_ruby();
    init_php();
    init_text();
    init_yaml();
    init_shell();
    init_hcl();
    init_sql();
    init_markdown();
    parsers = /* @__PURE__ */ new Map();
    registerParser(new TypeScriptParser());
    registerParser(new JavaScriptParser());
    registerParser(new PythonParser());
    registerParser(new GoParser());
    registerParser(new RustParser());
    registerParser(new JavaParser());
    registerParser(new CSharpParser());
    registerParser(new RubyParser());
    registerParser(new PhpParser());
    registerParser(new YamlParser());
    registerParser(new ShellParser());
    registerParser(new HclParser());
    registerParser(new SqlParser());
    registerParser(new MarkdownParser());
    for (const lang of [
      "swift",
      "kotlin",
      "scala",
      "elixir",
      "dart",
      "lua",
      "zig",
      "haskell",
      "c",
      "cpp",
      "dockerfile",
      "toml",
      "json",
      "xml"
    ]) {
      if (!parsers.has(lang)) {
        registerParser(new TextParser(lang));
      }
    }
  }
});

// src/analysis/file-discovery.ts
async function discoverFiles(repoRoot, source) {
  const files = await (0, import_fast_glob.default)(source.include, {
    cwd: repoRoot,
    ignore: source.exclude,
    dot: false,
    onlyFiles: true,
    followSymbolicLinks: false,
    absolute: false
  });
  return files.sort();
}
var import_fast_glob;
var init_file_discovery = __esm({
  "src/analysis/file-discovery.ts"() {
    "use strict";
    import_fast_glob = __toESM(require("fast-glob"), 1);
  }
});

// src/utils/hash.ts
function computeFileHash(content) {
  return (0, import_crypto.createHash)("sha256").update(content).digest("hex").slice(0, 16);
}
var import_crypto;
var init_hash = __esm({
  "src/utils/hash.ts"() {
    "use strict";
    import_crypto = require("crypto");
  }
});

// src/analysis/workspace-resolver.ts
async function detectWorkspaces(repoRoot) {
  try {
    const pkgJsonPath = import_path3.default.join(repoRoot, "package.json");
    const pkgJson = JSON.parse(await (0, import_promises2.readFile)(pkgJsonPath, "utf-8"));
    const workspaceGlobs = pkgJson.workspaces;
    if (workspaceGlobs) {
      const globs = Array.isArray(workspaceGlobs) ? workspaceGlobs : workspaceGlobs.packages || [];
      const packages = await resolveWorkspaceGlobs(repoRoot, globs);
      if (packages.size > 0) {
        return { packages, type: "npm" };
      }
    }
  } catch {
  }
  try {
    const pnpmPath = import_path3.default.join(repoRoot, "pnpm-workspace.yaml");
    const content = await (0, import_promises2.readFile)(pnpmPath, "utf-8");
    const packagesMatch = content.match(/packages:\s*\n((?:\s+-\s+.+\n?)*)/);
    if (packagesMatch) {
      const globs = packagesMatch[1].split("\n").map((line) => line.replace(/^\s*-\s*['"]?/, "").replace(/['"]?\s*$/, "")).filter(Boolean);
      const packages = await resolveWorkspaceGlobs(repoRoot, globs);
      if (packages.size > 0) {
        return { packages, type: "pnpm" };
      }
    }
  } catch {
  }
  try {
    const lernaPath = import_path3.default.join(repoRoot, "lerna.json");
    const lernaJson = JSON.parse(await (0, import_promises2.readFile)(lernaPath, "utf-8"));
    const globs = lernaJson.packages || ["packages/*"];
    const packages = await resolveWorkspaceGlobs(repoRoot, globs);
    if (packages.size > 0) {
      return { packages, type: "lerna" };
    }
  } catch {
  }
  return { packages: /* @__PURE__ */ new Map(), type: "none" };
}
async function resolveWorkspaceGlobs(repoRoot, globs) {
  const packages = /* @__PURE__ */ new Map();
  const packageJsonGlobs = globs.map((g) => `${g}/package.json`);
  const matches = await (0, import_fast_glob2.default)(packageJsonGlobs, {
    cwd: repoRoot,
    onlyFiles: true,
    ignore: ["**/node_modules/**"]
  });
  for (const match of matches) {
    try {
      const fullPath = import_path3.default.join(repoRoot, match);
      const pkgJson = JSON.parse(await (0, import_promises2.readFile)(fullPath, "utf-8"));
      const name = pkgJson.name;
      if (name) {
        const dir = import_path3.default.dirname(match);
        packages.set(name, dir);
      }
    } catch {
    }
  }
  return packages;
}
var import_promises2, import_path3, import_fast_glob2;
var init_workspace_resolver = __esm({
  "src/analysis/workspace-resolver.ts"() {
    "use strict";
    import_promises2 = require("fs/promises");
    import_path3 = __toESM(require("path"), 1);
    import_fast_glob2 = __toESM(require("fast-glob"), 1);
  }
});

// src/analysis/ai-summarizer.ts
var ai_summarizer_exports = {};
__export(ai_summarizer_exports, {
  SummaryCache: () => SummaryCache,
  createProvider: () => createProvider,
  summarizeModules: () => summarizeModules
});
async function summarizeModules(options) {
  const {
    providerConfig,
    modules,
    readFile: readFile7,
    previousCache,
    onProgress,
    concurrency = 10,
    delayMs = 0
  } = options;
  const provider = createProvider(providerConfig);
  if (!provider) {
    return {
      modules,
      cache: previousCache || [],
      generated: 0,
      cached: 0,
      failed: 0
    };
  }
  const cache = new SummaryCache(previousCache);
  const limiter = new RateLimiter(concurrency, delayMs);
  let generated = 0;
  let cached = 0;
  let failed = 0;
  const isLocal = providerConfig.name === "local" || providerConfig.name === "ollama";
  let progressCount = 0;
  async function processModule(mod) {
    onProgress?.(++progressCount, modules.length, `Summarizing ${mod.filePath}`);
    const cachedModuleSummary = cache.get(mod.contentHash);
    let moduleSummary;
    if (cachedModuleSummary) {
      moduleSummary = cachedModuleSummary;
      cached++;
    } else {
      try {
        await limiter.acquire();
        const content = await readFile7(mod.filePath);
        moduleSummary = await provider.summarizeModule(mod, content);
        cache.set(mod.contentHash, moduleSummary);
        generated++;
      } catch {
        failed++;
      } finally {
        await limiter.release();
      }
    }
    const updatedSymbols = [...mod.symbols];
    if (!isLocal) {
      const exportedSymbols = updatedSymbols.filter(
        (s) => s.exported && (s.kind === "function" || s.kind === "class" || s.kind === "interface")
      );
      await Promise.all(exportedSymbols.map(async (sym) => {
        const symbolCacheKey = `${mod.contentHash}:${sym.id}`;
        const cachedSymSummary = cache.get(symbolCacheKey);
        if (cachedSymSummary) {
          sym.aiSummary = cachedSymSummary;
          cached++;
        } else {
          try {
            await limiter.acquire();
            const content = await readFile7(mod.filePath);
            const summary = await provider.summarizeSymbol(sym, content, mod.filePath);
            sym.aiSummary = summary;
            cache.set(symbolCacheKey, summary);
            generated++;
          } catch {
            failed++;
          } finally {
            await limiter.release();
          }
        }
      }));
    }
    return {
      ...mod,
      aiSummary: moduleSummary,
      symbols: updatedSymbols
    };
  }
  const updatedModules = await Promise.all(modules.map(processModule));
  return {
    modules: updatedModules,
    cache: cache.toArray(),
    generated,
    cached,
    failed
  };
}
var RateLimiter, SummaryCache;
var init_ai_summarizer = __esm({
  "src/analysis/ai-summarizer.ts"() {
    "use strict";
    init_providers();
    init_providers();
    RateLimiter = class {
      constructor(maxConcurrent, delayMs) {
        this.maxConcurrent = maxConcurrent;
        this.delayMs = delayMs;
      }
      queue = [];
      running = 0;
      async acquire() {
        if (this.running < this.maxConcurrent) {
          this.running++;
          return;
        }
        return new Promise((resolve) => {
          this.queue.push(resolve);
        });
      }
      async release() {
        if (this.delayMs > 0) {
          await new Promise((r) => setTimeout(r, this.delayMs));
        }
        this.running--;
        const next = this.queue.shift();
        if (next) {
          this.running++;
          next();
        }
      }
    };
    SummaryCache = class {
      entries = /* @__PURE__ */ new Map();
      constructor(existing) {
        if (existing) {
          for (const entry of existing) {
            this.entries.set(entry.contentHash, entry);
          }
        }
      }
      /** Get a cached summary if the content hash matches. */
      get(contentHash) {
        return this.entries.get(contentHash)?.summary;
      }
      /** Store a summary with its content hash. */
      set(contentHash, summary) {
        this.entries.set(contentHash, {
          contentHash,
          summary,
          generatedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      /** Export all cache entries for persistence. */
      toArray() {
        return [...this.entries.values()];
      }
      get size() {
        return this.entries.size;
      }
    };
  }
});

// src/analysis/insights.ts
var insights_exports = {};
__export(insights_exports, {
  detectCircularDependencies: () => detectCircularDependencies,
  detectDeepNesting: () => detectDeepNesting,
  detectGodModules: () => detectGodModules,
  detectInconsistentNaming: () => detectInconsistentNaming,
  detectMissingTypes: () => detectMissingTypes,
  detectOrphanModules: () => detectOrphanModules,
  detectOversizedModules: () => detectOversizedModules,
  detectUndocumentedExports: () => detectUndocumentedExports,
  runStaticInsights: () => runStaticInsights
});
function runStaticInsights(manifest) {
  const insights = [];
  insights.push(...detectUndocumentedExports(manifest));
  insights.push(...detectCircularDependencies(manifest));
  insights.push(...detectOversizedModules(manifest));
  insights.push(...detectGodModules(manifest));
  insights.push(...detectOrphanModules(manifest));
  insights.push(...detectMissingTypes(manifest));
  insights.push(...detectInconsistentNaming(manifest));
  insights.push(...detectDeepNesting(manifest));
  return insights;
}
function detectUndocumentedExports(manifest) {
  const insights = [];
  const undocumented = [];
  for (const mod of manifest.modules) {
    for (const sym of mod.symbols) {
      if (sym.exported && !sym.docs?.summary && !sym.aiSummary) {
        undocumented.push({ file: mod.filePath, name: sym.name });
      }
    }
  }
  if (undocumented.length > 0) {
    const affectedFiles = [...new Set(undocumented.map((u) => u.file))];
    insights.push({
      id: "undocumented-exports",
      category: "documentation",
      severity: undocumented.length > 20 ? "warning" : "info",
      title: `${undocumented.length} undocumented exported symbol${undocumented.length > 1 ? "s" : ""}`,
      description: `Found ${undocumented.length} exported symbols without JSDoc/docstring documentation across ${affectedFiles.length} file${affectedFiles.length > 1 ? "s" : ""}. Examples: ${undocumented.slice(0, 5).map((u) => `\`${u.name}\``).join(", ")}${undocumented.length > 5 ? "..." : ""}.`,
      affectedFiles: affectedFiles.slice(0, 10),
      suggestion: "Add JSDoc comments or docstrings to all exported symbols to improve API documentation quality."
    });
  }
  return insights;
}
function detectCircularDependencies(manifest) {
  const insights = [];
  const { edges } = manifest.dependencyGraph;
  const adj = /* @__PURE__ */ new Map();
  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from).push(edge.to);
  }
  const visited = /* @__PURE__ */ new Set();
  const inStack = /* @__PURE__ */ new Set();
  const cycles = [];
  function dfs(node, path26) {
    if (inStack.has(node)) {
      const cycleStart = path26.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push(path26.slice(cycleStart));
      }
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    inStack.add(node);
    for (const neighbor of adj.get(node) || []) {
      dfs(neighbor, [...path26, node]);
    }
    inStack.delete(node);
  }
  for (const node of manifest.dependencyGraph.nodes) {
    dfs(node, []);
    if (cycles.length >= 10) break;
  }
  if (cycles.length > 0) {
    const affectedFiles = [...new Set(cycles.flat())];
    insights.push({
      id: "circular-dependencies",
      category: "architecture",
      severity: "warning",
      title: `${cycles.length} circular dependenc${cycles.length > 1 ? "ies" : "y"} detected`,
      description: `Found ${cycles.length} circular dependency chain${cycles.length > 1 ? "s" : ""} in the module graph. Example: ${cycles[0].map((f) => `\`${f.split("/").pop()}\``).join(" \u2192 ")} \u2192 ...`,
      affectedFiles: affectedFiles.slice(0, 10),
      suggestion: "Break circular dependencies by extracting shared types into a separate module or using dependency inversion."
    });
  }
  return insights;
}
function detectOversizedModules(manifest, maxLines = 500, maxSymbols = 30) {
  const insights = [];
  const oversized = [];
  for (const mod of manifest.modules) {
    if (mod.lineCount > maxLines || mod.symbols.length > maxSymbols) {
      oversized.push({
        file: mod.filePath,
        lines: mod.lineCount,
        symbols: mod.symbols.length
      });
    }
  }
  if (oversized.length > 0) {
    insights.push({
      id: "oversized-modules",
      category: "code-quality",
      severity: oversized.length > 5 ? "warning" : "info",
      title: `${oversized.length} oversized module${oversized.length > 1 ? "s" : ""}`,
      description: `Found ${oversized.length} module${oversized.length > 1 ? "s" : ""} exceeding ${maxLines} lines or ${maxSymbols} symbols. Largest: \`${oversized[0].file}\` (${oversized[0].lines} lines, ${oversized[0].symbols} symbols).`,
      affectedFiles: oversized.map((o) => o.file).slice(0, 10),
      suggestion: "Consider splitting large modules into smaller, focused files with single responsibility."
    });
  }
  return insights;
}
function detectGodModules(manifest, maxEdges = 15) {
  const insights = [];
  const { edges } = manifest.dependencyGraph;
  const edgeCounts = /* @__PURE__ */ new Map();
  for (const edge of edges) {
    if (!edgeCounts.has(edge.from)) edgeCounts.set(edge.from, { incoming: 0, outgoing: 0 });
    if (!edgeCounts.has(edge.to)) edgeCounts.set(edge.to, { incoming: 0, outgoing: 0 });
    edgeCounts.get(edge.from).outgoing++;
    edgeCounts.get(edge.to).incoming++;
  }
  const godModules = [...edgeCounts.entries()].filter(([, counts]) => counts.incoming + counts.outgoing > maxEdges).sort((a, b) => b[1].incoming + b[1].outgoing - (a[1].incoming + a[1].outgoing));
  if (godModules.length > 0) {
    insights.push({
      id: "god-modules",
      category: "architecture",
      severity: godModules.length > 3 ? "warning" : "info",
      title: `${godModules.length} god module${godModules.length > 1 ? "s" : ""} with excessive connections`,
      description: `Found ${godModules.length} module${godModules.length > 1 ? "s" : ""} with more than ${maxEdges} dependency connections. Most connected: \`${godModules[0][0]}\` (${godModules[0][1].incoming} in, ${godModules[0][1].outgoing} out).`,
      affectedFiles: godModules.map(([f]) => f).slice(0, 10),
      suggestion: "Consider introducing intermediate abstraction layers or splitting responsibilities to reduce coupling."
    });
  }
  return insights;
}
function detectOrphanModules(manifest) {
  const insights = [];
  const { nodes, edges } = manifest.dependencyGraph;
  const connectedNodes = /* @__PURE__ */ new Set();
  for (const edge of edges) {
    connectedNodes.add(edge.from);
    connectedNodes.add(edge.to);
  }
  const orphans = nodes.filter((n) => !connectedNodes.has(n));
  const nonEntryOrphans = orphans.filter(
    (o) => !o.includes("index.") && !o.includes("main.") && !o.includes("app.")
  );
  if (nonEntryOrphans.length > 0) {
    insights.push({
      id: "orphan-modules",
      category: "code-quality",
      severity: nonEntryOrphans.length > 5 ? "warning" : "info",
      title: `${nonEntryOrphans.length} orphan module${nonEntryOrphans.length > 1 ? "s" : ""} (potential dead code)`,
      description: `Found ${nonEntryOrphans.length} module${nonEntryOrphans.length > 1 ? "s" : ""} with no imports or exports in the dependency graph. These may be unused dead code.`,
      affectedFiles: nonEntryOrphans.slice(0, 10),
      suggestion: "Review orphan modules \u2014 remove if unused, or add explicit imports/exports if they are needed."
    });
  }
  return insights;
}
function detectMissingTypes(manifest) {
  const insights = [];
  const untyped = [];
  for (const mod of manifest.modules) {
    if (mod.language !== "typescript") continue;
    for (const sym of mod.symbols) {
      if (sym.exported && sym.kind === "function") {
        if (sym.returns?.type === "any" || !sym.returns?.type && !sym.signature?.includes(":")) {
          untyped.push({ file: mod.filePath, name: sym.name });
        }
        if (sym.parameters) {
          for (const param of sym.parameters) {
            if (param.type === "any") {
              untyped.push({ file: mod.filePath, name: `${sym.name}(${param.name})` });
            }
          }
        }
      }
    }
  }
  if (untyped.length > 0) {
    const affectedFiles = [...new Set(untyped.map((u) => u.file))];
    insights.push({
      id: "missing-types",
      category: "code-quality",
      severity: untyped.length > 10 ? "warning" : "info",
      title: `${untyped.length} symbol${untyped.length > 1 ? "s" : ""} with missing or \`any\` types`,
      description: `Found ${untyped.length} exported function${untyped.length > 1 ? "s" : ""} with \`any\` types or missing return types. Examples: ${untyped.slice(0, 3).map((u) => `\`${u.name}\``).join(", ")}.`,
      affectedFiles: affectedFiles.slice(0, 10),
      suggestion: "Add explicit type annotations to improve type safety and documentation quality."
    });
  }
  return insights;
}
function detectInconsistentNaming(manifest) {
  const insights = [];
  const exportedNames = [];
  for (const mod of manifest.modules) {
    for (const sym of mod.symbols) {
      if (sym.exported) {
        exportedNames.push(sym.name);
      }
    }
  }
  if (exportedNames.length < 5) return insights;
  let camelCount = 0;
  let pascalCount = 0;
  let snakeCount = 0;
  for (const name of exportedNames) {
    if (/^[a-z][a-zA-Z0-9]*$/.test(name)) camelCount++;
    else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) pascalCount++;
    else if (/^[a-z][a-z0-9_]*$/.test(name)) snakeCount++;
  }
  const total = camelCount + pascalCount + snakeCount;
  if (total === 0) return insights;
  const conventions = [
    { name: "camelCase", count: camelCount },
    { name: "PascalCase", count: pascalCount },
    { name: "snake_case", count: snakeCount }
  ].filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
  if (conventions.length > 1) {
    const minority = conventions.slice(1).filter((c) => c.count > 2);
    if (minority.length > 0 && conventions[0].count > 0) {
      const dominantRatio = conventions[0].count / total;
      if (dominantRatio > 0.6 && dominantRatio < 0.95) {
        insights.push({
          id: "inconsistent-naming",
          category: "code-quality",
          severity: "info",
          title: `Mixed naming conventions across exports`,
          description: `Exports use multiple naming conventions: ${conventions.map((c) => `${c.name} (${c.count})`).join(", ")}. The dominant convention is ${conventions[0].name}.`,
          affectedFiles: [],
          suggestion: `Consider standardizing on ${conventions[0].name} for consistency across the codebase.`
        });
      }
    }
  }
  return insights;
}
function detectDeepNesting(manifest, maxDepth = 5) {
  const insights = [];
  const deepFiles = manifest.modules.filter((mod) => mod.filePath.split("/").length > maxDepth).map((mod) => mod.filePath);
  if (deepFiles.length > 0) {
    insights.push({
      id: "deep-nesting",
      category: "architecture",
      severity: deepFiles.length > 10 ? "warning" : "info",
      title: `${deepFiles.length} deeply nested file${deepFiles.length > 1 ? "s" : ""}`,
      description: `Found ${deepFiles.length} file${deepFiles.length > 1 ? "s" : ""} nested more than ${maxDepth} directories deep. Deepest: \`${deepFiles[0]}\` (${deepFiles[0].split("/").length} levels).`,
      affectedFiles: deepFiles.slice(0, 10),
      suggestion: "Consider flattening the directory structure to reduce import path complexity."
    });
  }
  return insights;
}
var init_insights = __esm({
  "src/analysis/insights.ts"() {
    "use strict";
  }
});

// src/analysis/ai-insights.ts
var ai_insights_exports = {};
__export(ai_insights_exports, {
  enhanceInsightsWithAI: () => enhanceInsightsWithAI
});
async function enhanceInsightsWithAI(options) {
  const { insights, aiProvider, readFile: readFile7, maxInsights = 20, onProgress } = options;
  const sorted = [...insights].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2)
  );
  const toEnhance = sorted.slice(0, maxInsights);
  const skipped = sorted.slice(maxInsights);
  for (let i = 0; i < toEnhance.length; i++) {
    const insight = toEnhance[i];
    onProgress?.(i + 1, toEnhance.length, `AI analyzing: ${insight.title}`);
    try {
      let fileContext = "";
      if (insight.affectedFiles.length > 0) {
        try {
          const content = await readFile7(insight.affectedFiles[0]);
          const lines = content.split("\n");
          fileContext = lines.slice(0, 100).join("\n");
        } catch {
        }
      }
      const prompt = buildInsightPrompt(insight, fileContext);
      const suggestion = await aiProvider.generate(prompt, {
        maxTokens: 300,
        temperature: 0.3
      });
      if (suggestion) {
        insight.aiSuggestion = suggestion.trim();
      }
    } catch {
    }
  }
  return [...toEnhance, ...skipped];
}
function buildInsightPrompt(insight, fileContext) {
  return `You are a senior software engineer reviewing code quality insights. Provide a specific, actionable fix for this issue. Be concise (2-4 sentences). Include a brief code example if helpful.

Category: ${insight.category}
Severity: ${insight.severity}
Issue: ${insight.title}
Description: ${insight.description}
Affected files: ${insight.affectedFiles.join(", ")}
Static suggestion: ${insight.suggestion}
${fileContext ? `
File context (first 100 lines of ${insight.affectedFiles[0]}):
\`\`\`
${fileContext}
\`\`\`` : ""}

Provide your specific fix recommendation:`;
}
var SEVERITY_ORDER;
var init_ai_insights = __esm({
  "src/analysis/ai-insights.ts"() {
    "use strict";
    SEVERITY_ORDER = {
      critical: 0,
      warning: 1,
      info: 2
    };
  }
});

// src/analysis/engine.ts
async function analyzeCodebase(options) {
  const startTime = Date.now();
  const {
    source,
    analysis,
    repoRoot,
    commitSha,
    targetFiles,
    previousManifest,
    onProgress,
    previousSummaryCache,
    onAIProgress,
    hooks
  } = options;
  await executeHooks("pre_analyze", hooks, { cwd: repoRoot });
  const files = targetFiles ?? await discoverFiles(repoRoot, source);
  let workspaceInfo;
  if (analysis.monorepo !== false) {
    try {
      workspaceInfo = await detectWorkspaces(repoRoot);
      if (workspaceInfo.type !== "none") {
        log("info", `Detected ${workspaceInfo.type} workspace with ${workspaceInfo.packages.size} packages`);
      }
    } catch {
    }
  }
  if (files.length === 0) {
    log("warn", "No source files found matching include patterns. Check your docwalk.config.yml include/exclude settings.");
    log("info", `Supported extensions: ${getSupportedExtensions().join(", ")}`);
    try {
      const allFiles = await (0, import_fast_glob3.default)("**/*", {
        cwd: repoRoot,
        ignore: [".git/**", "node_modules/**"],
        dot: false,
        onlyFiles: true,
        deep: 3
      });
      const extCounts = {};
      for (const f of allFiles) {
        const ext = import_path4.default.extname(f) || "(no extension)";
        extCounts[ext] = (extCounts[ext] || 0) + 1;
      }
      const topExts = Object.entries(extCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([ext, count]) => `${ext} (${count})`).join(", ");
      log("info", `Detected files in repo: ${topExts}`);
    } catch {
    }
  }
  const modules = [];
  let skippedFiles = 0;
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const absolutePath = import_path4.default.resolve(repoRoot, filePath);
    onProgress?.(i + 1, files.length, filePath);
    try {
      const fileStat = await (0, import_promises3.stat)(absolutePath);
      if (fileStat.size > analysis.max_file_size) {
        log("debug", `Skipped ${filePath}: exceeds ${analysis.max_file_size} byte limit (${fileStat.size} bytes)`);
        skippedFiles++;
        continue;
      }
      const content = await (0, import_promises3.readFile)(absolutePath, "utf-8");
      const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
      const language = detectLanguage(filePath);
      if (!language) {
        log("debug", `Skipped ${filePath}: unrecognized language for extension ${ext}`);
        skippedFiles++;
        continue;
      }
      const parser = getParser(language);
      if (!parser) {
        log("debug", `Skipped ${filePath}: no parser for ${language}`);
        skippedFiles++;
        continue;
      }
      const parseResult = await parser.parse(content, filePath);
      const moduleInfo = {
        filePath,
        language,
        symbols: parseResult.symbols,
        imports: parseResult.imports,
        exports: parseResult.exports,
        moduleDoc: parseResult.moduleDoc,
        fileSize: fileStat.size,
        lineCount: content.split("\n").length,
        contentHash: computeFileHash(content),
        analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      modules.push(moduleInfo);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      log("debug", `Skipped ${filePath}: parse error \u2014 ${errMsg}`);
      skippedFiles++;
    }
  }
  if (modules.length === 0 && files.length > 0) {
    log("warn", `Found ${files.length} files but all were skipped during parsing. Run with -v to see skip reasons.`);
  }
  log("info", `Analyzed ${modules.length} files, skipped ${skippedFiles} (run with -v for details)`);
  const allModules = mergeModules(modules, previousManifest, targetFiles);
  const dependencyGraph = buildDependencyGraph(allModules, workspaceInfo);
  let finalModules = allModules;
  let summaryCache = previousSummaryCache || [];
  if (analysis.ai_summaries && analysis.ai_provider) {
    const { summarizeModules: summarizeModules2 } = await Promise.resolve().then(() => (init_ai_summarizer(), ai_summarizer_exports));
    const result = await summarizeModules2({
      providerConfig: analysis.ai_provider,
      modules: allModules,
      readFile: async (filePath) => {
        const absolutePath = import_path4.default.resolve(repoRoot, filePath);
        return (0, import_promises3.readFile)(absolutePath, "utf-8");
      },
      previousCache: previousSummaryCache,
      onProgress: onAIProgress
    });
    finalModules = result.modules;
    summaryCache = result.cache;
  }
  log("info", "Building dependency graph and computing stats...");
  const projectMeta = computeProjectMeta(finalModules, repoRoot, source);
  const stats = computeStats(finalModules, skippedFiles, startTime);
  log("info", "Running static code analysis...");
  let insights;
  try {
    const { runStaticInsights: runStaticInsights2 } = await Promise.resolve().then(() => (init_insights(), insights_exports));
    const tempManifest = {
      modules: finalModules,
      dependencyGraph,
      projectMeta
    };
    insights = runStaticInsights2(tempManifest);
    if (insights?.length) {
      log("info", `Found ${insights.length} code insights`);
    }
  } catch {
  }
  if (insights?.length && analysis.insights_ai && analysis.ai_provider) {
    try {
      const { createProvider: createProvider2 } = await Promise.resolve().then(() => (init_providers(), providers_exports));
      const { enhanceInsightsWithAI: enhanceInsightsWithAI2 } = await Promise.resolve().then(() => (init_ai_insights(), ai_insights_exports));
      const provider = createProvider2(analysis.ai_provider);
      if (provider) {
        insights = await enhanceInsightsWithAI2({
          insights,
          aiProvider: provider,
          readFile: async (filePath) => {
            const absolutePath = import_path4.default.resolve(repoRoot, filePath);
            return (0, import_promises3.readFile)(absolutePath, "utf-8");
          },
          onProgress: onAIProgress ? (current, total, message) => onAIProgress(current, total, message) : void 0
        });
      }
    } catch {
    }
  }
  const manifest = {
    docwalkVersion: "0.1.0",
    repo: source.repo,
    branch: source.branch,
    commitSha,
    analyzedAt: (/* @__PURE__ */ new Date()).toISOString(),
    modules: finalModules,
    dependencyGraph,
    projectMeta,
    stats,
    summaryCache,
    insights
  };
  await executeHooks("post_analyze", hooks, { cwd: repoRoot });
  return manifest;
}
function mergeModules(newModules, previousManifest, targetFiles) {
  if (!previousManifest || !targetFiles) {
    return newModules;
  }
  const newFilePaths = new Set(newModules.map((m) => m.filePath));
  const targetSet = new Set(targetFiles);
  const preserved = previousManifest.modules.filter(
    (m) => !targetSet.has(m.filePath)
  );
  return [...preserved, ...newModules];
}
function buildDependencyGraph(modules, workspaceInfo) {
  const nodes = modules.map((m) => m.filePath);
  const edges = [];
  const exportMap = /* @__PURE__ */ new Map();
  for (const mod of modules) {
    for (const exp of mod.exports) {
      exportMap.set(`${mod.filePath}:${exp.name}`, mod.filePath);
    }
  }
  for (const mod of modules) {
    for (const imp of mod.imports) {
      const resolvedTarget = resolveImportSource(
        imp.source,
        mod.filePath,
        nodes,
        workspaceInfo
      );
      if (resolvedTarget) {
        edges.push({
          from: mod.filePath,
          to: resolvedTarget,
          imports: imp.specifiers.map((s) => s.name),
          isTypeOnly: imp.isTypeOnly
        });
      }
    }
  }
  return { nodes, edges };
}
function resolveImportSource(source, fromFile, knownFiles, workspaceInfo) {
  if (source.startsWith(".") || source.startsWith("@/")) {
    const dir = import_path4.default.dirname(fromFile);
    let resolved = source.startsWith("@/") ? source.replace("@/", "src/") : import_path4.default.join(dir, source);
    const strippedExt = resolved.replace(/\.(m|c)?js$/, "");
    const candidates = [
      resolved,
      strippedExt,
      `${resolved}.ts`,
      `${resolved}.tsx`,
      `${resolved}.js`,
      `${resolved}.jsx`,
      `${strippedExt}.ts`,
      `${strippedExt}.tsx`,
      `${strippedExt}.js`,
      `${strippedExt}.jsx`,
      `${resolved}/index.ts`,
      `${resolved}/index.tsx`,
      `${resolved}/index.js`,
      `${resolved}/index.jsx`,
      `${strippedExt}/index.ts`,
      `${strippedExt}/index.tsx`,
      `${strippedExt}/index.js`,
      `${strippedExt}/index.jsx`
    ].map((c) => import_path4.default.normalize(c));
    return knownFiles.find((f) => candidates.includes(import_path4.default.normalize(f)));
  }
  if (workspaceInfo && workspaceInfo.packages.size > 0) {
    for (const [pkgName, pkgDir] of workspaceInfo.packages) {
      if (source === pkgName || source.startsWith(`${pkgName}/`)) {
        const subpath = source === pkgName ? "" : source.slice(pkgName.length + 1);
        const basePath = subpath ? `${pkgDir}/src/${subpath}` : pkgDir;
        const candidates = subpath ? [
          `${basePath}.ts`,
          `${basePath}.tsx`,
          `${basePath}.js`,
          `${basePath}.jsx`,
          `${basePath}/index.ts`,
          `${basePath}/index.tsx`,
          `${basePath}/index.js`,
          `${basePath}/index.jsx`
        ] : [
          `${pkgDir}/src/index.ts`,
          `${pkgDir}/src/index.tsx`,
          `${pkgDir}/src/index.js`,
          `${pkgDir}/src/index.jsx`,
          `${pkgDir}/index.ts`,
          `${pkgDir}/index.tsx`,
          `${pkgDir}/index.js`,
          `${pkgDir}/index.jsx`,
          `${pkgDir}/lib/index.ts`,
          `${pkgDir}/lib/index.js`
        ];
        const match = knownFiles.find(
          (f) => candidates.some((c) => import_path4.default.normalize(f) === import_path4.default.normalize(c))
        );
        if (match) return match;
      }
    }
  }
  return void 0;
}
function computeProjectMeta(modules, repoRoot, source) {
  const langCounts = {};
  for (const mod of modules) {
    langCounts[mod.language] = (langCounts[mod.language] || 0) + 1;
  }
  const totalFiles = modules.length;
  const languages = Object.entries(langCounts).map(([name2, fileCount]) => ({
    name: name2,
    fileCount,
    percentage: Math.round(fileCount / totalFiles * 100)
  })).sort((a, b) => b.fileCount - a.fileCount);
  const entryPoints = modules.filter(
    (m) => m.filePath.includes("index.") || m.filePath.includes("main.") || m.filePath.includes("app.")
  ).map((m) => m.filePath);
  const rawName = source.repo.split("/").pop() || source.repo;
  const name = rawName === "." ? import_path4.default.basename(repoRoot) : rawName;
  let readmeDescription;
  const readmeMod = modules.find(
    (m) => import_path4.default.basename(m.filePath).toLowerCase() === "readme.md"
  );
  if (readmeMod?.moduleDoc?.summary) {
    readmeDescription = readmeMod.moduleDoc.summary;
  }
  return {
    name,
    readmeDescription,
    languages,
    entryPoints,
    repository: source.repo
  };
}
function computeStats(modules, skippedFiles, startTime) {
  const byLanguage = {};
  const byKind = {};
  let totalSymbols = 0;
  let totalLines = 0;
  for (const mod of modules) {
    if (!byLanguage[mod.language]) {
      byLanguage[mod.language] = { files: 0, symbols: 0, lines: 0 };
    }
    byLanguage[mod.language].files++;
    byLanguage[mod.language].symbols += mod.symbols.length;
    byLanguage[mod.language].lines += mod.lineCount;
    for (const sym of mod.symbols) {
      byKind[sym.kind] = (byKind[sym.kind] || 0) + 1;
      totalSymbols++;
    }
    totalLines += mod.lineCount;
  }
  return {
    totalFiles: modules.length,
    totalSymbols,
    totalLines,
    byLanguage,
    byKind,
    analysisTime: Date.now() - startTime,
    skippedFiles
  };
}
var import_promises3, import_path4, import_fast_glob3;
var init_engine = __esm({
  "src/analysis/engine.ts"() {
    "use strict";
    init_hooks();
    init_language_detect();
    init_parsers();
    init_file_discovery();
    init_hash();
    init_logger();
    import_promises3 = require("fs/promises");
    import_path4 = __toESM(require("path"), 1);
    import_fast_glob3 = __toESM(require("fast-glob"), 1);
    init_workspace_resolver();
  }
});

// src/generators/theme-presets.ts
function resolvePreset(presetId, options) {
  if (presetId === "custom") return void 0;
  const builtin = THEME_PRESETS[presetId];
  if (builtin) {
    if (options?.requireLicense && PREMIUM_PRESET_IDS.includes(presetId) && !options?.licenseKey) {
      return void 0;
    }
    return builtin;
  }
  return externalPresets[presetId];
}
var THEME_PRESETS, PREMIUM_PRESET_IDS, externalPresets;
var init_theme_presets = __esm({
  "src/generators/theme-presets.ts"() {
    "use strict";
    THEME_PRESETS = {
      corporate: {
        id: "corporate",
        name: "Corporate",
        palette: {
          scheme: "default",
          primary: "#1a237e",
          accent: "#0277bd"
        },
        cssVars: {
          "--md-primary-fg-color": "#1a237e",
          "--md-primary-fg-color--light": "#534bae",
          "--md-primary-fg-color--dark": "#000051",
          "--md-accent-fg-color": "#0277bd",
          "--md-accent-fg-color--transparent": "rgba(2, 119, 189, 0.1)"
        },
        features: [
          "navigation.tabs",
          "navigation.sections",
          "navigation.top",
          "search.suggest",
          "search.highlight",
          "content.code.copy",
          "content.tabs.link",
          "navigation.footer"
        ],
        fonts: {
          text: "Roboto",
          code: "Roboto Mono"
        },
        customCss: `/* Corporate Preset \u2014 Clean, professional, B2B */
:root {
  --md-primary-fg-color: #1a237e;
  --md-primary-fg-color--light: #534bae;
  --md-primary-fg-color--dark: #000051;
  --md-accent-fg-color: #0277bd;
  --md-accent-fg-color--transparent: rgba(2, 119, 189, 0.1);
}

.md-header {
  background: linear-gradient(135deg, #1a237e, #0d47a1);
}

.md-tabs {
  background-color: #0d47a1;
}

.md-typeset h1,
.md-typeset h2 {
  font-weight: 600;
  letter-spacing: -0.02em;
}

.md-typeset code {
  border-radius: 4px;
}

.md-typeset .admonition,
.md-typeset details {
  border-radius: 6px;
}

.md-content {
  max-width: 52rem;
}

.md-typeset table:not([class]) th {
  background-color: #e8eaf6;
  color: #1a237e;
}

[data-md-color-scheme="slate"] .md-typeset table:not([class]) th {
  background-color: #283593;
  color: #e8eaf6;
}
`
      },
      startup: {
        id: "startup",
        name: "Startup",
        palette: {
          scheme: "default",
          primary: "#7c3aed",
          accent: "#f59e0b",
          toggleScheme: "slate"
        },
        cssVars: {
          "--md-primary-fg-color": "#7c3aed",
          "--md-primary-fg-color--light": "#a78bfa",
          "--md-primary-fg-color--dark": "#5b21b6",
          "--md-accent-fg-color": "#f59e0b",
          "--md-accent-fg-color--transparent": "rgba(245, 158, 11, 0.1)"
        },
        features: [
          "navigation.tabs",
          "navigation.sections",
          "navigation.expand",
          "navigation.top",
          "search.suggest",
          "search.highlight",
          "content.code.copy",
          "content.code.annotate",
          "content.tabs.link",
          "navigation.instant",
          "navigation.footer"
        ],
        fonts: {
          text: "Inter",
          code: "Fira Code"
        },
        customCss: `/* Startup Preset \u2014 Vibrant, modern, energetic */
:root {
  --md-primary-fg-color: #7c3aed;
  --md-primary-fg-color--light: #a78bfa;
  --md-primary-fg-color--dark: #5b21b6;
  --md-accent-fg-color: #f59e0b;
  --md-accent-fg-color--transparent: rgba(245, 158, 11, 0.1);
}

.md-header {
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
}

.md-tabs {
  background-color: #6d28d9;
}

.md-typeset h1 {
  font-weight: 700;
  letter-spacing: -0.03em;
}

.md-typeset a {
  color: #7c3aed;
}

.md-typeset a:hover {
  color: #f59e0b;
}

.md-typeset code {
  border-radius: 6px;
  font-variant-ligatures: common-ligatures;
}

.md-typeset .admonition,
.md-typeset details {
  border-radius: 8px;
  border-left-width: 4px;
}

.md-typeset .admonition.note,
.md-typeset details.note {
  border-color: #7c3aed;
}

.md-content {
  max-width: 54rem;
}

[data-md-color-scheme="slate"] {
  --md-primary-fg-color: #a78bfa;
  --md-accent-fg-color: #fbbf24;
}
`
      },
      developer: {
        id: "developer",
        name: "Developer",
        palette: {
          scheme: "slate",
          primary: "#5de4c7",
          accent: "#add7ff",
          toggleScheme: "default"
        },
        cssVars: {
          "--md-primary-fg-color": "#5de4c7",
          "--md-primary-fg-color--light": "#89f0d6",
          "--md-primary-fg-color--dark": "#32d4a9",
          "--md-accent-fg-color": "#add7ff",
          "--md-accent-fg-color--transparent": "rgba(173, 215, 255, 0.1)"
        },
        features: [
          "navigation.tabs",
          "navigation.sections",
          "navigation.expand",
          "navigation.top",
          "search.suggest",
          "search.highlight",
          "content.code.copy",
          "content.code.annotate",
          "content.tabs.link",
          "navigation.instant",
          "navigation.instant.prefetch",
          "navigation.instant.progress",
          "navigation.path",
          "navigation.tracking",
          "navigation.prune",
          "navigation.footer",
          "header.autohide",
          "content.code.select",
          "content.tooltips",
          "content.footnote.tooltips",
          "announce.dismiss"
        ],
        fonts: {
          text: "Inter",
          code: "Fira Code"
        },
        customCss: `/* Developer Preset \u2014 Premium technical documentation */

/* \u2500\u2500 Design Tokens \u2500\u2500 */
:root {
  --md-primary-fg-color: #5de4c7;
  --md-primary-fg-color--light: #89f0d6;
  --md-primary-fg-color--dark: #32d4a9;
  --md-accent-fg-color: #add7ff;
  --md-accent-fg-color--transparent: rgba(173, 215, 255, 0.1);
  --dw-glow-sm: 0 0 8px rgba(93, 228, 199, 0.15);
  --dw-glow-md: 0 0 20px rgba(93, 228, 199, 0.12);
  --dw-glow-lg: 0 4px 30px rgba(93, 228, 199, 0.10);
  --dw-card-bg: rgba(255, 255, 255, 0.03);
  --dw-card-border: rgba(255, 255, 255, 0.06);
  --dw-card-hover-border: rgba(93, 228, 199, 0.3);
  --dw-card-hover-bg: rgba(255, 255, 255, 0.05);
  --dw-gradient-accent: linear-gradient(135deg, #5de4c7, #add7ff);
  --dw-transition-fast: 0.15s ease;
  --dw-transition-base: 0.25s ease;
  --dw-transition-slow: 0.4s ease;
  --dw-radius-sm: 4px;
  --dw-radius-md: 8px;
  --dw-radius-lg: 12px;
  --dw-shadow-card: 0 2px 8px rgba(0, 0, 0, 0.12);
  --dw-shadow-card-hover: 0 8px 24px rgba(0, 0, 0, 0.18);
}

[data-md-color-scheme="slate"] {
  --md-default-bg-color: #171921;
  --md-default-bg-color--light: #1e2028;
  --md-default-fg-color: #d6d6da;
  --md-default-fg-color--light: #a0a0a8;
  --md-code-bg-color: #12141c;
  --md-code-fg-color: #d6d6da;
  --md-typeset-a-color: #89d4f5;
}

/* \u2500\u2500 Header & Navigation \u2500\u2500 */
.md-header {
  background-color: #12141c;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.2);
}

.md-tabs {
  background-color: #12141c;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

/* \u2500\u2500 Typography \u2500\u2500 */
.md-typeset {
  font-size: 0.82rem;
  line-height: 1.75;
}

/* \u2500\u2500 Hero heading: gradient text on first h1 \u2500\u2500 */
.md-typeset h1 {
  font-weight: 800;
  font-size: 2.2em;
  letter-spacing: -0.03em;
  margin-bottom: 0.8em;
}

[data-md-color-scheme="slate"] .md-content > .md-typeset > h1:first-child,
[data-md-color-scheme="slate"] .md-typeset > h1:first-of-type {
  background: var(--dw-gradient-accent);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.md-typeset h2 {
  font-weight: 600;
  font-size: 1.5em;
  letter-spacing: -0.01em;
  margin-top: 2.5em;
  padding-bottom: 0.4em;
}

[data-md-color-scheme="slate"] .md-typeset h2 {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.md-typeset h3 {
  font-weight: 600;
  font-size: 1.2em;
  margin-top: 1.8em;
}

[data-md-color-scheme="slate"] .md-typeset h1 {
  color: #e8e8ec;
}

[data-md-color-scheme="slate"] .md-typeset h2 {
  color: #d0d0d6;
}

[data-md-color-scheme="slate"] .md-typeset h3,
[data-md-color-scheme="slate"] .md-typeset h4 {
  color: #b8b8c0;
}

/* \u2500\u2500 Custom Scrollbar \u2500\u2500 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
[data-md-color-scheme="default"] ::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
}
[data-md-color-scheme="default"] ::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}

/* \u2500\u2500 Card Grids (Glassmorphism) \u2500\u2500 */
.md-typeset .grid.cards > ol > li,
.md-typeset .grid.cards > ul > li,
.md-typeset .grid > .card {
  background: var(--dw-card-bg);
  border: 1px solid var(--dw-card-border);
  border-radius: var(--dw-radius-lg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: var(--dw-shadow-card);
  transition: transform var(--dw-transition-base),
              box-shadow var(--dw-transition-base),
              border-color var(--dw-transition-base),
              background var(--dw-transition-base);
  padding: 1rem 1.2rem;
}
.md-typeset .grid.cards > ol > li:hover,
.md-typeset .grid.cards > ul > li:hover,
.md-typeset .grid > .card:hover {
  transform: translateY(-3px);
  box-shadow: var(--dw-shadow-card-hover), var(--dw-glow-md);
  border-color: var(--dw-card-hover-border);
  background: var(--dw-card-hover-bg);
}
[data-md-color-scheme="default"] .md-typeset .grid.cards > ol > li,
[data-md-color-scheme="default"] .md-typeset .grid.cards > ul > li,
[data-md-color-scheme="default"] .md-typeset .grid > .card {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
[data-md-color-scheme="default"] .md-typeset .grid.cards > ol > li:hover,
[data-md-color-scheme="default"] .md-typeset .grid.cards > ul > li:hover,
[data-md-color-scheme="default"] .md-typeset .grid > .card:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(15, 118, 110, 0.3);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

/* \u2500\u2500 Code \u2500\u2500 */
.md-typeset code {
  border-radius: var(--dw-radius-sm);
  font-size: 0.84em;
  padding: 0.1em 0.4em;
}

[data-md-color-scheme="slate"] .md-typeset code {
  background-color: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.md-typeset pre > code {
  font-size: 0.82em;
  line-height: 1.65;
  border: none;
}

[data-md-color-scheme="slate"] .md-typeset pre {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--dw-radius-md);
  transition: border-color var(--dw-transition-base), box-shadow var(--dw-transition-base);
}
[data-md-color-scheme="slate"] .md-typeset pre:hover {
  border-color: rgba(93, 228, 199, 0.2);
  box-shadow: var(--dw-glow-sm);
}

/* Code copy button hover */
.md-typeset .md-clipboard:hover {
  color: var(--md-accent-fg-color);
}

/* \u2500\u2500 Admonitions \u2014 Per-type Tints \u2500\u2500 */
.md-typeset .admonition,
.md-typeset details {
  border-radius: var(--dw-radius-md);
  border-left-width: 3px;
  font-size: 0.82rem;
  transition: box-shadow var(--dw-transition-base);
}

.md-typeset .admonition .admonition-title,
.md-typeset details summary {
  font-weight: 600;
}

/* Tip \u2014 green */
[data-md-color-scheme="slate"] .md-typeset .admonition.tip,
[data-md-color-scheme="slate"] .md-typeset details.tip {
  background-color: rgba(34, 197, 94, 0.06);
}
/* Warning \u2014 amber */
[data-md-color-scheme="slate"] .md-typeset .admonition.warning,
[data-md-color-scheme="slate"] .md-typeset details.warning {
  background-color: rgba(245, 158, 11, 0.06);
}
/* Danger \u2014 red */
[data-md-color-scheme="slate"] .md-typeset .admonition.danger,
[data-md-color-scheme="slate"] .md-typeset details.danger {
  border-color: #ef4444;
  background-color: rgba(239, 68, 68, 0.06);
}
.md-typeset .admonition.danger .admonition-title,
.md-typeset details.danger summary {
  background-color: rgba(239, 68, 68, 0.1);
}
/* Question \u2014 purple */
[data-md-color-scheme="slate"] .md-typeset .admonition.question,
[data-md-color-scheme="slate"] .md-typeset details.question {
  background-color: rgba(168, 85, 247, 0.06);
}
/* Example \u2014 indigo */
[data-md-color-scheme="slate"] .md-typeset .admonition.example,
[data-md-color-scheme="slate"] .md-typeset details.example {
  background-color: rgba(99, 102, 241, 0.06);
}
/* Quote \u2014 gray */
[data-md-color-scheme="slate"] .md-typeset .admonition.quote,
[data-md-color-scheme="slate"] .md-typeset details.quote {
  background-color: rgba(156, 163, 175, 0.06);
}

/* Light mode admonition tints */
[data-md-color-scheme="default"] .md-typeset .admonition.tip,
[data-md-color-scheme="default"] .md-typeset details.tip {
  background-color: rgba(34, 197, 94, 0.05);
}
[data-md-color-scheme="default"] .md-typeset .admonition.warning,
[data-md-color-scheme="default"] .md-typeset details.warning {
  background-color: rgba(245, 158, 11, 0.05);
}
[data-md-color-scheme="default"] .md-typeset .admonition.danger,
[data-md-color-scheme="default"] .md-typeset details.danger {
  background-color: rgba(239, 68, 68, 0.05);
}
[data-md-color-scheme="default"] .md-typeset .admonition.question,
[data-md-color-scheme="default"] .md-typeset details.question {
  background-color: rgba(168, 85, 247, 0.05);
}
[data-md-color-scheme="default"] .md-typeset .admonition.example,
[data-md-color-scheme="default"] .md-typeset details.example {
  background-color: rgba(99, 102, 241, 0.05);
}
[data-md-color-scheme="default"] .md-typeset .admonition.quote,
[data-md-color-scheme="default"] .md-typeset details.quote {
  background-color: rgba(156, 163, 175, 0.05);
}

/* \u2500\u2500 Tables \u2500\u2500 */
.md-typeset table:not([class]) {
  font-size: 0.82rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--dw-radius-md);
  overflow: hidden;
}

[data-md-color-scheme="slate"] .md-typeset table:not([class]) th {
  background-color: rgba(255, 255, 255, 0.04);
  font-weight: 600;
  color: #d0d0d6;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

[data-md-color-scheme="slate"] .md-typeset table:not([class]) td {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

/* Table row hover */
.md-typeset table:not([class]) tbody tr {
  transition: background-color var(--dw-transition-fast);
}
[data-md-color-scheme="slate"] .md-typeset table:not([class]) tbody tr:hover {
  background-color: rgba(93, 228, 199, 0.04);
}
[data-md-color-scheme="default"] .md-typeset table:not([class]) tbody tr:hover {
  background-color: rgba(15, 118, 110, 0.04);
}

/* \u2500\u2500 Tab Styling \u2500\u2500 */
.md-typeset .tabbed-labels > label {
  border-radius: var(--dw-radius-sm) var(--dw-radius-sm) 0 0;
  transition: color var(--dw-transition-fast), background-color var(--dw-transition-fast);
}
.md-typeset .tabbed-labels > label:hover {
  color: var(--md-accent-fg-color);
}
.md-typeset .tabbed-labels > label.tabbed-labels__active,
.md-typeset .tabbed-labels > label--active {
  border-bottom: 2px solid var(--md-accent-fg-color);
}

/* \u2500\u2500 Sidebar \u2014 Active item & Hover \u2500\u2500 */
[data-md-color-scheme="slate"] .md-sidebar {
  border-right: 1px solid rgba(255, 255, 255, 0.04);
}

.md-nav__link {
  font-size: 0.72rem;
  transition: color var(--dw-transition-fast), background-color var(--dw-transition-fast);
  border-radius: var(--dw-radius-sm);
}
.md-nav__link:hover {
  background-color: rgba(255, 255, 255, 0.04);
}
[data-md-color-scheme="default"] .md-nav__link:hover {
  background-color: rgba(0, 0, 0, 0.03);
}
.md-nav__link--active,
.md-nav__item .md-nav__link--active {
  border-left: 2px solid var(--md-accent-fg-color);
  padding-left: 0.5rem;
  font-weight: 600;
}

/* Navigation section labels */
.md-nav__item--section > .md-nav__link {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.66rem;
  letter-spacing: 0.06em;
  opacity: 0.6;
}

/* \u2500\u2500 Breadcrumb Styling \u2500\u2500 */
.md-path {
  font-size: 0.72rem;
  color: var(--md-default-fg-color--light);
}
.md-path__separator {
  margin: 0 0.25rem;
}

/* \u2500\u2500 Content Width \u2500\u2500 */
.md-content {
  max-width: 54rem;
}

/* \u2500\u2500 Footer \u2500\u2500 */
.md-footer {
  margin-top: 3rem;
  position: relative;
}
.md-footer::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--dw-gradient-accent);
  opacity: 0.6;
}

[data-md-color-scheme="slate"] .md-footer {
  border-top: none;
}

.md-footer-meta {
  font-size: 0.72rem;
}

/* \u2500\u2500 Mermaid Diagrams \u2500\u2500 */
.md-typeset .mermaid,
.md-typeset .dw-mermaid-loading {
  cursor: zoom-in;
  transition: transform var(--dw-transition-base), box-shadow var(--dw-transition-base);
  border-radius: var(--dw-radius-md);
  padding: 1rem;
}
[data-md-color-scheme="slate"] .md-typeset .mermaid,
[data-md-color-scheme="slate"] .md-typeset .dw-mermaid-loading {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
}
.md-typeset .mermaid:hover {
  transform: scale(1.01);
  box-shadow: var(--dw-glow-sm);
}
[data-md-color-scheme="default"] .md-typeset .mermaid,
[data-md-color-scheme="default"] .md-typeset .dw-mermaid-loading {
  background: rgba(0, 0, 0, 0.01);
  border: 1px solid #e5e7eb;
}

/* \u2500\u2500 Micro-Animations \u2500\u2500 */
.md-typeset a {
  transition: color var(--dw-transition-fast);
}
.md-typeset a:hover {
  opacity: 0.9;
}

/* Content fade-in */
.md-content__inner {
  animation: dw-fadeIn 0.3s ease-out;
}
@keyframes dw-fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Link hover lift */
.md-typeset a:not(.md-nav__link):not(.md-header__button):not(.md-source):hover {
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

/* \u2500\u2500 Source Links \u2500\u2500 */
.md-typeset a[href*="github.com"][href*="/blob/"] {
  font-size: 0.78rem;
  opacity: 0.7;
  transition: opacity var(--dw-transition-fast);
}
.md-typeset a[href*="github.com"][href*="/blob/"]:hover {
  opacity: 1;
}

/* \u2500\u2500 Badge Styles \u2500\u2500 */
.md-typeset h3 code + .twemoji,
.md-typeset h3 code ~ em {
  font-size: 0.72rem;
  opacity: 0.6;
}

/* \u2500\u2500 Light Mode Overrides \u2500\u2500 */
[data-md-color-scheme="default"] {
  --md-primary-fg-color: #0f766e;
  --md-primary-fg-color--light: #14b8a6;
  --md-primary-fg-color--dark: #0d5d56;
  --md-accent-fg-color: #2563eb;
  --dw-card-bg: rgba(255, 255, 255, 0.7);
  --dw-card-border: #e5e7eb;
  --dw-card-hover-border: rgba(15, 118, 110, 0.3);
  --dw-card-hover-bg: rgba(255, 255, 255, 0.9);
  --dw-glow-sm: 0 0 8px rgba(15, 118, 110, 0.08);
  --dw-glow-md: 0 0 20px rgba(15, 118, 110, 0.06);
  --dw-shadow-card: 0 1px 4px rgba(0, 0, 0, 0.06);
  --dw-shadow-card-hover: 0 4px 16px rgba(0, 0, 0, 0.08);
  --dw-gradient-accent: linear-gradient(135deg, #0f766e, #2563eb);
}

[data-md-color-scheme="default"] .md-header {
  background-color: #0f766e;
  border-bottom: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

[data-md-color-scheme="default"] .md-tabs {
  background-color: #0d6d66;
  border-bottom: none;
}

[data-md-color-scheme="default"] .md-typeset h1:first-of-type {
  background: var(--dw-gradient-accent);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

[data-md-color-scheme="default"] .md-typeset h2 {
  border-bottom: 1px solid #e5e7eb;
}

[data-md-color-scheme="default"] .md-typeset table:not([class]) {
  border: 1px solid #e5e7eb;
}

[data-md-color-scheme="default"] .md-typeset table:not([class]) th {
  background-color: #f3f4f6;
  border-bottom: 1px solid #d1d5db;
}

[data-md-color-scheme="default"] .md-typeset table:not([class]) td {
  border-bottom: 1px solid #e5e7eb;
}

[data-md-color-scheme="default"] .md-typeset pre {
  border: 1px solid #e5e7eb;
  border-radius: var(--dw-radius-md);
  transition: border-color var(--dw-transition-base), box-shadow var(--dw-transition-base);
}
[data-md-color-scheme="default"] .md-typeset pre:hover {
  border-color: rgba(15, 118, 110, 0.2);
  box-shadow: var(--dw-glow-sm);
}

[data-md-color-scheme="default"] .md-nav__link--active,
[data-md-color-scheme="default"] .md-nav__item .md-nav__link--active {
  border-left-color: var(--md-primary-fg-color);
}

[data-md-color-scheme="default"] .md-footer::before {
  background: var(--dw-gradient-accent);
}
`,
        customJs: `/* DocWalk Developer Preset \u2014 Custom JS */

/* Mermaid rendering + click-to-zoom.
   Zensical empties .mermaid containers without rendering SVGs.
   We save the source text immediately (before Zensical clears it),
   load Mermaid from CDN if needed, and render ourselves. */
(function() {
  /* 1. Save sources immediately and prevent Zensical from touching them */
  var diagrams = [];
  document.querySelectorAll("pre.mermaid").forEach(function(pre) {
    var code = pre.querySelector("code");
    var src = (code || pre).textContent || "";
    if (src.trim()) {
      diagrams.push({ el: pre, src: src.trim() });
      pre.className = "dw-mermaid-loading";
    }
  });
  if (!diagrams.length) return;

  /* 2. Pan + zoom overlay */
  function openZoom(svg) {
    var isDark = document.body.getAttribute("data-md-color-scheme") === "slate";
    var bg = isDark ? "#171921" : "#f9fafb";
    var fg = isDark ? "#d6d6da" : "#1f2937";
    var accent = isDark ? "#5de4c7" : "#0f766e";

    var overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:" + bg + ";display:flex;flex-direction:column;";

    /* Toolbar */
    var toolbar = document.createElement("div");
    toolbar.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1.25rem;border-bottom:1px solid " + (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)") + ";flex-shrink:0;user-select:none;";
    var hint = document.createElement("span");
    hint.textContent = "Scroll to zoom \\u00b7 Drag to pan \\u00b7 Double-click to reset";
    hint.style.cssText = "font:12px Inter,sans-serif;color:" + fg + ";opacity:0.5;";
    var controls = document.createElement("span");
    controls.style.cssText = "display:flex;gap:0.5rem;align-items:center;";
    function makeBtn(label, title) {
      var b = document.createElement("button");
      b.textContent = label;
      b.title = title;
      b.style.cssText = "background:none;border:1px solid " + (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)") + ";color:" + fg + ";border-radius:6px;width:32px;height:32px;font:16px Inter,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;";
      return b;
    }
    var btnZoomIn = makeBtn("+", "Zoom in");
    var btnZoomOut = makeBtn("\\u2212", "Zoom out");
    var btnReset = makeBtn("\\u21ba", "Reset view");
    var btnClose = makeBtn("\\u2715", "Close");
    btnClose.style.borderColor = accent;
    btnClose.style.color = accent;
    controls.appendChild(btnZoomIn);
    controls.appendChild(btnZoomOut);
    controls.appendChild(btnReset);
    controls.appendChild(btnClose);
    toolbar.appendChild(hint);
    toolbar.appendChild(controls);
    overlay.appendChild(toolbar);

    /* Viewport */
    var viewport = document.createElement("div");
    viewport.style.cssText = "flex:1;overflow:hidden;position:relative;cursor:grab;";
    var wrapper = document.createElement("div");
    wrapper.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform-origin:0 0;";
    var clone = svg.cloneNode(true);
    clone.style.cssText = "max-width:90vw;max-height:85vh;width:auto;height:auto;";
    clone.removeAttribute("max-width");
    wrapper.appendChild(clone);
    viewport.appendChild(wrapper);
    overlay.appendChild(viewport);
    document.body.appendChild(overlay);

    /* Pan + zoom state */
    var scale = 1, tx = 0, ty = 0;
    var dragging = false, startX = 0, startY = 0, startTx = 0, startTy = 0;

    function applyTransform() {
      wrapper.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
    }

    function zoom(delta, cx, cy) {
      var prev = scale;
      scale = Math.min(10, Math.max(0.1, scale * delta));
      var rect = viewport.getBoundingClientRect();
      var ox = (cx || rect.width / 2) - rect.left;
      var oy = (cy || rect.height / 2) - rect.top;
      tx = ox - (ox - tx) * (scale / prev);
      ty = oy - (oy - ty) * (scale / prev);
      applyTransform();
    }

    function resetView() { scale = 1; tx = 0; ty = 0; applyTransform(); }

    viewport.addEventListener("wheel", function(e) {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1.15 : 0.87, e.clientX, e.clientY);
    }, { passive: false });

    viewport.addEventListener("mousedown", function(e) {
      if (e.button !== 0) return;
      dragging = true; startX = e.clientX; startY = e.clientY;
      startTx = tx; startTy = ty;
      viewport.style.cursor = "grabbing";
    });
    document.addEventListener("mousemove", function move(e) {
      if (!dragging) return;
      tx = startTx + (e.clientX - startX);
      ty = startTy + (e.clientY - startY);
      applyTransform();
    });
    document.addEventListener("mouseup", function up() {
      dragging = false;
      viewport.style.cursor = "grab";
    });

    viewport.addEventListener("dblclick", resetView);
    btnZoomIn.addEventListener("click", function() { zoom(1.3); });
    btnZoomOut.addEventListener("click", function() { zoom(0.77); });
    btnReset.addEventListener("click", resetView);

    function close() {
      overlay.remove();
    }
    btnClose.addEventListener("click", close);
    document.addEventListener("keydown", function esc(ev) {
      if (ev.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
    });
  }

  /* 3. Render one diagram at a time (mermaid.render is async in v10+) */
  function renderQueue(m, queue) {
    if (!queue.length) return;
    var d = queue.shift();
    var id = "dw-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4);
    try {
      var result = m.render(id, d.src);
      if (result && typeof result.then === "function") {
        result.then(function(r) {
          d.el.innerHTML = r.svg;
          d.el.className = "mermaid";
          renderQueue(m, queue);
        }).catch(function() {
          d.el.textContent = d.src;
          d.el.className = "mermaid";
          renderQueue(m, queue);
        });
      } else {
        d.el.innerHTML = typeof result === "string" ? result : "";
        d.el.className = "mermaid";
        renderQueue(m, queue);
      }
    } catch(e) {
      d.el.textContent = d.src;
      d.el.className = "mermaid";
      renderQueue(m, queue);
    }
  }

  function doRender(m) {
    var isDark = document.body.getAttribute("data-md-color-scheme") === "slate";
    m.initialize({ startOnLoad: false, theme: isDark ? "dark" : "default", fontFamily: "Inter, sans-serif" });
    renderQueue(m, diagrams.slice());
  }

  /* 4. Use global mermaid if available, otherwise load from CDN */
  function boot() {
    if (typeof mermaid !== "undefined" && mermaid.initialize) {
      doRender(mermaid);
      return;
    }
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    s.onload = function() {
      if (typeof mermaid !== "undefined") doRender(mermaid);
    };
    s.onerror = function() {
      diagrams.forEach(function(d) { d.el.textContent = d.src; d.el.className = "mermaid"; });
    };
    document.head.appendChild(s);
  }

  /* Small delay so Zensical's synchronous setup finishes first */
  setTimeout(boot, 0);

  /* 5. Capture-phase click-to-zoom */
  document.addEventListener("click", function(e) {
    if (!e.target.closest) return;
    var container = e.target.closest(".mermaid, .dw-mermaid-loading");
    if (!container) return;
    var svg = container.querySelector("svg");
    if (!svg) return;
    e.preventDefault();
    e.stopPropagation();
    openZoom(svg);
  }, true);
})();
`
      },
      minimal: {
        id: "minimal",
        name: "Minimal",
        palette: {
          scheme: "default",
          primary: "#374151",
          accent: "#6b7280"
        },
        cssVars: {
          "--md-primary-fg-color": "#374151",
          "--md-primary-fg-color--light": "#6b7280",
          "--md-primary-fg-color--dark": "#1f2937",
          "--md-accent-fg-color": "#6b7280",
          "--md-accent-fg-color--transparent": "rgba(107, 114, 128, 0.1)"
        },
        features: [
          "navigation.sections",
          "navigation.top",
          "search.suggest",
          "search.highlight",
          "content.code.copy",
          "content.tabs.link"
        ],
        fonts: {
          text: "Source Serif 4",
          code: "Source Code Pro"
        },
        customCss: `/* Minimal Preset \u2014 Reading-focused, distraction-free */
:root {
  --md-primary-fg-color: #374151;
  --md-primary-fg-color--light: #6b7280;
  --md-primary-fg-color--dark: #1f2937;
  --md-accent-fg-color: #6b7280;
  --md-accent-fg-color--transparent: rgba(107, 114, 128, 0.1);
}

.md-header {
  background-color: #f9fafb;
  color: #374151;
  box-shadow: 0 1px 0 #e5e7eb;
}

[data-md-color-scheme="default"] .md-header .md-header__title {
  color: #374151;
}

[data-md-color-scheme="default"] .md-header .md-logo {
  color: #374151;
}

[data-md-color-scheme="default"] .md-tabs {
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.md-typeset {
  font-size: 1.05rem;
  line-height: 1.75;
}

.md-typeset h1 {
  font-weight: 700;
  letter-spacing: -0.03em;
}

.md-typeset h2 {
  font-weight: 600;
  margin-top: 2.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.md-typeset code {
  border-radius: 3px;
  font-size: 0.85em;
}

.md-typeset .admonition,
.md-typeset details {
  border-radius: 4px;
  box-shadow: none;
}

.md-content {
  max-width: 46rem;
  margin: 0 auto;
}

.md-sidebar--secondary {
  display: none;
}
`
      }
    };
    PREMIUM_PRESET_IDS = ["api-reference", "knowledge-base"];
    externalPresets = {};
  }
});

// src/generators/utils.ts
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
  let yaml2 = "";
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      yaml2 += `${indent}  - "${item.title}":
`;
      yaml2 += renderNavYaml(item.children, depth + 1);
    } else if (item.path) {
      yaml2 += `${indent}  - "${item.title}": ${item.path}
`;
    }
  }
  return yaml2;
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
  return import_path5.default.basename(process.cwd());
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
var import_path5, LOGICAL_SECTIONS;
var init_utils = __esm({
  "src/generators/utils.ts"() {
    "use strict";
    import_path5 = __toESM(require("path"), 1);
    LOGICAL_SECTIONS = {
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
  }
});

// src/analysis/context-builder.ts
function detectSection(filePath) {
  const parts = filePath.toLowerCase().split("/");
  for (const [section, keywords] of Object.entries(LOGICAL_SECTIONS)) {
    for (const part of parts) {
      if (keywords.includes(part)) return section;
    }
  }
  return "";
}
async function buildContext(options) {
  const { targetModule, topic, tokenBudget, manifest, readFile: readFile7 } = options;
  const { dependencyGraph, modules } = manifest;
  const scored = [];
  if (targetModule) {
    const targetPath = targetModule.filePath;
    const targetDir = import_path6.default.dirname(targetPath);
    const targetSection = detectSection(targetPath);
    const directDeps = /* @__PURE__ */ new Set();
    const directDependents = /* @__PURE__ */ new Set();
    for (const edge of dependencyGraph.edges) {
      if (edge.from === targetPath) directDeps.add(edge.to);
      if (edge.to === targetPath) directDependents.add(edge.from);
    }
    const transitiveSet = /* @__PURE__ */ new Set();
    for (const dep of directDeps) {
      for (const edge of dependencyGraph.edges) {
        if (edge.from === dep && edge.to !== targetPath) {
          transitiveSet.add(edge.to);
        }
      }
    }
    for (const dep of directDependents) {
      for (const edge of dependencyGraph.edges) {
        if (edge.to === dep && edge.from !== targetPath) {
          transitiveSet.add(edge.from);
        }
      }
    }
    for (const mod of modules) {
      if (mod.filePath === targetPath) continue;
      let score = 0;
      if (directDeps.has(mod.filePath) || directDependents.has(mod.filePath)) {
        score = 1;
      } else if (transitiveSet.has(mod.filePath)) {
        score = 0.6;
      } else if (import_path6.default.dirname(mod.filePath) === targetDir) {
        score = 0.4;
      } else if (targetSection && detectSection(mod.filePath) === targetSection) {
        score = 0.3;
      } else if (mod.filePath.toLowerCase().includes("readme") || mod.filePath.toLowerCase().includes("doc")) {
        score = 0.2;
      }
      if (score > 0) {
        scored.push({ module: mod, score });
      }
    }
  } else if (topic) {
    const topicLower = topic.toLowerCase();
    const topicWords = topicLower.split(/\s+/);
    for (const mod of modules) {
      let score = 0;
      const pathLower = mod.filePath.toLowerCase();
      for (const word of topicWords) {
        if (pathLower.includes(word)) {
          score = Math.max(score, 0.8);
        }
      }
      for (const sym of mod.symbols) {
        const nameLower = sym.name.toLowerCase();
        for (const word of topicWords) {
          if (nameLower.includes(word)) {
            score = Math.max(score, 0.7);
          }
        }
      }
      if (pathLower.includes("readme")) {
        score = Math.max(score, 0.5);
      }
      if (score > 0) {
        scored.push({ module: mod, score });
      }
    }
  } else {
    const connectionCounts = /* @__PURE__ */ new Map();
    for (const edge of dependencyGraph.edges) {
      connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
      connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
    }
    for (const mod of modules) {
      const connections = connectionCounts.get(mod.filePath) ?? 0;
      const score = Math.min(connections / 10, 1);
      if (score > 0) {
        scored.push({ module: mod, score });
      }
    }
  }
  scored.sort((a, b) => b.score - a.score);
  const chunks = [];
  let usedTokens = 0;
  if (targetModule) {
    try {
      const content = await readFile7(targetModule.filePath);
      const tokens = estimateTokens(content);
      if (tokens <= tokenBudget * 0.4) {
        chunks.push({
          filePath: targetModule.filePath,
          startLine: 1,
          endLine: content.split("\n").length,
          content,
          relevanceScore: 1,
          kind: "full-file"
        });
        usedTokens += tokens;
      } else {
        const lines = content.split("\n");
        const maxLines = Math.floor(tokenBudget * 0.4 / (estimateTokens(content) / lines.length));
        const truncated = lines.slice(0, maxLines).join("\n");
        chunks.push({
          filePath: targetModule.filePath,
          startLine: 1,
          endLine: maxLines,
          content: truncated,
          relevanceScore: 1,
          kind: "full-file"
        });
        usedTokens += estimateTokens(truncated);
      }
    } catch {
    }
  }
  for (const { module: mod, score } of scored) {
    if (usedTokens >= tokenBudget) break;
    try {
      const content = await readFile7(mod.filePath);
      const tokens = estimateTokens(content);
      const remaining = tokenBudget - usedTokens;
      if (tokens <= remaining) {
        chunks.push({
          filePath: mod.filePath,
          startLine: 1,
          endLine: content.split("\n").length,
          content,
          relevanceScore: score,
          kind: "full-file"
        });
        usedTokens += tokens;
      } else if (remaining > 100) {
        const lines = content.split("\n");
        const maxLines = Math.floor(remaining / (tokens / lines.length));
        if (maxLines > 5) {
          const truncated = lines.slice(0, maxLines).join("\n");
          chunks.push({
            filePath: mod.filePath,
            startLine: 1,
            endLine: maxLines,
            content: truncated,
            relevanceScore: score,
            kind: "full-file"
          });
          usedTokens += estimateTokens(truncated);
        }
      }
    } catch {
    }
  }
  return chunks;
}
var import_path6;
var init_context_builder = __esm({
  "src/analysis/context-builder.ts"() {
    "use strict";
    import_path6 = __toESM(require("path"), 1);
    init_utils();
  }
});

// src/generators/diagrams.ts
function extractAllMermaidBlocks(text) {
  const blocks = [];
  const globalRegex = new RegExp(MERMAID_BLOCK_REGEX.source, "g");
  let match;
  while ((match = globalRegex.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}
var MERMAID_BLOCK_REGEX;
var init_diagrams = __esm({
  "src/generators/diagrams.ts"() {
    "use strict";
    init_context_builder();
    init_utils();
    MERMAID_BLOCK_REGEX = /```(?:mermaid)?\n?([\s\S]*?)```/;
  }
});

// src/generators/narrative-engine.ts
async function generateOverviewNarrative(options) {
  const { provider, manifest, readFile: readFile7, contextBudget = 8e3 } = options;
  const contextChunks = await buildContext({
    tokenBudget: contextBudget,
    manifest,
    readFile: readFile7
  });
  const contextText = formatContextChunks(contextChunks);
  const moduleList = manifest.modules.map((m) => `- ${m.filePath} (${m.language}, ${m.symbols.length} symbols)`).slice(0, 30).join("\n");
  const prompt = `You are writing the overview page for a technical documentation site. Based on the following codebase analysis, write a comprehensive but concise overview of this project.

PROJECT: ${manifest.projectMeta.name}
LANGUAGES: ${manifest.projectMeta.languages.map((l) => `${l.name} (${l.percentage}%)`).join(", ")}
TOTAL FILES: ${manifest.stats.totalFiles}
TOTAL SYMBOLS: ${manifest.stats.totalSymbols}

KEY MODULES:
${moduleList}

SOURCE CODE CONTEXT:
${contextText}

INSTRUCTIONS:
1. Write 3-5 paragraphs explaining what this project does, its architecture, and key design decisions
2. Use [file:line] notation for source citations (e.g., [src/engine.ts:42])
3. Mention the most important modules and how they interact
4. Write for developers who are new to the codebase
5. Be specific \u2014 reference actual function/class names from the code
6. Do NOT use marketing language. Be technical and precise.

Write the overview in Markdown format.`;
  const prose = await provider.generate(prompt, {
    maxTokens: 2048,
    temperature: 0.3,
    systemPrompt: "You are a technical documentation writer. Write clear, precise, developer-focused documentation."
  });
  const citations = extractCitations(prose);
  const suggestedDiagrams = extractDiagramSuggestions(prose);
  return { prose, citations, suggestedDiagrams };
}
async function generateGettingStartedNarrative(options) {
  const { provider, manifest, readFile: readFile7, contextBudget = 6e3 } = options;
  const entryModules = manifest.modules.filter(
    (m) => m.filePath.includes("index.") || m.filePath.includes("main.") || m.filePath.includes("app.")
  );
  const contextChunks = [];
  let usedTokens = 0;
  for (const mod of entryModules.slice(0, 5)) {
    try {
      const content = await readFile7(mod.filePath);
      const tokens = estimateTokens(content);
      if (usedTokens + tokens <= contextBudget) {
        contextChunks.push({
          filePath: mod.filePath,
          startLine: 1,
          endLine: content.split("\n").length,
          content,
          relevanceScore: 1,
          kind: "full-file"
        });
        usedTokens += tokens;
      }
    } catch {
    }
  }
  const contextText = formatContextChunks(contextChunks);
  const prompt = `You are writing a Getting Started guide for a technical documentation site.

PROJECT: ${manifest.projectMeta.name}
LANGUAGES: ${manifest.projectMeta.languages.map((l) => l.name).join(", ")}
PACKAGE MANAGER: ${manifest.projectMeta.packageManager || "unknown"}
ENTRY POINTS: ${manifest.projectMeta.entryPoints.join(", ")}

SOURCE CODE CONTEXT:
${contextText}

INSTRUCTIONS:
1. Write a practical getting-started guide that helps developers set up and start using this project
2. Include prerequisites, installation steps, and a first-use walkthrough
3. Reference specific files and commands from the codebase
4. Use [file:line] notation for source citations
5. Keep it actionable \u2014 every section should help the reader DO something
6. Write in Markdown format with proper headings

Write the getting-started guide.`;
  const prose = await provider.generate(prompt, {
    maxTokens: 2048,
    temperature: 0.3,
    systemPrompt: "You are a technical documentation writer. Write clear, practical, step-by-step guides."
  });
  const citations = extractCitations(prose);
  return { prose, citations, suggestedDiagrams: [] };
}
async function generateModuleNarrative(module2, options) {
  const { provider, manifest, readFile: readFile7, contextBudget = 6e3 } = options;
  const contextChunks = await buildContext({
    targetModule: module2,
    tokenBudget: contextBudget,
    manifest,
    readFile: readFile7
  });
  const contextText = formatContextChunks(contextChunks);
  const symbolList = module2.symbols.filter((s) => s.exported).map((s) => `- ${s.kind} ${s.name}${s.signature ? `: ${s.signature}` : ""}`).join("\n");
  const prompt = `You are writing documentation for a specific module in a codebase.

FILE: ${module2.filePath}
LANGUAGE: ${module2.language}
EXPORTED SYMBOLS:
${symbolList || "(none)"}

RELATED SOURCE CODE:
${contextText}

INSTRUCTIONS:
1. Write 2-4 paragraphs explaining what this module does and how it fits into the project
2. Describe the key exported symbols and their purposes
3. Explain how other modules use this one (based on the dependency context)
4. Use [file:line] notation for source citations
5. If there are complex algorithms or patterns, explain them clearly
6. Write for developers who need to understand or modify this code

Write the module description in Markdown format. Do NOT include headings \u2014 this will be inserted into an existing page structure.`;
  const prose = await provider.generate(prompt, {
    maxTokens: 1024,
    temperature: 0.3,
    systemPrompt: "You are a technical documentation writer. Be precise and reference specific code."
  });
  const citations = extractCitations(prose);
  const suggestedDiagrams = extractDiagramSuggestions(prose);
  return { prose, citations, suggestedDiagrams };
}
async function generateArchitectureNarrative(options) {
  const { provider, manifest, readFile: readFile7, contextBudget = 8e3 } = options;
  const contextChunks = await buildContext({
    topic: "architecture core engine",
    tokenBudget: contextBudget,
    manifest,
    readFile: readFile7
  });
  const contextText = formatContextChunks(contextChunks);
  const { dependencyGraph } = manifest;
  const connectionCounts = /* @__PURE__ */ new Map();
  for (const edge of dependencyGraph.edges) {
    connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
    connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
  }
  const topModules = [...connectionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([file, count]) => `- ${file} (${count} connections)`).join("\n");
  const prompt = `You are writing the architecture documentation for a software project.

PROJECT: ${manifest.projectMeta.name}
MODULES: ${dependencyGraph.nodes.length}
DEPENDENCY EDGES: ${dependencyGraph.edges.length}

MOST CONNECTED MODULES:
${topModules}

SOURCE CODE CONTEXT:
${contextText}

INSTRUCTIONS:
1. Write 4-6 paragraphs describing the system architecture
2. Explain the major components/layers and how they interact
3. Describe the data flow and key architectural patterns used
4. Mention design decisions and trade-offs where apparent from the code
5. Use [file:line] notation for source citations
6. Suggest what types of diagrams would be helpful (sequence, class, flowchart)

Write the architecture overview in Markdown format.`;
  const prose = await provider.generate(prompt, {
    maxTokens: 2048,
    temperature: 0.3,
    systemPrompt: "You are a software architect documenting a system. Be thorough and precise."
  });
  const citations = extractCitations(prose);
  const suggestedDiagrams = extractDiagramSuggestions(prose);
  return { prose, citations, suggestedDiagrams };
}
function formatContextChunks(chunks) {
  return chunks.map((c) => {
    const header2 = `--- ${c.filePath} (lines ${c.startLine}-${c.endLine}, relevance: ${c.relevanceScore.toFixed(1)}) ---`;
    return `${header2}
${c.content}`;
  }).join("\n\n");
}
function extractCitations(prose) {
  const citations = [];
  const regex = /\[([^\]]+?):(\d+)\]/g;
  let match;
  while ((match = regex.exec(prose)) !== null) {
    citations.push({
      text: match[0],
      filePath: match[1],
      line: parseInt(match[2], 10)
    });
  }
  return citations;
}
function extractDiagramSuggestions(prose) {
  const blocks = extractAllMermaidBlocks(prose);
  return blocks.map((code) => {
    let type = "flowchart";
    if (code.startsWith("sequenceDiagram")) type = "sequence";
    else if (code.startsWith("classDiagram")) type = "class";
    else if (code.startsWith("graph") || code.startsWith("flowchart")) type = "flowchart";
    return {
      type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Diagram`,
      mermaidCode: code
    };
  });
}
function renderCitations(prose, citations, repoUrl, branch) {
  let result = prose;
  const seen = /* @__PURE__ */ new Set();
  for (const citation of citations) {
    if (seen.has(citation.text)) continue;
    seen.add(citation.text);
    const linkTarget = repoUrl ? `https://github.com/${repoUrl}/blob/${branch || "main"}/${citation.filePath}#L${citation.line}` : `api/${citation.filePath.replace(/\.[^.]+$/, "")}.md`;
    result = result.replaceAll(
      citation.text,
      `[${citation.filePath}:${citation.line}](${linkTarget})`
    );
  }
  return result;
}
var init_narrative_engine = __esm({
  "src/generators/narrative-engine.ts"() {
    "use strict";
    init_context_builder();
    init_utils();
    init_diagrams();
  }
});

// src/generators/pages/overview.ts
function generateOverviewPage(manifest, config) {
  const { projectMeta: meta, stats } = manifest;
  const projectName = resolveProjectName(manifest);
  const archLink = config.analysis.architecture_tiers !== false ? "architecture/index.md" : "architecture.md";
  const modulesByGroup = groupModulesLogically(manifest.modules);
  const connectionCounts = /* @__PURE__ */ new Map();
  for (const edge of manifest.dependencyGraph.edges) {
    connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
    connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
  }
  const topModules = [...connectionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const langList = meta.languages.map((l) => `**${getLanguageDisplayName(l.name)}** (${l.fileCount} files, ${l.percentage}%)`).join(" \xB7 ");
  const primaryLang = meta.languages[0] ? getLanguageDisplayName(meta.languages[0].name) : "software";
  const projectDescription = meta.description || meta.readmeDescription || `A ${primaryLang} project. This reference covers the full API surface, architecture, and module structure.`;
  const langCount = meta.languages.length;
  const statsCards = `<div class="grid cards" markdown>

-   :material-file-document-outline:{ .lg .middle } **${stats.totalFiles} Files**

    ---

    Source files analyzed across the codebase

-   :material-code-tags:{ .lg .middle } **${stats.totalSymbols} Symbols**

    ---

    Functions, classes, types, and interfaces

-   :material-text-long:{ .lg .middle } **${stats.totalLines.toLocaleString()} Lines**

    ---

    Total lines of source code

-   :material-translate:{ .lg .middle } **${langCount} Language${langCount !== 1 ? "s" : ""}**

    ---

    ${langList}

</div>`;
  let gettingStartedCards = `<div class="grid cards" markdown>

-   :material-rocket-launch:{ .lg .middle } **[Getting Started](getting-started.md)**

    ---

    Prerequisites, installation, and project structure

-   :material-sitemap:{ .lg .middle } **[Architecture](${archLink})**

    ---

    System design, dependency graph, and module relationships

-   :material-book-open-variant:{ .lg .middle } **[API Reference](#api-by-section)**

    ---

    Complete reference organized by component
`;
  if (config.analysis.config_docs) {
    gettingStartedCards += `
-   :material-cog:{ .lg .middle } **[Configuration](configuration.md)**

    ---

    Configuration schemas and settings
`;
  }
  if (config.analysis.types_page) {
    gettingStartedCards += `
-   :material-shape-outline:{ .lg .middle } **[Types & Interfaces](types.md)**

    ---

    All exported types, interfaces, and enums
`;
  }
  if (config.analysis.dependencies_page) {
    gettingStartedCards += `
-   :material-package-variant:{ .lg .middle } **[Dependencies](dependencies.md)**

    ---

    External packages and their usage
`;
  }
  gettingStartedCards += `
</div>`;
  const sectionCards = Object.entries(modulesByGroup).sort(([, a], [, b]) => b.length - a.length).map(([section, modules]) => {
    const topModule = modules[0];
    const slug = topModule.filePath.replace(/\.[^.]+$/, "");
    const keyFiles = modules.map((m) => `\`${import_path7.default.basename(m.filePath)}\``).slice(0, 4).join(", ");
    const extra = modules.length > 4 ? ` +${modules.length - 4} more` : "";
    return `-   :material-folder-outline:{ .lg .middle } **[${section}](api/${slug}.md)**

    ---

    ${modules.length} module${modules.length !== 1 ? "s" : ""} \xB7 ${keyFiles}${extra}
`;
  }).join("\n");
  let coreModulesSection = "";
  if (topModules.length > 0) {
    const coreCards = topModules.map(([file, count]) => {
      const slug = file.replace(/\.[^.]+$/, "");
      const mod = manifest.modules.find((m) => m.filePath === file);
      const desc = mod?.moduleDoc?.summary || `${count} connections`;
      return `-   :material-star:{ .lg .middle } **[\`${import_path7.default.basename(file)}\`](api/${slug}.md)**

    ---

    ${desc}
`;
    }).join("\n");
    coreModulesSection = `## Core Modules

The most interconnected modules in the codebase:

<div class="grid cards" markdown>

${coreCards}
</div>
`;
  }
  const content = `---
title: ${projectName} Documentation
description: Technical documentation for ${projectName}
---

# ${projectName}

${projectDescription}

---

${statsCards}

---

## Getting Started

New to this project? Start here:

${gettingStartedCards}

---

${coreModulesSection}

---

## API by Section

<div class="grid cards" markdown>

${sectionCards}
</div>

---

## Entry Points

${meta.entryPoints.map((e) => {
    const slug = e.replace(/\.[^.]+$/, "");
    return `- [\`${e}\`](api/${slug}.md)`;
  }).join("\n")}

---

!!! info "About This Documentation"
    This documentation is auto-generated from source code analysis. It covers **${stats.totalFiles} source files** containing **${stats.totalSymbols} symbols** across **${stats.totalLines.toLocaleString()} lines** of code.
    Last generated from commit \`${manifest.commitSha.slice(0, 8)}\`.

---

*Generated by [DocWalk](https://docwalk.dev)*
`;
  return {
    path: "index.md",
    title: "Overview",
    content,
    navGroup: "",
    navOrder: 0,
    audience: "developer"
  };
}
async function generateOverviewPageNarrative(manifest, config, provider, readFile7) {
  const basePage = generateOverviewPage(manifest, config);
  try {
    const narrative = await generateOverviewNarrative({
      provider,
      manifest,
      readFile: readFile7
    });
    const repoUrl = config.source.repo.includes("/") ? config.source.repo : void 0;
    const prose = renderCitations(narrative.prose, narrative.citations, repoUrl, config.source.branch);
    const projectName = resolveProjectName(manifest);
    const narrativeContent = `---
title: ${projectName} Documentation
description: Technical documentation for ${projectName}
---

# ${projectName}

${prose}

---

${basePage.content.split("---\n").slice(2).join("---\n")}`;
    return {
      ...basePage,
      content: narrativeContent
    };
  } catch {
    return basePage;
  }
}
var import_path7;
var init_overview = __esm({
  "src/generators/pages/overview.ts"() {
    "use strict";
    import_path7 = __toESM(require("path"), 1);
    init_language_detect();
    init_utils();
    init_narrative_engine();
  }
});

// src/generators/pages/getting-started.ts
function generateGettingStartedPage(manifest, config) {
  const meta = manifest.projectMeta;
  const projectName = resolveProjectName(manifest);
  const archLink = config.analysis.architecture_tiers !== false ? "architecture/index.md" : "architecture.md";
  const pkgManager = detectPackageManager(manifest.modules);
  const installCmd = getInstallCommand(pkgManager);
  const altInstalls = getAlternativeInstallCommands(pkgManager);
  const modulesByGroup = groupModulesLogically(manifest.modules);
  const structureOverview = Object.entries(modulesByGroup).sort(([, a], [, b]) => b.length - a.length).map(([section, modules]) => {
    const files = modules.map((m) => `\`${import_path8.default.basename(m.filePath)}\``).slice(0, 5).join(", ");
    return `| **${section}** | ${modules.length} | ${files}${modules.length > 5 ? " ..." : ""} |`;
  }).join("\n");
  const repoUrl = meta.repository?.includes("/") ? `https://github.com/${meta.repository}` : "<repository-url>";
  const readmeIntro = meta.readmeDescription ? `${meta.readmeDescription}

---

` : "";
  const prerequisites = meta.languages.map(
    (l) => `- [x] ${getLanguageDisplayName(l.name)} development environment`
  ).join("\n");
  let installSection;
  if (altInstalls) {
    installSection = `\`\`\`bash
# Clone the repository
git clone ${repoUrl}
cd ${projectName}
\`\`\`

${altInstalls.map((alt) => `=== "${alt.label}"

    \`\`\`bash
    ${alt.command}
    \`\`\``).join("\n\n")}`;
  } else {
    installSection = `\`\`\`bash
# Clone the repository
git clone ${repoUrl}
cd ${projectName}

# Install dependencies
${installCmd}
\`\`\``;
  }
  const content = `---
title: Getting Started
description: Setup and installation guide for ${projectName}
---

# Getting Started

${readmeIntro}This guide covers the prerequisites, installation, and project structure for **${projectName}**.

---

## Prerequisites

${prerequisites}

---

## Installation

${installSection}

---

## Project Structure

\`\`\`text
${generateDirectoryTree(manifest.modules)}
\`\`\`

### Module Overview

| Section | Files | Key Modules |
|---------|:-----:|-------------|
${structureOverview}

---

## Entry Points

The primary entry points into the codebase:

${meta.entryPoints.map((e) => {
    const slug = e.replace(/\.[^.]+$/, "");
    const mod = manifest.modules.find((m) => m.filePath === e);
    const desc = mod?.moduleDoc?.summary || "";
    return `- **[\`${e}\`](api/${slug}.md)**${desc ? ` \u2014 ${desc}` : ""}`;
  }).join("\n")}

---

## Next Steps

<div class="grid cards" markdown>

-   :material-sitemap:{ .lg .middle } **[Architecture](${archLink})**

    ---

    Understand the system design and dependency graph

-   :material-book-open-variant:{ .lg .middle } **[API Reference](index.md#api-by-section)**

    ---

    Browse the full API organized by component

</div>

---

*Auto-generated by DocWalk. Re-run \`docwalk generate\` to update.*
`;
  return {
    path: "getting-started.md",
    title: "Getting Started",
    content,
    navGroup: "",
    navOrder: 1,
    audience: "developer"
  };
}
async function generateGettingStartedPageNarrative(manifest, config, provider, readFile7) {
  const basePage = generateGettingStartedPage(manifest, config);
  try {
    const narrative = await generateGettingStartedNarrative({
      provider,
      manifest,
      readFile: readFile7
    });
    const repoUrl = config.source.repo.includes("/") ? config.source.repo : void 0;
    const prose = renderCitations(narrative.prose, narrative.citations, repoUrl, config.source.branch);
    const projectName = resolveProjectName(manifest);
    const narrativeContent = `---
title: Getting Started
description: Setup and installation guide for ${projectName}
---

# Getting Started

${prose}

---

*Auto-generated by DocWalk with AI narrative. Re-run \`docwalk generate\` to update.*
`;
    return {
      ...basePage,
      content: narrativeContent
    };
  } catch {
    return basePage;
  }
}
var import_path8;
var init_getting_started = __esm({
  "src/generators/pages/getting-started.ts"() {
    "use strict";
    import_path8 = __toESM(require("path"), 1);
    init_language_detect();
    init_utils();
    init_narrative_engine();
  }
});

// src/generators/pages/architecture.ts
function generateArchitecturePage(manifest) {
  const { dependencyGraph } = manifest;
  const clusters = /* @__PURE__ */ new Map();
  for (const node of dependencyGraph.nodes) {
    const parts = node.split("/");
    const dir = parts.length > 2 ? parts.slice(0, 2).join("/") : parts[0];
    if (!clusters.has(dir)) clusters.set(dir, []);
    clusters.get(dir).push(node);
  }
  const connectionCounts = /* @__PURE__ */ new Map();
  for (const edge of dependencyGraph.edges) {
    connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
    connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
  }
  const topNodes = new Set(
    [...connectionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([node]) => node)
  );
  if (dependencyGraph.nodes.length <= 30) {
    for (const node of dependencyGraph.nodes) {
      topNodes.add(node);
    }
  }
  if (dependencyGraph.nodes.length === 0) {
    const content2 = `---
title: Architecture
description: System architecture and dependency graph
---

# Architecture

## Dependency Graph

!!! info "Architecture diagram unavailable"
    No dependency relationships were detected between analyzed files.
    This can happen when files don't import from each other or when
    the project uses non-standard import patterns.

---

*Generated by DocWalk from commit \`${manifest.commitSha.slice(0, 8)}\`*
`;
    return {
      path: "architecture.md",
      title: "Architecture",
      content: content2,
      navGroup: "",
      navOrder: 2
    };
  }
  const dirColors = [":::blue", ":::green", ":::orange", ":::pink", ":::purple"];
  const dirColorMap = /* @__PURE__ */ new Map();
  let colorIdx = 0;
  for (const [dir] of clusters) {
    dirColorMap.set(dir, dirColors[colorIdx % dirColors.length]);
    colorIdx++;
  }
  const graphDirection = topNodes.size > 15 ? "TD" : "LR";
  let mermaidContent = `graph ${graphDirection}
`;
  for (const [dir, nodes] of clusters) {
    const filteredNodes = nodes.filter((n) => topNodes.has(n));
    if (filteredNodes.length === 0) continue;
    mermaidContent += `  subgraph ${sanitizeMermaidId(dir)}["${dir}"]
`;
    for (const node of filteredNodes) {
      mermaidContent += `    ${sanitizeMermaidId(node)}["${import_path9.default.basename(node)}"]
`;
    }
    mermaidContent += "  end\n";
  }
  const visibleEdges = dependencyGraph.edges.filter(
    (e) => topNodes.has(e.from) && topNodes.has(e.to)
  );
  for (const edge of visibleEdges.slice(0, 100)) {
    const style = edge.isTypeOnly ? "-.->" : "-->";
    mermaidContent += `  ${sanitizeMermaidId(edge.from)} ${style} ${sanitizeMermaidId(edge.to)}
`;
  }
  const moduleRows = manifest.modules.map((m) => {
    const outgoing = dependencyGraph.edges.filter((e) => e.from === m.filePath).length;
    const incoming = dependencyGraph.edges.filter((e) => e.to === m.filePath).length;
    return { filePath: m.filePath, deps: outgoing, dependents: incoming, total: outgoing + incoming };
  }).sort((a, b) => b.total - a.total).slice(0, 30);
  const content = `---
title: Architecture
description: System architecture and dependency graph
---

# Architecture

## Dependency Graph

!!! info "Graph Legend"
    Solid arrows (\`\u2192\`) are value imports. Dashed arrows (\`\u21E2\`) are type-only imports.
    Nodes are clustered by directory. Only the ${topNodes.size} most-connected modules are shown.

\`\`\`mermaid
${mermaidContent}\`\`\`

${dependencyGraph.nodes.length > 30 ? `
!!! note "Showing ${topNodes.size} of ${dependencyGraph.nodes.length} modules"
    The full graph has ${dependencyGraph.nodes.length} nodes and ${dependencyGraph.edges.length} edges.
` : ""}

## Module Relationships

| Module | Dependencies | Dependents | Total |
|--------|:-----------:|:----------:|:-----:|
${moduleRows.map((r) => {
    const slug = r.filePath.replace(/\.[^.]+$/, "");
    return `| [\`${r.filePath}\`](api/${slug}.md) | ${r.deps} | ${r.dependents} | **${r.total}** |`;
  }).join("\n")}

## Statistics

| Metric | Value |
|--------|-------|
| Modules in graph | **${dependencyGraph.nodes.length}** |
| Dependency edges | **${dependencyGraph.edges.length}** |
| Type-only imports | **${dependencyGraph.edges.filter((e) => e.isTypeOnly).length}** |
| Avg dependencies/module | **${dependencyGraph.nodes.length > 0 ? (dependencyGraph.edges.length / dependencyGraph.nodes.length).toFixed(1) : "0"}** |

---

*Generated by DocWalk from commit \`${manifest.commitSha.slice(0, 8)}\`*
`;
  return {
    path: "architecture.md",
    title: "Architecture",
    content,
    navGroup: "",
    navOrder: 2,
    audience: "developer"
  };
}
function generateTieredArchitecturePages(manifest) {
  const pages = [];
  const { dependencyGraph } = manifest;
  if (dependencyGraph.nodes.length === 0) {
    pages.push({
      path: "architecture/index.md",
      title: "Architecture",
      content: `---
title: Architecture
description: System architecture overview
---

# Architecture

## System Overview

!!! info "Architecture diagram unavailable"
    No dependency relationships were detected between analyzed files.
    This can happen when files don't import from each other or when
    the project uses non-standard import patterns.

---

*Generated by DocWalk from commit \`${manifest.commitSha.slice(0, 8)}\`*
`,
      navGroup: "Architecture",
      navOrder: 2,
      audience: "developer"
    });
    return pages;
  }
  const packageMap = /* @__PURE__ */ new Map();
  for (const node of dependencyGraph.nodes) {
    const parts = node.split("/");
    const dir = parts.length > 2 ? parts.slice(0, 2).join("/") : parts[0];
    if (!packageMap.has(dir)) packageMap.set(dir, []);
    packageMap.get(dir).push(node);
  }
  let t1Content = `---
title: Architecture
description: System architecture overview
---

# Architecture

## System Overview

High-level view of the project's package/directory structure and their relationships.

\`\`\`mermaid
graph ${packageMap.size > 15 ? "TD" : "LR"}
`;
  for (const [dir, nodes] of packageMap) {
    const dirId = sanitizeMermaidId(dir);
    t1Content += `  ${dirId}["${dir} (${nodes.length} files)"]
`;
  }
  const crossPkgEdges = /* @__PURE__ */ new Set();
  for (const edge of dependencyGraph.edges) {
    const fromParts = edge.from.split("/");
    const toParts = edge.to.split("/");
    const fromDir = fromParts.length > 2 ? fromParts.slice(0, 2).join("/") : fromParts[0];
    const toDir = toParts.length > 2 ? toParts.slice(0, 2).join("/") : toParts[0];
    if (fromDir !== toDir) {
      const key = `${fromDir}|${toDir}`;
      if (!crossPkgEdges.has(key)) {
        crossPkgEdges.add(key);
        const style = edge.isTypeOnly ? "-.->" : "-->";
        t1Content += `  ${sanitizeMermaidId(fromDir)} ${style} ${sanitizeMermaidId(toDir)}
`;
      }
    }
  }
  t1Content += `\`\`\`

## Packages

| Package | Files | Symbols | Key Exports |
|---------|:-----:|:-------:|-------------|
`;
  for (const [dir, nodes] of packageMap) {
    const dirSlug = dir;
    const modulesInDir = manifest.modules.filter((m) => nodes.includes(m.filePath));
    const totalSymbols = modulesInDir.reduce((s, m) => s + m.symbols.length, 0);
    const keyExports = modulesInDir.flatMap((m) => m.symbols.filter((s) => s.exported)).slice(0, 3).map((s) => `\`${s.name}\``).join(", ");
    t1Content += `| [**${dir}**](${dirSlug}.md) | ${nodes.length} | ${totalSymbols} | ${keyExports || "\u2014"} |
`;
  }
  t1Content += `
---

## Statistics

| Metric | Value |
|--------|-------|
| Total packages | **${packageMap.size}** |
| Total modules | **${dependencyGraph.nodes.length}** |
| Total edges | **${dependencyGraph.edges.length}** |
| Cross-package edges | **${crossPkgEdges.size}** |

---

*Generated by DocWalk from commit \`${manifest.commitSha.slice(0, 8)}\`*
`;
  pages.push({
    path: "architecture/index.md",
    title: "Architecture",
    content: t1Content,
    navGroup: "",
    navOrder: 2,
    audience: "developer"
  });
  for (const [dir, nodes] of packageMap) {
    const dirSlug = dir;
    const modulesInDir = manifest.modules.filter((m) => nodes.includes(m.filePath));
    let t2Content = `---
title: "${dir}"
description: "Architecture detail for ${dir}"
---

# ${dir}

## Module Graph

\`\`\`mermaid
graph ${nodes.length > 15 ? "TD" : "LR"}
`;
    for (const node of nodes) {
      const nodeId = sanitizeMermaidId(node);
      const isEntry = node.includes("index.") || node.includes("main.");
      t2Content += `  ${nodeId}["${import_path9.default.basename(node)}"]${isEntry ? "\n  style " + nodeId + " fill:#5de4c7,color:#000" : ""}
`;
    }
    const nodesSet = new Set(nodes);
    for (const edge of dependencyGraph.edges) {
      if (nodesSet.has(edge.from) && nodesSet.has(edge.to)) {
        const style = edge.isTypeOnly ? "-.->" : "-->";
        t2Content += `  ${sanitizeMermaidId(edge.from)} ${style} ${sanitizeMermaidId(edge.to)}
`;
      }
    }
    t2Content += `\`\`\`

## Modules

| Module | Dependencies | Dependents | Exports |
|--------|:-----------:|:----------:|:-------:|
`;
    for (const mod of modulesInDir) {
      const deps = dependencyGraph.edges.filter((e) => e.from === mod.filePath).length;
      const dependents = dependencyGraph.edges.filter((e) => e.to === mod.filePath).length;
      const exports2 = mod.symbols.filter((s) => s.exported).length;
      const modSlug = mod.filePath.replace(/\.[^.]+$/, "");
      t2Content += `| [\`${import_path9.default.basename(mod.filePath)}\`](../api/${modSlug}.md) | ${deps} | ${dependents} | ${exports2} |
`;
    }
    t2Content += `
---

*Part of the [Architecture](index.md) overview*
`;
    pages.push({
      path: `architecture/${dirSlug}.md`,
      title: dir,
      content: t2Content,
      navGroup: "Architecture",
      navOrder: 2,
      audience: "developer"
    });
  }
  return pages;
}
async function generateArchitecturePageNarrative(manifest, provider, readFile7, repoUrl, branch) {
  const basePage = generateArchitecturePage(manifest);
  try {
    const narrative = await generateArchitectureNarrative({
      provider,
      manifest,
      readFile: readFile7
    });
    const prose = renderCitations(narrative.prose, narrative.citations, repoUrl, branch);
    const diagramSections = narrative.suggestedDiagrams.map((d) => `### ${d.title}

\`\`\`mermaid
${d.mermaidCode}
\`\`\`
`).join("\n");
    const narrativeSection = `
## Architecture Overview

${prose}

${diagramSections ? `## AI-Generated Diagrams

${diagramSections}` : ""}`;
    const insertPoint = basePage.content.indexOf("## Module Relationships");
    if (insertPoint > 0) {
      const content = basePage.content.slice(0, insertPoint) + narrativeSection + "\n" + basePage.content.slice(insertPoint);
      return { ...basePage, content };
    }
    return { ...basePage, content: basePage.content + narrativeSection };
  } catch {
    return basePage;
  }
}
var import_path9;
var init_architecture = __esm({
  "src/generators/pages/architecture.ts"() {
    "use strict";
    import_path9 = __toESM(require("path"), 1);
    init_utils();
    init_narrative_engine();
  }
});

// src/generators/pages/module.ts
function generateModulePage(mod, group, ctx) {
  const slug = mod.filePath.replace(/\.[^.]+$/, "");
  const publicSymbols = mod.symbols.filter((s) => s.exported);
  const privateSymbols = mod.symbols.filter((s) => !s.exported);
  const langTag = getLanguageTag(mod.language);
  const summary = mod.moduleDoc?.summary || mod.aiSummary || "";
  const description = mod.moduleDoc?.description && mod.moduleDoc.description !== mod.moduleDoc.summary ? mod.moduleDoc.description : "";
  const config = ctx?.config;
  const manifest = ctx?.manifest;
  const isGitHubRepo = config?.source.repo.includes("/") ?? false;
  const repoUrl = isGitHubRepo ? config.source.repo : void 0;
  const branch = config?.source.branch ?? "main";
  const sourceLinksEnabled = config?.analysis.source_links !== false && isGitHubRepo;
  const renderOpts = {
    repoUrl,
    branch,
    sourceLinks: sourceLinksEnabled,
    symbolPageMap: ctx?.symbolPageMap
  };
  let content = `---
title: "${import_path10.default.basename(mod.filePath)}"
description: "${mod.moduleDoc?.summary || `API reference for ${mod.filePath}`}"
---

# ${import_path10.default.basename(mod.filePath)}

${summary}

${description}

`;
  if (sourceLinksEnabled && repoUrl) {
    const sourceUrl = `https://github.com/${repoUrl}/blob/${branch}/${mod.filePath}`;
    const depFiles = mod.imports.filter((imp) => imp.source.startsWith(".") || imp.source.startsWith("@/")).map((imp) => imp.source).slice(0, 5);
    content += `???+ info "Relevant source files"
`;
    content += `    - [\`${mod.filePath}\`](${sourceUrl}) (${mod.lineCount} lines)
`;
    if (depFiles.length > 0) {
      content += `    - Dependencies: ${depFiles.map((d) => `\`${d}\``).join(", ")}
`;
    }
    content += "\n";
  }
  content += `| | |
|---|---|
`;
  content += `| **Source** | \`${mod.filePath}\` |
`;
  content += `| **Language** | ${getLanguageDisplayName(mod.language)} |
`;
  content += `| **Lines** | ${mod.lineCount} |
`;
  if (publicSymbols.length > 0) content += `| **Exports** | ${publicSymbols.length} |
`;
  content += "\n";
  if (mod.aiSummary && mod.moduleDoc?.summary) {
    content += `!!! abstract "AI Summary"
    ${mod.aiSummary}

`;
  }
  const useTabs = publicSymbols.length > 0 && privateSymbols.length > 0;
  if (publicSymbols.length > 0) {
    content += `---

## Exports

`;
    if (useTabs) {
      content += `=== "Exports (${publicSymbols.length})"

`;
      content += `    | Name | Kind | Description |
`;
      content += `    |------|------|-------------|
`;
      for (const sym of publicSymbols) {
        const kindBadge = getKindBadge(sym.kind);
        const symAnchor = sym.name.toLowerCase().replace(/[^a-z0-9-_]/g, "");
        const deprecated = sym.docs?.deprecated || sym.decorators?.some((d) => d.toLowerCase().includes("deprecated"));
        const nameDisplay = deprecated ? `==\`${sym.name}\`== :material-alert: deprecated` : `[\`${sym.name}\`](#${symAnchor})`;
        content += `    | ${nameDisplay} | ${kindBadge} | ${sym.docs?.summary || sym.aiSummary || ""} |
`;
      }
      content += "\n";
      content += `=== "Internal (${privateSymbols.length})"

`;
      for (const sym of privateSymbols) {
        const kindBadge = getKindBadge(sym.kind);
        content += `    - \`${sym.name}\` \u2014 ${kindBadge}${sym.docs?.summary ? ` \u2014 ${sym.docs.summary}` : ""}
`;
      }
      content += "\n";
    } else {
      content += `| Name | Kind | Description |
`;
      content += `|------|------|-------------|
`;
      for (const sym of publicSymbols) {
        const kindBadge = getKindBadge(sym.kind);
        const symAnchor = sym.name.toLowerCase().replace(/[^a-z0-9-_]/g, "");
        const deprecated = sym.docs?.deprecated || sym.decorators?.some((d) => d.toLowerCase().includes("deprecated"));
        const nameDisplay = deprecated ? `==\`${sym.name}\`== :material-alert: deprecated` : `[\`${sym.name}\`](#${symAnchor})`;
        content += `| ${nameDisplay} | ${kindBadge} | ${sym.docs?.summary || sym.aiSummary || ""} |
`;
      }
      content += "\n";
    }
  }
  if (publicSymbols.length > 0) {
    content += `---

## API Reference

`;
    for (const sym of publicSymbols) {
      content += renderSymbol(sym, langTag, renderOpts);
    }
  }
  if (manifest) {
    const upstream = manifest.dependencyGraph.edges.filter((e) => e.to === mod.filePath).map((e) => e.from);
    const downstream = manifest.dependencyGraph.edges.filter((e) => e.from === mod.filePath).map((e) => e.to);
    if (upstream.length > 0 || downstream.length > 0) {
      content += `---

## Architecture Context

`;
      content += `\`\`\`mermaid
graph LR
`;
      const thisId = sanitizeMermaidId(mod.filePath);
      content += `  ${thisId}["${import_path10.default.basename(mod.filePath)}"]
`;
      content += `  style ${thisId} fill:#5de4c7,color:#000
`;
      for (const up of upstream.slice(0, 8)) {
        const upId = sanitizeMermaidId(up);
        content += `  ${upId}["${import_path10.default.basename(up)}"] --> ${thisId}
`;
      }
      for (const down of downstream.slice(0, 8)) {
        const downId = sanitizeMermaidId(down);
        content += `  ${thisId} --> ${downId}["${import_path10.default.basename(down)}"]
`;
      }
      content += `\`\`\`

`;
    }
  }
  if (manifest) {
    const referencedBy = manifest.dependencyGraph.edges.filter((e) => e.to === mod.filePath).map((e) => e.from);
    if (referencedBy.length > 0) {
      content += `---

## Referenced By

`;
      content += `This module is imported by **${referencedBy.length}** other module${referencedBy.length > 1 ? "s" : ""}:

`;
      for (const ref of referencedBy.sort()) {
        const refSlug = ref.replace(/\.[^.]+$/, "");
        content += `- [\`${ref}\`](/api/${refSlug}.md)
`;
      }
      content += "\n";
    }
  }
  if (mod.imports.length > 0) {
    content += `---

## Dependencies

`;
    const typeImports = mod.imports.filter((imp) => imp.isTypeOnly);
    const valueImports = mod.imports.filter((imp) => !imp.isTypeOnly);
    if (valueImports.length > 0) {
      for (const imp of valueImports) {
        const names = imp.specifiers.map((s) => s.alias ? `${s.name} as ${s.alias}` : s.name).join(", ");
        content += `- \`${imp.source}\`${names ? ` \u2014 ${names}` : ""}
`;
      }
    }
    if (typeImports.length > 0) {
      content += `
??? note "Type-only imports (${typeImports.length})"

`;
      for (const imp of typeImports) {
        const names = imp.specifiers.map((s) => s.alias ? `${s.name} as ${s.alias}` : s.name).join(", ");
        content += `    - \`${imp.source}\`${names ? ` \u2014 ${names}` : ""}
`;
      }
    }
    content += "\n";
  }
  if (privateSymbols.length > 0 && !useTabs) {
    content += `---

## Internal

`;
    content += `??? note "Show ${privateSymbols.length} internal symbols"

`;
    for (const sym of privateSymbols) {
      const kindBadge = getKindBadge(sym.kind);
      content += `    - \`${sym.name}\` \u2014 ${kindBadge}${sym.docs?.summary ? ` \u2014 ${sym.docs.summary}` : ""}
`;
    }
    content += "\n";
  }
  content += `---

*Source: \`${mod.filePath}\` \xB7 Last analyzed: ${mod.analyzedAt}*
`;
  return {
    path: `api/${slug}.md`,
    title: import_path10.default.basename(mod.filePath),
    content,
    navGroup: group || "API Reference",
    navOrder: 10,
    audience: "developer"
  };
}
async function generateModulePageNarrative(mod, group, ctx, provider, readFile7) {
  const basePage = generateModulePage(mod, group, ctx);
  try {
    const narrative = await generateModuleNarrative(mod, {
      provider,
      manifest: ctx.manifest,
      readFile: readFile7
    });
    const repoUrl = ctx.config.source.repo.includes("/") ? ctx.config.source.repo : void 0;
    const prose = renderCitations(narrative.prose, narrative.citations, repoUrl, ctx.config.source.branch);
    const insertPoint = basePage.content.indexOf("---\n\n## Exports");
    if (insertPoint > 0) {
      const content = basePage.content.slice(0, insertPoint) + `
## Overview

${prose}

` + basePage.content.slice(insertPoint);
      return { ...basePage, content };
    }
    return basePage;
  } catch {
    return basePage;
  }
}
var import_path10;
var init_module = __esm({
  "src/generators/pages/module.ts"() {
    "use strict";
    import_path10 = __toESM(require("path"), 1);
    init_language_detect();
    init_utils();
    init_narrative_engine();
  }
});

// src/generators/pages/configuration.ts
function generateConfigurationPage(manifest, config) {
  const meta = manifest.projectMeta;
  const projectName = resolveProjectName(manifest);
  const configModules = manifest.modules.filter((mod) => {
    const basename = import_path11.default.basename(mod.filePath).toLowerCase();
    return basename.includes("config") || basename.includes("settings") || basename.includes("schema") || /\.(config|rc)\.[^.]+$/.test(basename);
  });
  let configFilesSection = "";
  if (configModules.length > 0) {
    configFilesSection += `## Configuration Files

`;
    configFilesSection += `| File | Language | Exports | Description |
`;
    configFilesSection += `|------|----------|:-------:|-------------|
`;
    for (const mod of configModules) {
      const publicSymbols = mod.symbols.filter((s) => s.exported);
      const slug = mod.filePath.replace(/\.[^.]+$/, "");
      const desc = mod.moduleDoc?.summary || "";
      configFilesSection += `| [\`${mod.filePath}\`](api/${slug}.md) | ${getLanguageDisplayName(mod.language)} | ${publicSymbols.length} | ${desc} |
`;
    }
    configFilesSection += "\n";
    for (const mod of configModules) {
      const publicSymbols = mod.symbols.filter((s) => s.exported);
      if (publicSymbols.length === 0) continue;
      const langTag = getLanguageTag(mod.language);
      configFilesSection += `### ${import_path11.default.basename(mod.filePath)}

`;
      configFilesSection += `Source: \`${mod.filePath}\`

`;
      for (const sym of publicSymbols) {
        configFilesSection += renderSymbol(sym, langTag);
      }
    }
  } else {
    configFilesSection += `!!! note "No configuration files detected"
    No files matching config patterns (\`*.config.*\`, \`config.*\`, \`settings.*\`, \`schema.*\`) were found in the analyzed source.

`;
  }
  const langSummary = meta.languages.map((l) => `${getLanguageDisplayName(l.name)} (${l.fileCount} files)`).join(", ");
  const analysisOptions = [
    `Depth: **${config.analysis.depth}**`,
    `Dependency graph: **${config.analysis.dependency_graph ? "enabled" : "disabled"}**`,
    `AI summaries: **${config.analysis.ai_summaries ? "enabled" : "disabled"}**`,
    `Changelog: **${config.analysis.changelog ? "enabled" : "disabled"}**`
  ].join(" \xB7 ");
  const content = `---
title: Configuration
description: Configuration reference for ${projectName}
---

# Configuration

This page documents configuration schemas and settings found in **${projectName}**.

---

${configFilesSection}

---

## Project Configuration Summary

| Setting | Value |
|---------|-------|
| Languages detected | ${langSummary} |
| Total files analyzed | **${manifest.stats.totalFiles}** |
| Analysis options | ${analysisOptions} |

---

*Generated by DocWalk from commit \`${manifest.commitSha.slice(0, 8)}\`*
`;
  return {
    path: "configuration.md",
    title: "Configuration",
    content,
    navGroup: "",
    navOrder: 3,
    audience: "developer"
  };
}
var import_path11;
var init_configuration = __esm({
  "src/generators/pages/configuration.ts"() {
    "use strict";
    import_path11 = __toESM(require("path"), 1);
    init_language_detect();
    init_utils();
  }
});

// src/generators/pages/types.ts
function generateTypesPage(manifest) {
  const typeSymbols = [];
  const modulesByGroup = groupModulesLogically(manifest.modules);
  for (const [group, modules] of Object.entries(modulesByGroup)) {
    for (const mod of modules) {
      for (const sym of mod.symbols) {
        if (sym.exported && (sym.kind === "interface" || sym.kind === "type" || sym.kind === "enum")) {
          typeSymbols.push({ symbol: sym, module: mod, group });
        }
      }
    }
  }
  let masterTable = "";
  if (typeSymbols.length > 0) {
    masterTable += `| Name | Kind | Module | Description |
`;
    masterTable += `|------|------|--------|-------------|
`;
    for (const { symbol: sym, module: mod } of typeSymbols) {
      const kindBadge = getKindBadge(sym.kind);
      const desc = sym.docs?.summary || sym.aiSummary || "";
      const symAnchor = sym.name.toLowerCase().replace(/[^a-z0-9-_]/g, "");
      masterTable += `| [\`${sym.name}\`](#${symAnchor}) | ${kindBadge} | \`${import_path12.default.basename(mod.filePath)}\` | ${desc} |
`;
    }
    masterTable += "\n";
  }
  let detailedSections = "";
  const groupedTypes = /* @__PURE__ */ new Map();
  for (const entry of typeSymbols) {
    if (!groupedTypes.has(entry.group)) groupedTypes.set(entry.group, []);
    groupedTypes.get(entry.group).push(entry);
  }
  for (const [group, entries] of groupedTypes) {
    detailedSections += `## ${group}

`;
    for (const { symbol: sym, module: mod } of entries) {
      const langTag = getLanguageTag(mod.language);
      detailedSections += renderSymbol(sym, langTag);
    }
  }
  const content = `---
title: Types & Interfaces
description: Aggregate type definitions, interfaces, and enums
---

# Types & Interfaces

All exported types, interfaces, and enums across the codebase.

!!! info "Summary"
    **${typeSymbols.length}** type definitions found across **${new Set(typeSymbols.map((t) => t.module.filePath)).size}** modules.

---

${masterTable ? `## Overview

${masterTable}---

` : ""}${detailedSections || '!!! note "No exported types found"\n    No exported interfaces, types, or enums were detected in the analyzed source.\n'}

---

*Generated by DocWalk from commit \`${manifest.commitSha.slice(0, 8)}\`*
`;
  return {
    path: "types.md",
    title: "Types & Interfaces",
    content,
    navGroup: "",
    navOrder: 4,
    audience: "developer"
  };
}
var import_path12;
var init_types = __esm({
  "src/generators/pages/types.ts"() {
    "use strict";
    import_path12 = __toESM(require("path"), 1);
    init_utils();
  }
});

// src/generators/pages/dependencies.ts
function generateDependenciesPage(manifest) {
  const externalDeps = /* @__PURE__ */ new Map();
  for (const mod of manifest.modules) {
    for (const imp of mod.imports) {
      if (imp.source.startsWith(".") || imp.source.startsWith("/")) continue;
      const parts = imp.source.split("/");
      const pkgName = imp.source.startsWith("@") && parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
      if (!externalDeps.has(pkgName)) {
        externalDeps.set(pkgName, { modules: /* @__PURE__ */ new Set(), typeOnly: true });
      }
      const entry = externalDeps.get(pkgName);
      entry.modules.add(mod.filePath);
      if (!imp.isTypeOnly) entry.typeOnly = false;
    }
  }
  const sorted = [...externalDeps.entries()].sort((a, b) => b[1].modules.size - a[1].modules.size);
  let tableContent = "";
  if (sorted.length > 0) {
    tableContent += `| Package | Used By | Import Type |
`;
    tableContent += `|---------|:-------:|:-----------:|
`;
    for (const [pkg, info] of sorted) {
      const importType = info.typeOnly ? ":material-tag: type-only" : ":material-package-variant: value";
      tableContent += `| \`${pkg}\` | ${info.modules.size} module${info.modules.size > 1 ? "s" : ""} | ${importType} |
`;
    }
    tableContent += "\n";
  }
  let detailedContent = "";
  for (const [pkg, info] of sorted.slice(0, 30)) {
    detailedContent += `### \`${pkg}\`

`;
    detailedContent += `Used by ${info.modules.size} module${info.modules.size > 1 ? "s" : ""}:

`;
    for (const modPath of [...info.modules].sort()) {
      const slug = modPath.replace(/\.[^.]+$/, "");
      detailedContent += `- [\`${modPath}\`](api/${slug}.md)
`;
    }
    detailedContent += "\n";
  }
  const content = `---
title: Dependencies
description: External dependencies and their usage
---

# Dependencies

External packages imported across the codebase.

!!! info "Summary"
    **${sorted.length}** external packages detected across **${manifest.modules.length}** modules.

---

## Package Overview

${tableContent || "*No external dependencies detected.*\n"}

---

## Usage Details

${detailedContent || "*No external dependencies to detail.*\n"}

---

*Generated by DocWalk from commit \`${manifest.commitSha.slice(0, 8)}\`*
`;
  return {
    path: "dependencies.md",
    title: "Dependencies",
    content,
    navGroup: "",
    navOrder: 5,
    audience: "developer"
  };
}
function generateSBOMPage(manifest, config) {
  const externalDeps = /* @__PURE__ */ new Map();
  for (const mod of manifest.modules) {
    for (const imp of mod.imports) {
      if (imp.source.startsWith(".") || imp.source.startsWith("/")) continue;
      const parts = imp.source.split("/");
      const pkgName = imp.source.startsWith("@") && parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0];
      if (!externalDeps.has(pkgName)) {
        externalDeps.set(pkgName, { modules: /* @__PURE__ */ new Set(), typeOnly: true });
      }
      const entry = externalDeps.get(pkgName);
      entry.modules.add(mod.filePath);
      if (!imp.isTypeOnly) entry.typeOnly = false;
    }
  }
  const sorted = [...externalDeps.entries()].sort((a, b) => b[1].modules.size - a[1].modules.size);
  const runtime = sorted.filter(([, info]) => !info.typeOnly);
  const devOnly = sorted.filter(([, info]) => info.typeOnly);
  let tableContent = "";
  if (sorted.length > 0) {
    tableContent += `| Package | Version | License | Used By | Category |
`;
    tableContent += `|---------|---------|---------|:-------:|:---------:|
`;
    for (const [pkg, info] of sorted) {
      const category = info.typeOnly ? ":material-wrench: Dev" : ":material-package-variant: Runtime";
      tableContent += `| \`${pkg}\` | \u2014 | \u2014 | ${info.modules.size} module${info.modules.size > 1 ? "s" : ""} | ${category} |
`;
    }
    tableContent += "\n";
  }
  let detailedContent = "";
  for (const [pkg, info] of sorted.slice(0, 30)) {
    detailedContent += `### \`${pkg}\`

`;
    detailedContent += `Used by ${info.modules.size} module${info.modules.size > 1 ? "s" : ""}:

`;
    for (const modPath of [...info.modules].sort()) {
      const slug = modPath.replace(/\.[^.]+$/, "");
      detailedContent += `- [\`${modPath}\`](api/${slug}.md)
`;
    }
    detailedContent += "\n";
  }
  const content = `---
title: Software Bill of Materials
description: Dependencies, versions, and licenses
---

# Software Bill of Materials

External packages imported across the codebase with categorization.

!!! info "Summary"
    **${sorted.length}** external packages detected: **${runtime.length}** runtime, **${devOnly.length}** dev/type-only.

---

## Dependency Overview

${tableContent || "*No external dependencies detected.*\n"}

---

## Runtime Dependencies

${runtime.length > 0 ? runtime.map(([pkg, info]) => `- \`${pkg}\` \u2014 ${info.modules.size} module${info.modules.size > 1 ? "s" : ""}`).join("\n") : "*None detected.*"}

---

## Dev / Type-only Dependencies

${devOnly.length > 0 ? devOnly.map(([pkg, info]) => `- \`${pkg}\` \u2014 ${info.modules.size} module${info.modules.size > 1 ? "s" : ""}`).join("\n") : "*None detected.*"}

---

## Usage Details

${detailedContent || "*No external dependencies to detail.*\n"}

---

*Generated by DocWalk from commit \`${manifest.commitSha.slice(0, 8)}\`*
`;
  return {
    path: "dependencies.md",
    title: "Software Bill of Materials",
    content,
    navGroup: "",
    navOrder: 5,
    audience: "developer"
  };
}
var init_dependencies = __esm({
  "src/generators/pages/dependencies.ts"() {
    "use strict";
  }
});

// src/generators/pages/usage-guide.ts
function generateUsageGuidePage(manifest, config) {
  const meta = manifest.projectMeta;
  const projectName = resolveProjectName(manifest);
  const modulesByGroup = groupModulesLogically(manifest.modules);
  const sectionCount = Object.keys(modulesByGroup).length;
  const archLink = config.analysis.architecture_tiers !== false ? "architecture/index.md" : "architecture.md";
  const connectionCounts = /* @__PURE__ */ new Map();
  for (const edge of manifest.dependencyGraph.edges) {
    connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
    connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
  }
  const topConnected = [...connectionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const primaryLang = meta.languages[0] ? getLanguageDisplayName(meta.languages[0].name) : "";
  const langDesc = primaryLang ? `a ${primaryLang} project` : "this project";
  const sectionList = Object.entries(modulesByGroup).sort(([, a], [, b]) => b.length - a.length).map(([section, modules]) => `- **${section}** \u2014 ${modules.length} module${modules.length > 1 ? "s" : ""}`).join("\n");
  let keyModulesSection = "";
  if (topConnected.length > 0) {
    keyModulesSection = `### Key Modules

The most interconnected modules \u2014 good starting points:

`;
    keyModulesSection += topConnected.map(([file, count]) => {
      const slug = file.replace(/\.[^.]+$/, "");
      return `- [\`${file}\`](api/${slug}.md) \u2014 ${count} connections`;
    }).join("\n");
    keyModulesSection += "\n";
  }
  const content = `---
title: Usage Guide
description: How to navigate and use the ${projectName} documentation
---

# Usage Guide

This documentation covers **${projectName}**, ${langDesc} with **${manifest.stats.totalFiles} files** across **${sectionCount} sections** and **${manifest.stats.totalSymbols} documented symbols**.

It is auto-generated by [DocWalk](https://docwalk.dev) and stays in sync with the repository.

---

## API Reference Organization

API Reference pages are grouped by logical section based on directory structure:

${sectionList}

Each module page includes:

- Module summary and metadata
- Exports table with kind badges
- Detailed API reference with signatures, parameters, and return types
- Architecture context diagram
- Dependency list (internal and external imports)

---

## Quick Start

| Page | Description |
|------|-------------|
| **[Overview](index.md)** | Project summary, statistics, and quick links |
| **[Getting Started](getting-started.md)** | Prerequisites, installation, and project structure |
| **[Architecture](${archLink})** | Dependency graph and module relationships |
${config.analysis.config_docs ? `| **[Configuration](configuration.md)** | Configuration schemas and settings reference |
` : ""}${config.analysis.types_page ? `| **[Types & Interfaces](types.md)** | Aggregate view of all exported types |
` : ""}${config.analysis.dependencies_page ? `| **[Dependencies](dependencies.md)** | External packages and their usage across modules |
` : ""}${config.analysis.changelog !== false ? `| **[Changelog](changelog.md)** | Recent changes from git history |
` : ""}
${keyModulesSection}

---

## Regenerating These Docs

To regenerate this documentation after code changes:

\`\`\`bash
npx docwalk generate
\`\`\`

DocWalk will re-analyze the codebase and rebuild all pages. For incremental updates, use:

\`\`\`bash
npx docwalk sync
\`\`\`

---

## Tips

- Use the **search** (\`/\`) to quickly find any function, class, or type by name
- **Code blocks** have a copy button \u2014 click to copy snippets
- **Collapsible sections** (marked with \u25BA) expand for additional detail
- **Mermaid diagrams** on Architecture pages are interactive \u2014 hover for details

---

*Generated by [DocWalk](https://docwalk.dev)*
`;
  return {
    path: "guide.md",
    title: "Usage Guide",
    content,
    navGroup: "",
    navOrder: 6,
    audience: "developer"
  };
}
var init_usage_guide = __esm({
  "src/generators/pages/usage-guide.ts"() {
    "use strict";
    init_language_detect();
    init_utils();
  }
});

// src/utils/index.ts
function resolveRepoRoot(source) {
  if (source.provider !== "local") {
    return process.cwd();
  }
  const repo = source.repo;
  if (repo.includes("/") && !repo.startsWith(".") && !repo.startsWith("/")) {
    return process.cwd();
  }
  return import_path13.default.resolve(repo);
}
var import_path13;
var init_utils2 = __esm({
  "src/utils/index.ts"() {
    "use strict";
    import_path13 = __toESM(require("path"), 1);
    init_hash();
    init_logger();
  }
});

// src/generators/pages/changelog.ts
async function generateChangelogPage(config) {
  let changelogContent = "";
  try {
    const repoRoot = resolveRepoRoot(config.source);
    const git = (0, import_simple_git.default)(repoRoot);
    const tagsResult = await git.tags(["--sort=-creatordate"]);
    const versionTags = tagsResult.all.filter((t) => /^v?\d+\.\d+/.test(t));
    const logResult = await git.log({
      maxCount: config.analysis.changelog_depth || 100
    });
    if (logResult.all.length === 0) {
      changelogContent = "*No commits found.*\n";
    } else if (versionTags.length > 0) {
      const tagDates = /* @__PURE__ */ new Map();
      for (const tag of versionTags) {
        try {
          const tagLog = await git.log({ maxCount: 1, from: void 0, to: tag });
          if (tagLog.latest) {
            tagDates.set(tag, new Date(tagLog.latest.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }));
          }
        } catch {
        }
      }
      const allCommits = logResult.all.map((c) => ({
        hash: c.hash,
        message: c.message,
        author: c.author_name,
        date: c.date,
        type: parseConventionalType(c.message)
      }));
      const tagCommitSets = [];
      for (let i = 0; i < versionTags.length; i++) {
        const tag = versionTags[i];
        const prevTag = versionTags[i + 1];
        try {
          const range = prevTag ? `${prevTag}..${tag}` : tag;
          const rangeLog = await git.log({ from: prevTag, to: tag, maxCount: 50 });
          tagCommitSets.push({
            tag,
            commits: rangeLog.all.map((c) => ({
              hash: c.hash,
              message: c.message,
              author: c.author_name,
              date: c.date,
              type: parseConventionalType(c.message)
            }))
          });
        } catch {
          tagCommitSets.push({ tag, commits: [] });
        }
      }
      if (versionTags.length > 0) {
        try {
          const unreleasedLog = await git.log({ from: versionTags[0], maxCount: 50 });
          if (unreleasedLog.all.length > 0) {
            changelogContent += `## Unreleased

`;
            for (const commit of unreleasedLog.all) {
              const shortHash = commit.hash.slice(0, 7);
              const cleanMsg = commit.message.replace(/^(feat|fix|docs|refactor|test|chore|perf|ci|style|build)(\([^)]*\))?:\s*/, "");
              changelogContent += `- \`${shortHash}\` ${parseConventionalType(commit.message)}: ${cleanMsg}
`;
            }
            changelogContent += "\n";
          }
        } catch {
        }
      }
      const typeLabels = {
        feat: "Features",
        fix: "Bug Fixes",
        docs: "Documentation",
        refactor: "Refactoring",
        test: "Tests",
        chore: "Chores",
        perf: "Performance",
        ci: "CI/CD",
        style: "Style",
        build: "Build",
        other: "Other Changes"
      };
      for (let i = 0; i < tagCommitSets.length; i++) {
        const { tag, commits } = tagCommitSets[i];
        const dateStr = tagDates.get(tag) || "";
        const admonType = i === 0 ? "success" : "note";
        if (commits.length === 0) {
          changelogContent += `??? ${admonType} "${tag}${dateStr ? ` \u2014 ${dateStr}` : ""}"
    No commits in this release.

`;
          continue;
        }
        changelogContent += `??? ${admonType} "${tag}${dateStr ? ` \u2014 ${dateStr}` : ""} (${commits.length} change${commits.length > 1 ? "s" : ""})"
`;
        const grouped = {};
        for (const commit of commits) {
          if (!grouped[commit.type]) grouped[commit.type] = [];
          grouped[commit.type].push(commit);
        }
        for (const [type, label] of Object.entries(typeLabels)) {
          const typeCommits = grouped[type];
          if (!typeCommits || typeCommits.length === 0) continue;
          changelogContent += `    ### ${label}
`;
          for (const commit of typeCommits) {
            const shortHash = commit.hash.slice(0, 7);
            const cleanMsg = commit.message.replace(/^(feat|fix|docs|refactor|test|chore|perf|ci|style|build)(\([^)]*\))?:\s*/, "");
            changelogContent += `    - \`${shortHash}\` ${cleanMsg}${commit.author ? ` *(${commit.author})*` : ""}
`;
          }
          changelogContent += "\n";
        }
      }
    } else {
      const typeLabels = {
        feat: "Features",
        fix: "Bug Fixes",
        docs: "Documentation",
        refactor: "Refactoring",
        test: "Tests",
        chore: "Chores",
        perf: "Performance",
        ci: "CI/CD",
        style: "Style",
        build: "Build",
        other: "Other Changes"
      };
      const grouped = {};
      for (const commit of logResult.all) {
        const type = parseConventionalType(commit.message);
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push({
          hash: commit.hash,
          message: commit.message,
          author: commit.author_name,
          date: commit.date
        });
      }
      for (const [type, label] of Object.entries(typeLabels)) {
        const commits = grouped[type];
        if (!commits || commits.length === 0) continue;
        changelogContent += `## ${label}

`;
        for (const commit of commits.slice(0, 20)) {
          const shortHash = commit.hash.slice(0, 7);
          const cleanMsg = commit.message.replace(/^(feat|fix|docs|refactor|test|chore|perf|ci|style|build)(\([^)]*\))?:\s*/, "");
          const dateStr = commit.date ? new Date(commit.date).toLocaleDateString() : "";
          changelogContent += `- \`${shortHash}\` ${cleanMsg}${dateStr ? ` *(${dateStr})*` : ""}
`;
        }
        changelogContent += "\n";
      }
    }
    try {
      const { readFile: readFs } = await import("fs/promises");
      for (const notesFile of ["CHANGELOG.md", "RELEASE_NOTES.md"]) {
        try {
          const notesPath = import_path14.default.join(repoRoot, notesFile);
          const notesContent = await readFs(notesPath, "utf-8");
          if (notesContent.trim()) {
            changelogContent += `---

## Project Release Notes

`;
            changelogContent += `??? note "From ${notesFile}"
`;
            for (const line of notesContent.split("\n").slice(0, 50)) {
              changelogContent += `    ${line}
`;
            }
            changelogContent += "\n";
            break;
          }
        } catch {
        }
      }
    } catch {
    }
  } catch {
    changelogContent = "*Unable to generate changelog \u2014 not a git repository or git is not available.*\n";
  }
  if (!changelogContent) {
    changelogContent = "*No commits found.*\n";
  }
  const content = `---
title: Changelog
description: Project changelog generated from git history
---

# Changelog

${changelogContent}

---

*Auto-generated from git history by DocWalk. Updates on each sync.*
`;
  return {
    path: "changelog.md",
    title: "Changelog",
    content,
    navGroup: "",
    navOrder: 99,
    audience: "developer"
  };
}
var import_path14, import_simple_git;
var init_changelog = __esm({
  "src/generators/pages/changelog.ts"() {
    "use strict";
    import_path14 = __toESM(require("path"), 1);
    import_simple_git = __toESM(require("simple-git"), 1);
    init_utils2();
    init_utils();
  }
});

// src/generators/pages/insights.ts
function generateInsightsPage(insights, config) {
  const byCategory = /* @__PURE__ */ new Map();
  const bySeverity = { info: 0, warning: 0, critical: 0 };
  for (const insight of insights) {
    if (!byCategory.has(insight.category)) byCategory.set(insight.category, []);
    byCategory.get(insight.category).push(insight);
    bySeverity[insight.severity]++;
  }
  const categoryLabels = {
    documentation: "Documentation",
    architecture: "Architecture",
    "code-quality": "Code Quality",
    security: "Security",
    performance: "Performance"
  };
  const severityAdmonition = {
    critical: "danger",
    warning: "warning",
    info: "info"
  };
  let categorySections = "";
  for (const [category, catInsights] of byCategory) {
    categorySections += `## ${categoryLabels[category] || category}

`;
    for (const insight of catInsights) {
      const admonType = severityAdmonition[insight.severity] || "info";
      categorySections += `!!! ${admonType} "${insight.title}"
`;
      categorySections += `    ${insight.description}

`;
      if (insight.affectedFiles.length > 0) {
        categorySections += `    **Affected files:** ${insight.affectedFiles.map((f) => `\`${f}\``).join(", ")}

`;
      }
      categorySections += `    **Suggestion:** ${insight.suggestion}

`;
      if (insight.aiSuggestion) {
        categorySections += `    ??? tip "AI Analysis"
`;
        const indented = insight.aiSuggestion.split("\n").map((line) => `        ${line}`).join("\n");
        categorySections += `${indented}

`;
      }
    }
  }
  const hasAiInsights = config.analysis.insights_ai || insights.some((i) => i.aiSuggestion);
  const content = `---
title: Code Insights
description: Automated code quality analysis and improvement suggestions
---

# Code Insights

Automated analysis findings and improvement suggestions.

## Summary

| Severity | Count |
|----------|:-----:|
| :material-alert-circle: Critical | **${bySeverity.critical}** |
| :material-alert: Warning | **${bySeverity.warning}** |
| :material-information: Info | **${bySeverity.info}** |
| **Total** | **${insights.length}** |

---

${categorySections}
${!hasAiInsights ? `---

!!! tip "Unlock AI-Powered Insights"
    Get AI-powered architecture review, security scanning, and API design suggestions with DocWalk Pro.
` : ""}
---

*Generated by DocWalk from static analysis*
`;
  return {
    path: "insights.md",
    title: "Code Insights",
    content,
    navGroup: "",
    navOrder: 7,
    audience: "developer"
  };
}
var init_insights2 = __esm({
  "src/generators/pages/insights.ts"() {
    "use strict";
  }
});

// src/generators/user-content-extractor.ts
function extractUserContent(manifest) {
  const signals = {
    cliCommands: [],
    routes: [],
    configOptions: [],
    errorTypes: [],
    components: []
  };
  for (const mod of manifest.modules) {
    if (isCLIModule(mod)) {
      signals.cliCommands.push(...extractCLICommands(mod));
    }
    if (isRouteModule(mod)) {
      signals.routes.push(...extractRoutes(mod));
    }
    if (isConfigModule(mod)) {
      signals.configOptions.push(...extractConfigOptions(mod));
    }
    signals.errorTypes.push(...extractErrorTypes(mod));
    if (isComponentModule(mod)) {
      signals.components.push(...extractComponents(mod));
    }
    if (mod.filePath.toLowerCase().includes("readme")) {
      signals.readmeContent = mod.moduleDoc?.summary || mod.moduleDoc?.description;
    }
  }
  return signals;
}
function isCLIModule(mod) {
  const pathLower = mod.filePath.toLowerCase();
  return pathLower.includes("cli/") || pathLower.includes("commands/") || pathLower.includes("bin/") || pathLower.includes("cmd/");
}
function isRouteModule(mod) {
  const pathLower = mod.filePath.toLowerCase();
  return pathLower.includes("routes/") || pathLower.includes("controllers/") || pathLower.includes("handlers/") || pathLower.includes("endpoints/");
}
function isConfigModule(mod) {
  const pathLower = mod.filePath.toLowerCase();
  return pathLower.includes("config") || pathLower.includes("schema") || pathLower.includes("settings");
}
function isComponentModule(mod) {
  const pathLower = mod.filePath.toLowerCase();
  return pathLower.includes("components/") || pathLower.includes("views/") || pathLower.includes("widgets/") || mod.filePath.endsWith(".tsx") || mod.filePath.endsWith(".jsx") || mod.filePath.endsWith(".vue") || mod.filePath.endsWith(".svelte");
}
function extractCLICommands(mod) {
  const commands = [];
  for (const sym of mod.symbols) {
    if (sym.exported && (sym.kind === "function" || sym.kind === "variable" || sym.kind === "constant")) {
      if (sym.name.toLowerCase().includes("command") || sym.name.toLowerCase().includes("cmd") || sym.docs?.summary?.toLowerCase().includes("command")) {
        commands.push({
          name: sym.name.replace(/(?:command|cmd)$/i, "").replace(/^register/i, ""),
          description: sym.docs?.summary,
          filePath: mod.filePath,
          options: sym.parameters?.map((p) => p.name)
        });
      }
    }
  }
  if (commands.length === 0) {
    const exported = mod.symbols.filter((s) => s.exported && s.kind === "function");
    for (const sym of exported) {
      commands.push({
        name: sym.name,
        description: sym.docs?.summary,
        filePath: mod.filePath,
        options: sym.parameters?.map((p) => p.name)
      });
    }
  }
  return commands;
}
function extractRoutes(mod) {
  const routes = [];
  for (const sym of mod.symbols) {
    const methods = ["get", "post", "put", "delete", "patch"];
    const nameLower = sym.name.toLowerCase();
    for (const method of methods) {
      if (nameLower.startsWith(method) || sym.decorators?.some((d) => d.toLowerCase().includes(method))) {
        routes.push({
          method: method.toUpperCase(),
          path: `/${sym.name.replace(/^(get|post|put|delete|patch)/i, "").replace(/^[A-Z]/, (c) => c.toLowerCase()).replace(/([A-Z])/g, "/$1").toLowerCase()}`,
          description: sym.docs?.summary,
          filePath: mod.filePath
        });
        break;
      }
    }
  }
  return routes;
}
function extractConfigOptions(mod) {
  const options = [];
  for (const sym of mod.symbols) {
    if (sym.exported && (sym.kind === "interface" || sym.kind === "type" || sym.kind === "constant")) {
      const children = mod.symbols.filter((s) => s.parentId === sym.id);
      for (const child of children) {
        options.push({
          name: `${sym.name}.${child.name}`,
          type: child.typeAnnotation,
          description: child.docs?.summary,
          defaultValue: child.parameters?.[0]?.defaultValue,
          filePath: mod.filePath
        });
      }
      if (children.length === 0 && sym.name.toLowerCase().includes("schema")) {
        options.push({
          name: sym.name,
          type: sym.typeAnnotation,
          description: sym.docs?.summary,
          filePath: mod.filePath
        });
      }
    }
  }
  return options;
}
function extractErrorTypes(mod) {
  const errors = [];
  for (const sym of mod.symbols) {
    if (sym.kind === "class" && (sym.extends === "Error" || sym.extends?.endsWith("Error") || sym.name.endsWith("Error") || sym.name.endsWith("Exception"))) {
      errors.push({
        name: sym.name,
        description: sym.docs?.summary,
        filePath: mod.filePath,
        extends: sym.extends
      });
    }
  }
  return errors;
}
function extractComponents(mod) {
  const components = [];
  for (const sym of mod.symbols) {
    if (sym.exported && (sym.kind === "component" || sym.kind === "function" || sym.kind === "class") && // Heuristic: PascalCase names in component directories are likely components
    /^[A-Z]/.test(sym.name)) {
      components.push({
        name: sym.name,
        description: sym.docs?.summary,
        filePath: mod.filePath,
        props: sym.parameters?.map((p) => p.name)
      });
    }
  }
  return components;
}
var init_user_content_extractor = __esm({
  "src/generators/user-content-extractor.ts"() {
    "use strict";
  }
});

// src/generators/pages/user-guide.ts
function generateUserGuidePage(manifest, config) {
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const sectionTitle = config.analysis.user_docs_config?.section_title || "User Guide";
  let content = `---
title: ${projectName} \u2014 ${sectionTitle}
description: User guide for ${projectName}
---

# ${projectName}

`;
  if (signals.readmeContent) {
    content += `${signals.readmeContent}

---

`;
  } else if (manifest.projectMeta.description) {
    content += `${manifest.projectMeta.description}

---

`;
  } else if (manifest.projectMeta.readmeDescription) {
    content += `${manifest.projectMeta.readmeDescription}

---

`;
  }
  content += `## What You Can Do

`;
  if (signals.cliCommands.length > 0) {
    content += `### Commands

`;
    content += `${projectName} provides the following commands:

`;
    for (const cmd of signals.cliCommands) {
      content += `- **${cmd.name}**${cmd.description ? ` \u2014 ${cmd.description}` : ""}
`;
    }
    content += "\n";
  }
  if (signals.routes.length > 0) {
    content += `### API Endpoints

`;
    content += `| Method | Path | Description |
`;
    content += `|--------|------|-------------|
`;
    for (const route of signals.routes) {
      content += `| \`${route.method}\` | \`${route.path}\` | ${route.description || ""} |
`;
    }
    content += "\n";
  }
  if (signals.components.length > 0) {
    content += `### Components

`;
    for (const comp of signals.components.slice(0, 15)) {
      content += `- **${comp.name}**${comp.description ? ` \u2014 ${comp.description}` : ""}
`;
    }
    content += "\n";
  }
  if (signals.cliCommands.length === 0 && signals.routes.length === 0 && signals.components.length === 0) {
    content += `${projectName} is a ${manifest.projectMeta.languages[0]?.name || "software"} project with ${manifest.stats.totalFiles} source files.

`;
  }
  content += `---

`;
  content += `## Quick Links

`;
  content += `- [Getting Started](user-getting-started.md) \u2014 Install and set up ${projectName}
`;
  content += `- [Features](features.md) \u2014 Detailed feature documentation
`;
  content += `- [Troubleshooting](troubleshooting.md) \u2014 Common issues and solutions
`;
  content += `- [FAQ](faq.md) \u2014 Frequently asked questions
`;
  content += `
---

*Generated by [DocWalk](https://docwalk.dev)*
`;
  return {
    path: "user-guide.md",
    title: "Overview",
    content,
    navGroup: sectionTitle,
    navOrder: 0,
    audience: "user"
  };
}
async function generateUserGuidePageNarrative(manifest, config, provider) {
  const basePage = generateUserGuidePage(manifest, config);
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const signalsSummary = [
    signals.cliCommands.length > 0 ? `CLI commands: ${signals.cliCommands.map((c) => c.name).join(", ")}` : "",
    signals.routes.length > 0 ? `API routes: ${signals.routes.length}` : "",
    signals.components.length > 0 ? `Components: ${signals.components.map((c) => c.name).slice(0, 10).join(", ")}` : "",
    signals.configOptions.length > 0 ? `Config options: ${signals.configOptions.length}` : ""
  ].filter(Boolean).join("\n");
  const prompt = `Write a user-friendly overview page for "${projectName}". This is documentation for END USERS, not developers.

PROJECT SIGNALS:
${signalsSummary}
${signals.readmeContent ? `README: ${signals.readmeContent}` : ""}
Languages: ${manifest.projectMeta.languages.map((l) => l.name).join(", ")}

INSTRUCTIONS:
1. Explain what this software does in plain language
2. Who is it for? What problems does it solve?
3. List the main capabilities/features
4. Keep it friendly and accessible \u2014 avoid jargon
5. Write 3-5 paragraphs in Markdown format`;
  try {
    const prose = await provider.generate(prompt, {
      maxTokens: 1024,
      temperature: 0.4,
      systemPrompt: "You write clear, friendly documentation for end users. Avoid developer jargon."
    });
    const sectionTitle = config.analysis.user_docs_config?.section_title || "User Guide";
    const content = `---
title: ${projectName} \u2014 ${sectionTitle}
description: User guide for ${projectName}
---

# ${projectName}

${prose}

---

## Quick Links

- [Getting Started](user-getting-started.md) \u2014 Install and set up ${projectName}
- [Features](features.md) \u2014 Detailed feature documentation
- [Troubleshooting](troubleshooting.md) \u2014 Common issues and solutions
- [FAQ](faq.md) \u2014 Frequently asked questions

---

*Generated by [DocWalk](https://docwalk.dev)*
`;
    return { ...basePage, content };
  } catch {
    return basePage;
  }
}
var init_user_guide = __esm({
  "src/generators/pages/user-guide.ts"() {
    "use strict";
    init_utils();
    init_user_content_extractor();
  }
});

// src/generators/pages/user-getting-started.ts
function generateUserGettingStartedPage(manifest, config) {
  const projectName = resolveProjectName(manifest);
  const pkgManager = detectPackageManager(manifest.modules);
  const installCmd = getInstallCommand(pkgManager);
  const signals = extractUserContent(manifest);
  const sectionTitle = config.analysis.user_docs_config?.section_title || "User Guide";
  let content = `---
title: Getting Started with ${projectName}
description: Installation and first-use guide for ${projectName}
---

# Getting Started

This guide will help you install and start using **${projectName}**.

---

## Installation

\`\`\`bash
${installCmd}
\`\`\`

`;
  if (signals.cliCommands.length > 0) {
    content += `---

## Quick Start

`;
    content += `After installation, you can use the following commands:

`;
    for (const cmd of signals.cliCommands.slice(0, 5)) {
      content += `### ${cmd.name}

`;
      if (cmd.description) {
        content += `${cmd.description}

`;
      }
      if (cmd.options && cmd.options.length > 0) {
        content += `Options: ${cmd.options.map((o) => `\`${o}\``).join(", ")}

`;
      }
    }
  }
  if (signals.routes.length > 0) {
    content += `---

## API Quick Start

`;
    content += `${projectName} exposes the following endpoints:

`;
    for (const route of signals.routes.slice(0, 5)) {
      content += `- \`${route.method} ${route.path}\`${route.description ? ` \u2014 ${route.description}` : ""}
`;
    }
    content += "\n";
  }
  if (signals.configOptions.length > 0) {
    content += `---

## Configuration

`;
    content += `Key configuration options:

`;
    content += `| Option | Type | Description |
`;
    content += `|--------|------|-------------|
`;
    for (const opt of signals.configOptions.slice(0, 10)) {
      content += `| \`${opt.name}\` | ${opt.type || "\u2014"} | ${opt.description || ""} |
`;
    }
    content += "\n";
  }
  content += `---

## Next Steps

`;
  content += `- [Features](features.md) \u2014 Explore all features in detail
`;
  content += `- [Troubleshooting](troubleshooting.md) \u2014 Solutions to common problems
`;
  content += `- [FAQ](faq.md) \u2014 Frequently asked questions
`;
  content += `
---

*Generated by [DocWalk](https://docwalk.dev)*
`;
  return {
    path: "user-getting-started.md",
    title: "Getting Started",
    content,
    navGroup: sectionTitle,
    navOrder: 1,
    audience: "user"
  };
}
async function generateUserGettingStartedPageNarrative(manifest, config, provider) {
  const basePage = generateUserGettingStartedPage(manifest, config);
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const prompt = `Write a getting-started tutorial for end users of "${projectName}".

AVAILABLE COMMANDS: ${signals.cliCommands.map((c) => c.name).join(", ") || "none detected"}
AVAILABLE ROUTES: ${signals.routes.map((r) => `${r.method} ${r.path}`).join(", ") || "none detected"}
CONFIG OPTIONS: ${signals.configOptions.length}
PACKAGE MANAGER: ${manifest.projectMeta.packageManager || "unknown"}

INSTRUCTIONS:
1. Write step-by-step installation instructions
2. Show a practical "first use" walkthrough
3. Include code blocks for commands the user should run
4. Write for someone who has never used this software before
5. Be friendly and encouraging
6. Write in Markdown with proper headings`;
  try {
    const prose = await provider.generate(prompt, {
      maxTokens: 1536,
      temperature: 0.3,
      systemPrompt: "You write clear, step-by-step tutorials for end users. Use simple language."
    });
    const sectionTitle = config.analysis.user_docs_config?.section_title || "User Guide";
    return {
      ...basePage,
      content: `---
title: Getting Started with ${projectName}
description: Installation and first-use guide for ${projectName}
---

# Getting Started

${prose}

---

## Next Steps

- [Features](features.md) \u2014 Explore all features in detail
- [Troubleshooting](troubleshooting.md) \u2014 Solutions to common problems
- [FAQ](faq.md) \u2014 Frequently asked questions

---

*Generated by [DocWalk](https://docwalk.dev)*
`
    };
  } catch {
    return basePage;
  }
}
var init_user_getting_started = __esm({
  "src/generators/pages/user-getting-started.ts"() {
    "use strict";
    init_utils();
    init_user_content_extractor();
  }
});

// src/generators/pages/features.ts
function generateFeaturesPage(manifest, config) {
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const sectionTitle = config.analysis.user_docs_config?.section_title || "User Guide";
  let content = `---
title: Features
description: Feature documentation for ${projectName}
---

# Features

A comprehensive guide to everything ${projectName} can do.

`;
  if (signals.cliCommands.length > 0) {
    content += `---

## Commands

`;
    for (const cmd of signals.cliCommands) {
      content += `### ${cmd.name}

`;
      content += `${cmd.description || `The \`${cmd.name}\` command.`}

`;
      if (cmd.options && cmd.options.length > 0) {
        content += `**Options:**

`;
        for (const opt of cmd.options) {
          content += `- \`${opt}\`
`;
        }
        content += "\n";
      }
    }
  }
  if (signals.routes.length > 0) {
    content += `---

## API Endpoints

`;
    for (const route of signals.routes) {
      content += `### \`${route.method} ${route.path}\`

`;
      content += `${route.description || "Handles requests."}

`;
    }
  }
  if (signals.components.length > 0) {
    content += `---

## Components

`;
    for (const comp of signals.components.slice(0, 20)) {
      content += `### ${comp.name}

`;
      content += `${comp.description || `The ${comp.name} component.`}

`;
      if (comp.props && comp.props.length > 0) {
        content += `**Props:** ${comp.props.map((p) => `\`${p}\``).join(", ")}

`;
      }
    }
  }
  if (signals.configOptions.length > 0) {
    content += `---

## Configuration Options

`;
    content += `| Option | Type | Default | Description |
`;
    content += `|--------|------|---------|-------------|
`;
    for (const opt of signals.configOptions.slice(0, 30)) {
      content += `| \`${opt.name}\` | ${opt.type || "\u2014"} | ${opt.defaultValue || "\u2014"} | ${opt.description || ""} |
`;
    }
    content += "\n";
  }
  if (signals.cliCommands.length === 0 && signals.routes.length === 0 && signals.components.length === 0 && signals.configOptions.length === 0) {
    content += `For detailed information about ${projectName}'s features, see the [Developer Reference](getting-started.md).

`;
  }
  content += `---

*Generated by [DocWalk](https://docwalk.dev)*
`;
  return {
    path: "features.md",
    title: "Features",
    content,
    navGroup: sectionTitle,
    navOrder: 2,
    audience: "user"
  };
}
async function generateFeaturesPageNarrative(manifest, config, provider) {
  const basePage = generateFeaturesPage(manifest, config);
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const featureList = [
    ...signals.cliCommands.map((c) => `Command: ${c.name} \u2014 ${c.description || ""}`),
    ...signals.routes.map((r) => `API: ${r.method} ${r.path} \u2014 ${r.description || ""}`),
    ...signals.components.slice(0, 10).map((c) => `Component: ${c.name} \u2014 ${c.description || ""}`)
  ].join("\n");
  const prompt = `Write feature documentation for "${projectName}" aimed at end users.

DETECTED FEATURES:
${featureList || "No specific features detected \u2014 describe general capabilities based on the project type."}

CONFIG OPTIONS: ${signals.configOptions.length}
LANGUAGES: ${manifest.projectMeta.languages.map((l) => l.name).join(", ")}

INSTRUCTIONS:
1. Write clear, user-friendly descriptions for each feature
2. Include practical examples of when/how to use each feature
3. Group related features together
4. Use simple language \u2014 this is for users, not developers
5. Write in Markdown with proper headings and code blocks where appropriate`;
  try {
    const prose = await provider.generate(prompt, {
      maxTokens: 2048,
      temperature: 0.4,
      systemPrompt: "You write clear feature documentation for end users."
    });
    return {
      ...basePage,
      content: `---
title: Features
description: Feature documentation for ${projectName}
---

# Features

${prose}

---

*Generated by [DocWalk](https://docwalk.dev)*
`
    };
  } catch {
    return basePage;
  }
}
var init_features = __esm({
  "src/generators/pages/features.ts"() {
    "use strict";
    init_utils();
    init_user_content_extractor();
  }
});

// src/generators/pages/troubleshooting.ts
function generateTroubleshootingPage(manifest, config) {
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const sectionTitle = config.analysis.user_docs_config?.section_title || "User Guide";
  let content = `---
title: Troubleshooting
description: Common issues and solutions for ${projectName}
---

# Troubleshooting

Having trouble? Check the common issues below or see the error reference.

`;
  if (signals.errorTypes.length > 0) {
    content += `---

## Error Reference

`;
    for (const err of signals.errorTypes) {
      content += `### ${err.name}

`;
      if (err.description) {
        content += `${err.description}

`;
      }
      if (err.extends && err.extends !== "Error") {
        content += `Extends: \`${err.extends}\`

`;
      }
      content += `Source: \`${err.filePath}\`

`;
    }
  }
  content += `---

## Common Issues

`;
  content += `### Installation Problems

`;
  content += `If you're having trouble installing ${projectName}:

`;
  content += `1. Make sure you have the required runtime installed
`;
  content += `2. Check that your version meets the minimum requirements
`;
  content += `3. Try clearing your package manager cache and reinstalling

`;
  if (signals.configOptions.length > 0) {
    content += `### Configuration Issues

`;
    content += `If ${projectName} isn't behaving as expected:

`;
    content += `1. Check your configuration file for syntax errors
`;
    content += `2. Verify all required options are set
`;
    content += `3. Check environment variables are properly set

`;
  }
  content += `### Getting Help

`;
  if (manifest.projectMeta.repository) {
    content += `- File an issue: [GitHub Issues](https://github.com/${manifest.projectMeta.repository}/issues)
`;
  }
  content += `- Check the [FAQ](faq.md) for answers to common questions

`;
  content += `---

*Generated by [DocWalk](https://docwalk.dev)*
`;
  return {
    path: "troubleshooting.md",
    title: "Troubleshooting",
    content,
    navGroup: sectionTitle,
    navOrder: 3,
    audience: "user"
  };
}
async function generateTroubleshootingPageNarrative(manifest, config, provider) {
  const basePage = generateTroubleshootingPage(manifest, config);
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const errorList = signals.errorTypes.map((e) => `${e.name}${e.description ? `: ${e.description}` : ""}`).join("\n");
  const prompt = `Write a troubleshooting guide for "${projectName}" aimed at end users.

KNOWN ERROR TYPES:
${errorList || "No custom error types detected."}

PROJECT TYPE: ${manifest.projectMeta.projectType || "unknown"}
LANGUAGES: ${manifest.projectMeta.languages.map((l) => l.name).join(", ")}
CLI COMMANDS: ${signals.cliCommands.length}
CONFIG OPTIONS: ${signals.configOptions.length}

INSTRUCTIONS:
1. Create a practical troubleshooting guide with common issues and solutions
2. For each known error type, explain what causes it and how to fix it
3. Include general troubleshooting steps (installation, configuration, runtime)
4. Add a "Getting Help" section
5. Write in a friendly, supportive tone
6. Use Markdown with proper headings, code blocks, and admonitions`;
  try {
    const prose = await provider.generate(prompt, {
      maxTokens: 2048,
      temperature: 0.3,
      systemPrompt: "You write helpful troubleshooting guides for end users. Be empathetic and solution-focused."
    });
    return {
      ...basePage,
      content: `---
title: Troubleshooting
description: Common issues and solutions for ${projectName}
---

# Troubleshooting

${prose}

---

*Generated by [DocWalk](https://docwalk.dev)*
`
    };
  } catch {
    return basePage;
  }
}
var init_troubleshooting = __esm({
  "src/generators/pages/troubleshooting.ts"() {
    "use strict";
    init_utils();
    init_user_content_extractor();
  }
});

// src/generators/pages/faq.ts
function generateFAQPage(manifest, config) {
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const sectionTitle = config.analysis.user_docs_config?.section_title || "User Guide";
  let content = `---
title: FAQ
description: Frequently asked questions about ${projectName}
---

# Frequently Asked Questions

`;
  content += `??? question "What is ${projectName}?"
`;
  content += `    ${manifest.projectMeta.description || manifest.projectMeta.readmeDescription || `${projectName} is a ${manifest.projectMeta.languages[0]?.name || "software"} project.`}

`;
  content += `??? question "What languages/technologies does ${projectName} use?"
`;
  content += `    ${manifest.projectMeta.languages.map((l) => `${l.name} (${l.percentage}%)`).join(", ")}.

`;
  if (signals.cliCommands.length > 0) {
    content += `??? question "What commands are available?"
`;
    content += `    Available commands: ${signals.cliCommands.map((c) => `\`${c.name}\``).join(", ")}. See the [Getting Started](user-getting-started.md) guide for usage details.

`;
  }
  if (signals.configOptions.length > 0) {
    content += `??? question "How do I configure ${projectName}?"
`;
    content += `    ${projectName} has ${signals.configOptions.length} configuration options. See the [Features](features.md) page for details on each option.

`;
  }
  if (signals.routes.length > 0) {
    content += `??? question "What API endpoints are available?"
`;
    content += `    ${projectName} provides ${signals.routes.length} API endpoints. See the [Features](features.md) page for the full API reference.

`;
  }
  if (manifest.projectMeta.repository) {
    content += `??? question "Where can I report bugs or request features?"
`;
    content += `    File an issue on [GitHub](https://github.com/${manifest.projectMeta.repository}/issues).

`;
    content += `??? question "How can I contribute?"
`;
    content += `    Check the [repository](https://github.com/${manifest.projectMeta.repository}) for contribution guidelines.

`;
  }
  content += `??? question "Where can I find the developer documentation?"
`;
  content += `    See the [Developer Reference](getting-started.md) section for architecture, API reference, and source documentation.

`;
  content += `---

*Generated by [DocWalk](https://docwalk.dev)*
`;
  return {
    path: "faq.md",
    title: "FAQ",
    content,
    navGroup: sectionTitle,
    navOrder: 4,
    audience: "user"
  };
}
async function generateFAQPageNarrative(manifest, config, provider) {
  const basePage = generateFAQPage(manifest, config);
  const projectName = resolveProjectName(manifest);
  const signals = extractUserContent(manifest);
  const contextSummary = [
    `Project: ${projectName}`,
    `Languages: ${manifest.projectMeta.languages.map((l) => l.name).join(", ")}`,
    `Files: ${manifest.stats.totalFiles}`,
    signals.cliCommands.length > 0 ? `CLI commands: ${signals.cliCommands.map((c) => c.name).join(", ")}` : "",
    signals.routes.length > 0 ? `API routes: ${signals.routes.length}` : "",
    signals.configOptions.length > 0 ? `Config options: ${signals.configOptions.length}` : "",
    signals.errorTypes.length > 0 ? `Error types: ${signals.errorTypes.map((e) => e.name).join(", ")}` : "",
    signals.readmeContent ? `README: ${signals.readmeContent.slice(0, 500)}` : ""
  ].filter(Boolean).join("\n");
  const prompt = `Generate a comprehensive FAQ page for "${projectName}" aimed at end users.

PROJECT CONTEXT:
${contextSummary}

INSTRUCTIONS:
1. Generate 8-15 frequently asked questions with detailed answers
2. Cover: what it is, installation, basic usage, configuration, troubleshooting, contributing
3. Write clear, helpful answers in plain language
4. Use MkDocs-compatible collapsible FAQ format: ??? question "Question here"
5. Include code examples in answers where helpful
6. Write in Markdown format`;
  try {
    const prose = await provider.generate(prompt, {
      maxTokens: 2048,
      temperature: 0.4,
      systemPrompt: "You write comprehensive FAQ pages for end users. Be thorough and helpful."
    });
    return {
      ...basePage,
      content: `---
title: FAQ
description: Frequently asked questions about ${projectName}
---

# Frequently Asked Questions

${prose}

---

*Generated by [DocWalk](https://docwalk.dev)*
`
    };
  } catch {
    return basePage;
  }
}
var init_faq = __esm({
  "src/generators/pages/faq.ts"() {
    "use strict";
    init_utils();
    init_user_content_extractor();
  }
});

// src/generators/pages/index.ts
var pages_exports = {};
__export(pages_exports, {
  generateArchitecturePage: () => generateArchitecturePage,
  generateArchitecturePageNarrative: () => generateArchitecturePageNarrative,
  generateChangelogPage: () => generateChangelogPage,
  generateConfigurationPage: () => generateConfigurationPage,
  generateDependenciesPage: () => generateDependenciesPage,
  generateFAQPage: () => generateFAQPage,
  generateFAQPageNarrative: () => generateFAQPageNarrative,
  generateFeaturesPage: () => generateFeaturesPage,
  generateFeaturesPageNarrative: () => generateFeaturesPageNarrative,
  generateGettingStartedPage: () => generateGettingStartedPage,
  generateGettingStartedPageNarrative: () => generateGettingStartedPageNarrative,
  generateInsightsPage: () => generateInsightsPage,
  generateModulePage: () => generateModulePage,
  generateModulePageNarrative: () => generateModulePageNarrative,
  generateOverviewPage: () => generateOverviewPage,
  generateOverviewPageNarrative: () => generateOverviewPageNarrative,
  generateSBOMPage: () => generateSBOMPage,
  generateTieredArchitecturePages: () => generateTieredArchitecturePages,
  generateTroubleshootingPage: () => generateTroubleshootingPage,
  generateTroubleshootingPageNarrative: () => generateTroubleshootingPageNarrative,
  generateTypesPage: () => generateTypesPage,
  generateUsageGuidePage: () => generateUsageGuidePage,
  generateUserGettingStartedPage: () => generateUserGettingStartedPage,
  generateUserGettingStartedPageNarrative: () => generateUserGettingStartedPageNarrative,
  generateUserGuidePage: () => generateUserGuidePage,
  generateUserGuidePageNarrative: () => generateUserGuidePageNarrative
});
var init_pages = __esm({
  "src/generators/pages/index.ts"() {
    "use strict";
    init_overview();
    init_getting_started();
    init_architecture();
    init_module();
    init_configuration();
    init_types();
    init_dependencies();
    init_usage_guide();
    init_changelog();
    init_insights2();
    init_user_guide();
    init_user_getting_started();
    init_features();
    init_troubleshooting();
    init_faq();
  }
});

// src/analysis/structure-advisor.ts
var structure_advisor_exports = {};
__export(structure_advisor_exports, {
  analyzeStructure: () => analyzeStructure
});
async function analyzeStructure(manifest, provider) {
  if (!provider) {
    return { conceptPages: [], audienceSplit: false, navGroups: [] };
  }
  const modulesBySection = {};
  for (const mod of manifest.modules) {
    const section = detectLogicalSection(mod.filePath);
    if (!modulesBySection[section]) modulesBySection[section] = [];
    modulesBySection[section].push(mod.filePath);
  }
  const sectionSummary = Object.entries(modulesBySection).map(([section, files]) => `${section}: ${files.length} files (${files.slice(0, 3).join(", ")}${files.length > 3 ? `, +${files.length - 3} more` : ""})`).join("\n");
  const { dependencyGraph } = manifest;
  const clusters = /* @__PURE__ */ new Map();
  for (const node of dependencyGraph.nodes) {
    const parts = node.split("/");
    const dir = parts.length > 2 ? parts.slice(0, 2).join("/") : parts[0];
    clusters.set(dir, (clusters.get(dir) || 0) + 1);
  }
  const clusterSummary = [...clusters.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([dir, count]) => `${dir}: ${count} files`).join("\n");
  const prompt = `Analyze this codebase and suggest additional conceptual documentation pages beyond the standard set (Overview, Getting Started, Architecture, API Reference).

PROJECT: ${manifest.projectMeta.name}
LANGUAGES: ${manifest.projectMeta.languages.map((l) => `${l.name} (${l.percentage}%)`).join(", ")}
TOTAL FILES: ${manifest.stats.totalFiles}
TOTAL SYMBOLS: ${manifest.stats.totalSymbols}

LOGICAL SECTIONS:
${sectionSummary}

DEPENDENCY CLUSTERS:
${clusterSummary}

Return a JSON array of page suggestions. Each item should have:
- "id": lowercase-kebab-case identifier
- "title": human-readable page title
- "description": what this page should cover (1 sentence)
- "navGroup": which navigation group this belongs to
- "relatedModules": array of file paths this page relates to (max 10)

Suggest 2-6 conceptual pages based on patterns you see (e.g., "Authentication Flow", "Data Pipeline", "Event System", "Plugin Architecture"). Only suggest pages where there's enough code to warrant a dedicated page.

Return ONLY valid JSON, no explanation.`;
  try {
    const response = await provider.generate(prompt, {
      maxTokens: 1024,
      temperature: 0.2,
      systemPrompt: "You are a documentation architect. Return only valid JSON."
    });
    const cleaned = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const suggestions = JSON.parse(cleaned);
    const conceptPages = suggestions.map((s, i) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      navGroup: s.navGroup || "Concepts",
      navOrder: 20 + i,
      relatedModules: s.relatedModules || []
    }));
    return {
      conceptPages,
      audienceSplit: manifest.modules.some(
        (m) => m.filePath.includes("cli/") || m.filePath.includes("commands/")
      ),
      navGroups: [...new Set(conceptPages.map((p) => p.navGroup))]
    };
  } catch {
    return { conceptPages: [], audienceSplit: false, navGroups: [] };
  }
}
var init_structure_advisor = __esm({
  "src/analysis/structure-advisor.ts"() {
    "use strict";
    init_utils();
  }
});

// src/generators/pages/concept.ts
var concept_exports = {};
__export(concept_exports, {
  generateConceptPage: () => generateConceptPage
});
async function generateConceptPage(suggestion, manifest, provider, readFile7, repoUrl, branch) {
  const targetModule = suggestion.relatedModules.length > 0 ? manifest.modules.find((m) => m.filePath === suggestion.relatedModules[0]) : void 0;
  const contextChunks = await buildContext({
    targetModule,
    topic: suggestion.title,
    tokenBudget: 6e3,
    manifest,
    readFile: readFile7
  });
  const contextText = contextChunks.map((c) => `--- ${c.filePath} ---
${c.content}`).join("\n\n");
  const prompt = `Write a documentation page about "${suggestion.title}" for the ${manifest.projectMeta.name} project.

DESCRIPTION: ${suggestion.description}

RELATED FILES: ${suggestion.relatedModules.join(", ")}

SOURCE CODE CONTEXT:
${contextText}

INSTRUCTIONS:
1. Write a comprehensive page explaining this concept/feature
2. Reference specific code using [file:line] notation
3. Include code examples where helpful
4. Explain how this fits into the overall architecture
5. Write 4-8 paragraphs in Markdown format with proper headings`;
  try {
    let prose = await provider.generate(prompt, {
      maxTokens: 2048,
      temperature: 0.3,
      systemPrompt: "You are a technical documentation writer. Be thorough and reference specific code."
    });
    const citationRegex = /\[([^\]]+?):(\d+)\]/g;
    const citations = [];
    let match;
    while ((match = citationRegex.exec(prose)) !== null) {
      citations.push({ text: match[0], filePath: match[1], line: parseInt(match[2], 10) });
    }
    prose = renderCitations(prose, citations, repoUrl, branch);
    const content = `---
title: "${suggestion.title}"
description: "${suggestion.description}"
---

# ${suggestion.title}

${prose}

---

*Generated by [DocWalk](https://docwalk.dev)*
`;
    return {
      path: `concepts/${suggestion.id}.md`,
      title: suggestion.title,
      content,
      navGroup: suggestion.navGroup,
      navOrder: suggestion.navOrder,
      audience: "developer"
    };
  } catch {
    return {
      path: `concepts/${suggestion.id}.md`,
      title: suggestion.title,
      content: `---
title: "${suggestion.title}"
---

# ${suggestion.title}

${suggestion.description}

Related files: ${suggestion.relatedModules.map((f) => `\`${f}\``).join(", ")}

---

*Generated by [DocWalk](https://docwalk.dev)*
`,
      navGroup: suggestion.navGroup,
      navOrder: suggestion.navOrder,
      audience: "developer"
    };
  }
}
var init_concept = __esm({
  "src/generators/pages/concept.ts"() {
    "use strict";
    init_context_builder();
    init_narrative_engine();
  }
});

// src/qa/chunker.ts
function chunkPage(pagePath, pageTitle, content) {
  const chunks = [];
  let chunkIndex = 0;
  const stripped = content.replace(/^---[\s\S]*?---\n*/m, "");
  const sections = splitByHeadings(stripped);
  for (const section of sections) {
    const heading = section.heading;
    const sectionContent = section.content.trim();
    if (!sectionContent) continue;
    const tokens = estimateTokens(sectionContent);
    if (tokens <= MAX_CHUNK_TOKENS) {
      if (tokens >= MIN_CHUNK_TOKENS) {
        chunks.push({
          id: `${pagePath}:${chunkIndex++}`,
          pagePath,
          pageTitle,
          heading,
          content: sectionContent,
          tokenCount: tokens
        });
      }
    } else {
      const paragraphs = sectionContent.split(/\n\n+/);
      let currentChunk = "";
      let currentTokens = 0;
      for (const para of paragraphs) {
        const paraTokens = estimateTokens(para);
        if (currentTokens + paraTokens > MAX_CHUNK_TOKENS && currentChunk) {
          chunks.push({
            id: `${pagePath}:${chunkIndex++}`,
            pagePath,
            pageTitle,
            heading,
            content: currentChunk.trim(),
            tokenCount: currentTokens
          });
          currentChunk = "";
          currentTokens = 0;
        }
        currentChunk += para + "\n\n";
        currentTokens += paraTokens;
        if (currentTokens >= TARGET_CHUNK_TOKENS) {
          chunks.push({
            id: `${pagePath}:${chunkIndex++}`,
            pagePath,
            pageTitle,
            heading,
            content: currentChunk.trim(),
            tokenCount: currentTokens
          });
          currentChunk = "";
          currentTokens = 0;
        }
      }
      if (currentChunk.trim() && currentTokens >= MIN_CHUNK_TOKENS) {
        chunks.push({
          id: `${pagePath}:${chunkIndex++}`,
          pagePath,
          pageTitle,
          heading,
          content: currentChunk.trim(),
          tokenCount: currentTokens
        });
      }
    }
  }
  return chunks;
}
function splitByHeadings(markdown) {
  const sections = [];
  const lines = markdown.split("\n");
  let currentHeading;
  let currentContent = [];
  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      if (currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n")
        });
      }
      currentHeading = headingMatch[2];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join("\n")
    });
  }
  return sections;
}
function chunkPages(pages) {
  const allChunks = [];
  for (const page of pages) {
    allChunks.push(...chunkPage(page.path, page.title, page.content));
  }
  return allChunks;
}
var MIN_CHUNK_TOKENS, TARGET_CHUNK_TOKENS, MAX_CHUNK_TOKENS;
var init_chunker = __esm({
  "src/qa/chunker.ts"() {
    "use strict";
    init_utils();
    MIN_CHUNK_TOKENS = 50;
    TARGET_CHUNK_TOKENS = 300;
    MAX_CHUNK_TOKENS = 500;
  }
});

// src/qa/embedder.ts
async function generateEmbeddings(texts, options) {
  switch (options.provider) {
    case "openai":
      return generateOpenAIEmbeddings(texts, options);
    case "gemini":
      return generateGeminiEmbeddings(texts, options);
    case "ollama":
    case "local":
      return generateOllamaEmbeddings(texts, options);
    case "anthropic":
      return generateSimpleEmbeddings(texts);
    default:
      return generateSimpleEmbeddings(texts);
  }
}
async function generateOpenAIEmbeddings(texts, options) {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: options.apiKey });
  const model = options.model || "text-embedding-3-small";
  const results = [];
  const batchSize = 100;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await client.embeddings.create({
      model,
      input: batch.map((t) => t.content)
    });
    for (let j = 0; j < batch.length; j++) {
      results.push({
        chunkId: batch[j].id,
        vector: response.data[j].embedding
      });
    }
  }
  return results;
}
async function generateGeminiEmbeddings(texts, options) {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(options.apiKey);
  const model = genAI.getGenerativeModel({ model: options.model || "text-embedding-004" });
  const results = [];
  for (const text of texts) {
    try {
      const result = await model.embedContent(text.content);
      results.push({
        chunkId: text.id,
        vector: result.embedding.values
      });
    } catch {
    }
  }
  return results;
}
async function generateOllamaEmbeddings(texts, options) {
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({
      baseURL: options.base_url || "http://localhost:11434/v1",
      apiKey: "ollama"
    });
    const model = options.model || "nomic-embed-text";
    const results = [];
    const batchSize = 100;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      try {
        const response = await client.embeddings.create({
          model,
          input: batch.map((t) => t.content)
        });
        for (let j = 0; j < batch.length; j++) {
          results.push({
            chunkId: batch[j].id,
            vector: response.data[j].embedding
          });
        }
      } catch {
        const fallback = await generateSimpleEmbeddings(batch);
        results.push(...fallback);
      }
    }
    return results;
  } catch {
    return generateSimpleEmbeddings(texts);
  }
}
function generateSimpleEmbeddings(texts) {
  const VOCAB_SIZE = 256;
  const results = texts.map((text) => {
    const words = text.content.toLowerCase().split(/\W+/).filter(Boolean);
    const vector = new Array(VOCAB_SIZE).fill(0);
    for (const word of words) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash << 5) - hash + word.charCodeAt(i) & 4294967295;
      }
      const bucket = Math.abs(hash) % VOCAB_SIZE;
      vector[bucket] += 1;
    }
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }
    return { chunkId: text.id, vector };
  });
  return Promise.resolve(results);
}
var init_embedder = __esm({
  "src/qa/embedder.ts"() {
    "use strict";
  }
});

// src/qa/vector-store.ts
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}
var VectorStore;
var init_vector_store = __esm({
  "src/qa/vector-store.ts"() {
    "use strict";
    init_utils();
    VectorStore = class _VectorStore {
      entries = [];
      /**
       * Add chunks with their embeddings to the store.
       */
      addEntries(chunks, embeddings) {
        const embeddingMap = new Map(embeddings.map((e) => [e.chunkId, e.vector]));
        for (const chunk of chunks) {
          const vector = embeddingMap.get(chunk.id);
          if (vector) {
            this.entries.push({ chunkId: chunk.id, vector, chunk });
          }
        }
      }
      /**
       * Search for the top-k most similar chunks to the query vector.
       */
      search(queryVector, topK = 5) {
        const scored = this.entries.map((entry) => ({
          chunk: entry.chunk,
          score: cosineSimilarity(queryVector, entry.vector)
        }));
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK);
      }
      /**
       * Serialize the index for persistence (written to qa-index.json).
       */
      serialize() {
        return {
          version: 1,
          entries: this.entries.map((e) => ({
            chunkId: e.chunkId,
            vector: e.vector,
            pagePath: e.chunk.pagePath,
            pageTitle: e.chunk.pageTitle,
            heading: e.chunk.heading,
            content: e.chunk.content
          }))
        };
      }
      /**
       * Deserialize an index from JSON.
       */
      static deserialize(data) {
        const store = new _VectorStore();
        store.entries = data.entries.map((e) => ({
          chunkId: e.chunkId,
          vector: e.vector,
          chunk: {
            id: e.chunkId,
            pagePath: e.pagePath,
            pageTitle: e.pageTitle,
            heading: e.heading,
            content: e.content,
            tokenCount: estimateTokens(e.content)
          }
        }));
        return store;
      }
      get size() {
        return this.entries.length;
      }
    };
  }
});

// src/qa/index.ts
var qa_exports = {};
__export(qa_exports, {
  VectorStore: () => VectorStore,
  buildQAIndex: () => buildQAIndex,
  chunkPages: () => chunkPages,
  generateEmbeddings: () => generateEmbeddings
});
async function buildQAIndex(options) {
  const { pages, embedder, onProgress } = options;
  onProgress?.("Chunking pages for Q&A index...");
  const chunks = chunkPages(
    pages.map((p) => ({ path: p.path, title: p.title, content: p.content }))
  );
  onProgress?.(`Created ${chunks.length} chunks from ${pages.length} pages`);
  onProgress?.("Generating embeddings...");
  const textsForEmbedding = chunks.map((c) => ({
    id: c.id,
    content: c.heading ? `${c.heading}: ${c.content}` : c.content
  }));
  const embeddings = await generateEmbeddings(textsForEmbedding, embedder);
  onProgress?.(`Generated ${embeddings.length} embeddings`);
  const store = new VectorStore();
  store.addEntries(chunks, embeddings);
  return {
    serialized: store.serialize(),
    chunkCount: chunks.length,
    pageCount: pages.length
  };
}
var init_qa = __esm({
  "src/qa/index.ts"() {
    "use strict";
    init_chunker();
    init_embedder();
    init_vector_store();
    init_chunker();
    init_embedder();
    init_vector_store();
  }
});

// src/generators/qa-widget/widget.ts
function generateWidgetJS(config) {
  return `
(function() {
  'use strict';

  var ENDPOINT = ${JSON.stringify(config.apiEndpoint)};
  var POSITION = ${JSON.stringify(config.position)};
  var GREETING = ${JSON.stringify(config.greeting)};
  var DAILY_LIMIT = ${config.dailyLimit};
  var STORAGE_KEY = 'docwalk-qa-count';

  function getQuestionsToday() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return 0;
      var data = JSON.parse(stored);
      var today = new Date().toISOString().slice(0, 10);
      return data.date === today ? data.count : 0;
    } catch(e) { return 0; }
  }

  function incrementQuestions() {
    var today = new Date().toISOString().slice(0, 10);
    var count = getQuestionsToday() + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, count: count }));
    return count;
  }

  function createWidget() {
    var container = document.createElement('div');
    container.id = 'docwalk-qa-widget';
    container.innerHTML = \`
      <button id="dw-qa-toggle" aria-label="Ask a question">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
      <div id="dw-qa-panel" style="display:none">
        <div id="dw-qa-header">
          <span>Ask about this project</span>
          <button id="dw-qa-close" aria-label="Close">&times;</button>
        </div>
        <div id="dw-qa-messages">
          <div class="dw-qa-msg dw-qa-bot">\${GREETING}</div>
        </div>
        <div id="dw-qa-input-area">
          <input id="dw-qa-input" type="text" placeholder="Type your question..." />
          <button id="dw-qa-send" aria-label="Send">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    \`;

    document.body.appendChild(container);

    var toggle = document.getElementById('dw-qa-toggle');
    var panel = document.getElementById('dw-qa-panel');
    var close = document.getElementById('dw-qa-close');
    var input = document.getElementById('dw-qa-input');
    var send = document.getElementById('dw-qa-send');
    var messages = document.getElementById('dw-qa-messages');

    toggle.addEventListener('click', function() {
      panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
      toggle.style.display = panel.style.display === 'none' ? 'flex' : 'none';
      if (panel.style.display !== 'none') input.focus();
    });

    close.addEventListener('click', function() {
      panel.style.display = 'none';
      toggle.style.display = 'flex';
    });

    function addMessage(text, isUser) {
      var div = document.createElement('div');
      div.className = 'dw-qa-msg ' + (isUser ? 'dw-qa-user' : 'dw-qa-bot');
      div.textContent = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }

    function askQuestion() {
      var question = input.value.trim();
      if (!question) return;

      if (getQuestionsToday() >= DAILY_LIMIT) {
        addMessage('Daily question limit reached. Upgrade to Team for unlimited Q&A.', false);
        return;
      }

      addMessage(question, true);
      input.value = '';
      input.disabled = true;
      send.disabled = true;

      addMessage('Thinking...', false);

      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question, page: window.location.pathname })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        messages.removeChild(messages.lastChild); // Remove "Thinking..."
        addMessage(data.answer || 'Sorry, I could not find an answer.', false);
        if (data.citations && data.citations.length > 0) {
          addMessage('Sources: ' + data.citations.join(', '), false);
        }
        incrementQuestions();
      })
      .catch(function() {
        messages.removeChild(messages.lastChild);
        addMessage('Sorry, something went wrong. Please try again.', false);
      })
      .finally(function() {
        input.disabled = false;
        send.disabled = false;
        input.focus();
      });
    }

    send.addEventListener('click', askQuestion);
    input.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') askQuestion();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();
`;
}
var init_widget = __esm({
  "src/generators/qa-widget/widget.ts"() {
    "use strict";
  }
});

// src/generators/qa-widget/inject.ts
var inject_exports = {};
__export(inject_exports, {
  injectQAWidget: () => injectQAWidget
});
async function injectQAWidget(outputDir, config, qaApiEndpoint) {
  const assetsDir = import_path15.default.join(outputDir, "docs", "_docwalk");
  await (0, import_promises4.mkdir)(assetsDir, { recursive: true });
  const widgetJS = generateWidgetJS({
    apiEndpoint: qaApiEndpoint,
    position: config.position || "bottom-right",
    greeting: config.greeting || "Ask me anything about this project.",
    dailyLimit: config.daily_limit || 50
  });
  await (0, import_promises4.writeFile)(import_path15.default.join(assetsDir, "qa-widget.js"), widgetJS);
  let css;
  try {
    const cssPath = import_path15.default.resolve(
      import_path15.default.dirname((0, import_url.fileURLToPath)(import_meta2.url)),
      "widget.css"
    );
    css = await (0, import_promises5.readFile)(cssPath, "utf-8");
  } catch {
    css = `
#docwalk-qa-widget { position: fixed; bottom: 20px; right: 20px; z-index: 9999; }
#dw-qa-toggle { width: 56px; height: 56px; border-radius: 50%; background: #5de4c7; color: #0a0a0c; border: none; cursor: pointer; }
#dw-qa-panel { width: 380px; height: 500px; background: #16161a; border: 1px solid #2a2a32; border-radius: 12px; }
`;
  }
  await (0, import_promises4.writeFile)(import_path15.default.join(assetsDir, "qa-widget.css"), css);
  return {
    extraCss: ["_docwalk/qa-widget.css"],
    extraJs: ["_docwalk/qa-widget.js"]
  };
}
var import_promises4, import_path15, import_promises5, import_url, import_meta2;
var init_inject = __esm({
  "src/generators/qa-widget/inject.ts"() {
    "use strict";
    import_promises4 = require("fs/promises");
    import_path15 = __toESM(require("path"), 1);
    init_widget();
    import_promises5 = require("fs/promises");
    import_url = require("url");
    import_meta2 = {};
  }
});

// src/generators/mkdocs.ts
function safeGenerate(name, fn, onProgress) {
  try {
    return fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onProgress?.(`Warning: ${name} page generation failed: ${message}`);
    return {
      path: `${name.toLowerCase().replace(/\s+/g, "-")}-error.md`,
      title: name,
      content: `---
title: ${name}
---

# ${name}

!!! danger "Generation Error"
    This page could not be generated: ${message}
`,
      navGroup: "",
      navOrder: 99
    };
  }
}
async function safeGenerateAsync(name, fn, onProgress) {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onProgress?.(`Warning: ${name} page generation failed: ${message}`);
    return {
      path: `${name.toLowerCase().replace(/\s+/g, "-")}-error.md`,
      title: name,
      content: `---
title: ${name}
---

# ${name}

!!! danger "Generation Error"
    This page could not be generated: ${message}
`,
      navGroup: "",
      navOrder: 99
    };
  }
}
async function generateDocs(options) {
  const { manifest, config, outputDir, onProgress, hooks, readFile: readFile7, tryMode } = options;
  await executeHooks("pre_build", hooks, { cwd: outputDir });
  const docsDir = import_path16.default.join(outputDir, "docs");
  await (0, import_promises6.mkdir)(docsDir, { recursive: true });
  let aiProvider;
  if (config.analysis.ai_summaries && config.analysis.ai_provider) {
    aiProvider = createProvider(config.analysis.ai_provider);
  }
  const useNarrative = !!(config.analysis.ai_narrative && aiProvider && readFile7);
  let structurePlan;
  if (config.analysis.ai_structure && aiProvider) {
    try {
      onProgress?.("Analyzing codebase structure...");
      const { analyzeStructure: analyzeStructure2 } = await Promise.resolve().then(() => (init_structure_advisor(), structure_advisor_exports));
      structurePlan = await analyzeStructure2(manifest, aiProvider);
    } catch {
    }
  }
  const pages = [];
  if (useNarrative) {
    onProgress?.("Generating narrative pages (overview, getting started, architecture)...");
    const narrativePromises = [];
    narrativePromises.push(
      safeGenerateAsync(
        "Overview",
        () => generateOverviewPageNarrative(manifest, config, aiProvider, readFile7),
        onProgress
      )
    );
    narrativePromises.push(
      safeGenerateAsync(
        "Getting Started",
        () => generateGettingStartedPageNarrative(manifest, config, aiProvider, readFile7),
        onProgress
      )
    );
    if (config.analysis.dependency_graph && config.analysis.architecture_tiers === false) {
      const repoUrl = config.source.repo.includes("/") ? config.source.repo : void 0;
      narrativePromises.push(
        safeGenerateAsync(
          "Architecture",
          () => generateArchitecturePageNarrative(manifest, aiProvider, readFile7, repoUrl, config.source.branch),
          onProgress
        )
      );
    }
    const narrativeResults = await Promise.all(narrativePromises);
    pages.push(...narrativeResults);
    if (config.analysis.dependency_graph && config.analysis.architecture_tiers !== false) {
      const archResult = safeGenerate("Architecture", () => generateTieredArchitecturePages(manifest), onProgress);
      pages.push(...Array.isArray(archResult) ? archResult : [archResult]);
    }
  } else {
    const overviewResult = safeGenerate("Overview", () => generateOverviewPage(manifest, config), onProgress);
    pages.push(...Array.isArray(overviewResult) ? overviewResult : [overviewResult]);
    const gettingStartedResult = safeGenerate("Getting Started", () => generateGettingStartedPage(manifest, config), onProgress);
    pages.push(...Array.isArray(gettingStartedResult) ? gettingStartedResult : [gettingStartedResult]);
    if (config.analysis.dependency_graph) {
      onProgress?.("Generating architecture pages...");
      if (config.analysis.architecture_tiers !== false) {
        const archResult = safeGenerate("Architecture", () => generateTieredArchitecturePages(manifest), onProgress);
        pages.push(...Array.isArray(archResult) ? archResult : [archResult]);
      } else {
        const archResult = safeGenerate("Architecture", () => generateArchitecturePage(manifest), onProgress);
        pages.push(...Array.isArray(archResult) ? archResult : [archResult]);
      }
    }
  }
  const symbolPageMap = buildSymbolPageMap(manifest.modules);
  const modulePageCtx = { config, manifest, symbolPageMap };
  onProgress?.("Generating API reference pages...");
  const modulesByGroup = groupModulesLogically(manifest.modules);
  for (const [group, modules] of Object.entries(modulesByGroup)) {
    for (const mod of modules) {
      pages.push(generateModulePage(mod, group, modulePageCtx));
    }
  }
  if (config.analysis.config_docs) {
    onProgress?.("Generating configuration page...");
    const configResult = safeGenerate("Configuration", () => generateConfigurationPage(manifest, config), onProgress);
    pages.push(...Array.isArray(configResult) ? configResult : [configResult]);
  }
  if (config.analysis.types_page) {
    onProgress?.("Generating types page...");
    const typesResult = safeGenerate("Types", () => generateTypesPage(manifest), onProgress);
    pages.push(...Array.isArray(typesResult) ? typesResult : [typesResult]);
  }
  if (config.analysis.dependencies_page) {
    onProgress?.("Generating dependencies page...");
    if (config.analysis.sbom !== false) {
      const sbomResult = safeGenerate("SBOM", () => generateSBOMPage(manifest, config), onProgress);
      pages.push(...Array.isArray(sbomResult) ? sbomResult : [sbomResult]);
    } else {
      const depsResult = safeGenerate("Dependencies", () => generateDependenciesPage(manifest), onProgress);
      pages.push(...Array.isArray(depsResult) ? depsResult : [depsResult]);
    }
  }
  if (config.analysis.usage_guide_page) {
    onProgress?.("Generating usage guide page...");
    const guideResult = safeGenerate("Usage Guide", () => generateUsageGuidePage(manifest, config), onProgress);
    pages.push(...Array.isArray(guideResult) ? guideResult : [guideResult]);
  }
  if (config.analysis.changelog) {
    onProgress?.("Generating changelog page...");
    const changelogPage = await safeGenerateAsync("Changelog", () => generateChangelogPage(config), onProgress);
    pages.push(changelogPage);
  }
  if (config.analysis.user_docs !== false && !tryMode) {
    onProgress?.("Generating end-user documentation...");
    const userDocsConfig = config.analysis.user_docs_config;
    const {
      generateUserGuidePage: generateUserGuidePage2,
      generateUserGettingStartedPage: generateUserGettingStartedPage2,
      generateFeaturesPage: generateFeaturesPage2,
      generateTroubleshootingPage: generateTroubleshootingPage2,
      generateFAQPage: generateFAQPage2,
      generateUserGuidePageNarrative: generateUserGuidePageNarrative2,
      generateUserGettingStartedPageNarrative: generateUserGettingStartedPageNarrative2,
      generateFeaturesPageNarrative: generateFeaturesPageNarrative2,
      generateTroubleshootingPageNarrative: generateTroubleshootingPageNarrative2,
      generateFAQPageNarrative: generateFAQPageNarrative2
    } = await Promise.resolve().then(() => (init_pages(), pages_exports));
    if (useNarrative) {
      const userDocPromises = [];
      if (userDocsConfig?.overview !== false) {
        userDocPromises.push(safeGenerateAsync(
          "User Guide",
          () => generateUserGuidePageNarrative2(manifest, config, aiProvider),
          onProgress
        ));
      }
      if (userDocsConfig?.getting_started !== false) {
        userDocPromises.push(safeGenerateAsync(
          "User Getting Started",
          () => generateUserGettingStartedPageNarrative2(manifest, config, aiProvider),
          onProgress
        ));
      }
      if (userDocsConfig?.features !== false) {
        userDocPromises.push(safeGenerateAsync(
          "Features",
          () => generateFeaturesPageNarrative2(manifest, config, aiProvider),
          onProgress
        ));
      }
      if (userDocsConfig?.troubleshooting !== false) {
        userDocPromises.push(safeGenerateAsync(
          "Troubleshooting",
          () => generateTroubleshootingPageNarrative2(manifest, config, aiProvider),
          onProgress
        ));
      }
      if (userDocsConfig?.faq !== false) {
        userDocPromises.push(safeGenerateAsync(
          "FAQ",
          () => generateFAQPageNarrative2(manifest, config, aiProvider),
          onProgress
        ));
      }
      const userDocResults = await Promise.all(userDocPromises);
      pages.push(...userDocResults);
    } else {
      if (userDocsConfig?.overview !== false) {
        const result = safeGenerate("User Guide", () => generateUserGuidePage2(manifest, config), onProgress);
        pages.push(...Array.isArray(result) ? result : [result]);
      }
      if (userDocsConfig?.getting_started !== false) {
        const result = safeGenerate("User Getting Started", () => generateUserGettingStartedPage2(manifest, config), onProgress);
        pages.push(...Array.isArray(result) ? result : [result]);
      }
      if (userDocsConfig?.features !== false) {
        const result = safeGenerate("Features", () => generateFeaturesPage2(manifest, config), onProgress);
        pages.push(...Array.isArray(result) ? result : [result]);
      }
      if (userDocsConfig?.troubleshooting !== false) {
        const result = safeGenerate("Troubleshooting", () => generateTroubleshootingPage2(manifest, config), onProgress);
        pages.push(...Array.isArray(result) ? result : [result]);
      }
      if (userDocsConfig?.faq !== false) {
        const result = safeGenerate("FAQ", () => generateFAQPage2(manifest, config), onProgress);
        pages.push(...Array.isArray(result) ? result : [result]);
      }
    }
  }
  if (config.analysis.insights !== false && manifest.insights && manifest.insights.length > 0) {
    onProgress?.("Generating insights page...");
    const insightsResult = safeGenerate("Insights", () => generateInsightsPage(manifest.insights, config), onProgress);
    pages.push(...Array.isArray(insightsResult) ? insightsResult : [insightsResult]);
  }
  if (structurePlan && structurePlan.conceptPages.length > 0 && aiProvider && readFile7) {
    onProgress?.("Generating concept pages...");
    const { generateConceptPage: generateConceptPage2 } = await Promise.resolve().then(() => (init_concept(), concept_exports));
    const repoUrl = config.source.repo.includes("/") ? config.source.repo : void 0;
    for (const suggestion of structurePlan.conceptPages) {
      const page = await safeGenerateAsync(
        suggestion.title,
        () => generateConceptPage2(suggestion, manifest, aiProvider, readFile7, repoUrl, config.source.branch),
        onProgress
      );
      pages.push(page);
    }
  }
  if (tryMode) {
    const totalModules = manifest.modules.length;
    for (const page of pages) {
      page.content += `

!!! tip "Unlock Full Documentation"
    This is a preview. DocWalk Pro includes complete API reference for all ${totalModules} modules, AI-powered narratives, end-user guides, and more.
`;
    }
  }
  for (const page of pages) {
    const pagePath = import_path16.default.join(docsDir, page.path);
    await (0, import_promises6.mkdir)(import_path16.default.dirname(pagePath), { recursive: true });
    await (0, import_promises6.writeFile)(pagePath, page.content);
    onProgress?.(`Written: ${page.path}`);
  }
  if (config.analysis.qa_widget && config.analysis.qa_config) {
    onProgress?.("Building Q&A index...");
    try {
      const { buildQAIndex: buildQAIndex2 } = await Promise.resolve().then(() => (init_qa(), qa_exports));
      const qaProviderName = config.analysis.qa_config.provider || "openai";
      const qaKeyEnv = config.analysis.qa_config.api_key_env || config.analysis.ai_provider?.api_key_env || "DOCWALK_AI_KEY";
      const qaApiKey = resolveApiKey(qaProviderName, qaKeyEnv) || "";
      const qaIndex = await buildQAIndex2({
        pages,
        embedder: {
          provider: qaProviderName,
          model: config.analysis.qa_config.embedding_model,
          apiKey: qaApiKey,
          base_url: config.analysis.qa_config.base_url
        },
        onProgress
      });
      const qaDir = import_path16.default.join(docsDir, "_docwalk");
      await (0, import_promises6.mkdir)(qaDir, { recursive: true });
      await (0, import_promises6.writeFile)(
        import_path16.default.join(qaDir, "qa-index.json"),
        JSON.stringify(qaIndex.serialized)
      );
      onProgress?.(`Q&A index built: ${qaIndex.chunkCount} chunks from ${qaIndex.pageCount} pages`);
      const { injectQAWidget: injectQAWidget2 } = await Promise.resolve().then(() => (init_inject(), inject_exports));
      await injectQAWidget2(outputDir, config.analysis.qa_config, "https://qa.docwalk.dev/api/ask");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onProgress?.(`Warning: Q&A index build failed: ${msg}`);
    }
  }
  const preset = resolvePreset(config.theme.preset ?? "developer");
  if (preset) {
    const stylesDir = import_path16.default.join(docsDir, "stylesheets");
    await (0, import_promises6.mkdir)(stylesDir, { recursive: true });
    await (0, import_promises6.writeFile)(import_path16.default.join(stylesDir, "preset.css"), preset.customCss);
    onProgress?.("Written: stylesheets/preset.css");
    if (preset.customJs) {
      const jsDir = import_path16.default.join(docsDir, "javascripts");
      await (0, import_promises6.mkdir)(jsDir, { recursive: true });
      await (0, import_promises6.writeFile)(import_path16.default.join(jsDir, "preset.js"), preset.customJs);
      onProgress?.("Written: javascripts/preset.js");
    }
  }
  onProgress?.("Generating mkdocs.yml...");
  const audienceSeparation = resolveAudienceSeparation(config, manifest);
  const navigation = buildNavigation(pages, audienceSeparation);
  const mkdocsYml = generateMkdocsConfig(manifest, config, navigation);
  await (0, import_promises6.writeFile)(import_path16.default.join(outputDir, "mkdocs.yml"), mkdocsYml);
  await executeHooks("post_build", hooks, { cwd: outputDir });
  onProgress?.(`Documentation generated: ${pages.length} pages`);
}
function buildNavigation(pages, audienceSeparation) {
  if (audienceSeparation) {
    return buildTabbedNavigation(pages);
  }
  const nav = [];
  const topLevel = pages.filter((p) => !p.path.includes("/")).sort((a, b) => a.navOrder - b.navOrder);
  for (const page of topLevel) {
    nav.push({ title: page.title, path: page.path });
  }
  const archIndex = pages.find((p) => p.path === "architecture/index.md");
  const archSubPages = pages.filter((p) => p.path.startsWith("architecture/") && p.path !== "architecture/index.md");
  if (archIndex || archSubPages.length > 0) {
    const archNav = {
      title: "Architecture",
      children: []
    };
    if (archIndex) {
      archNav.children.push({ title: "System Overview", path: archIndex.path });
    }
    for (const page of archSubPages.sort((a, b) => a.navOrder - b.navOrder)) {
      archNav.children.push({ title: page.title, path: page.path });
    }
    nav.push(archNav);
  }
  const apiPages = pages.filter((p) => p.path.startsWith("api/"));
  const sections = groupByLogicalSection(apiPages);
  if (Object.keys(sections).length > 0) {
    const apiNav = {
      title: "API Reference",
      children: []
    };
    for (const [section, sectionPages] of Object.entries(sections)) {
      if (Object.keys(sections).length === 1) {
        apiNav.children = sectionPages.sort((a, b) => a.title.localeCompare(b.title)).map((p) => ({ title: p.title, path: p.path }));
      } else {
        apiNav.children.push({
          title: section,
          children: sectionPages.sort((a, b) => a.title.localeCompare(b.title)).map((p) => ({ title: p.title, path: p.path }))
        });
      }
    }
    nav.push(apiNav);
  }
  return nav;
}
function buildTabbedNavigation(pages) {
  const userPages = pages.filter((p) => p.audience === "user" || p.audience === "both");
  const devPages = pages.filter((p) => p.audience === "developer" || p.audience === "both");
  const unassigned = pages.filter((p) => !p.audience);
  const userDocs = {
    title: "User Docs",
    children: []
  };
  for (const page of userPages.sort((a, b) => a.navOrder - b.navOrder)) {
    userDocs.children.push({ title: page.title, path: page.path });
  }
  const devDocs = {
    title: "Developer Docs",
    children: []
  };
  const devTopLevel = [...devPages, ...unassigned].filter((p) => !p.path.startsWith("api/") && !p.path.startsWith("architecture/") && !p.path.startsWith("concepts/")).sort((a, b) => a.navOrder - b.navOrder);
  for (const page of devTopLevel) {
    devDocs.children.push({ title: page.title, path: page.path });
  }
  const archIndex = pages.find((p) => p.path === "architecture/index.md");
  const archSubPages = pages.filter((p) => p.path.startsWith("architecture/") && p.path !== "architecture/index.md");
  if (archIndex || archSubPages.length > 0) {
    const archNav = {
      title: "Architecture",
      children: []
    };
    if (archIndex) {
      archNav.children.push({ title: "System Overview", path: archIndex.path });
    }
    for (const page of archSubPages.sort((a, b) => a.navOrder - b.navOrder)) {
      archNav.children.push({ title: page.title, path: page.path });
    }
    devDocs.children.push(archNav);
  } else {
    const archPage = pages.find((p) => p.path === "architecture.md");
    if (archPage) {
      devDocs.children.push({ title: archPage.title, path: archPage.path });
    }
  }
  const apiPages = pages.filter((p) => p.path.startsWith("api/"));
  const sections = groupByLogicalSection(apiPages);
  if (Object.keys(sections).length > 0) {
    const apiNav = {
      title: "API Reference",
      children: []
    };
    for (const [section, sectionPages] of Object.entries(sections)) {
      if (Object.keys(sections).length === 1) {
        apiNav.children = sectionPages.sort((a, b) => a.title.localeCompare(b.title)).map((p) => ({ title: p.title, path: p.path }));
      } else {
        apiNav.children.push({
          title: section,
          children: sectionPages.sort((a, b) => a.title.localeCompare(b.title)).map((p) => ({ title: p.title, path: p.path }))
        });
      }
    }
    devDocs.children.push(apiNav);
  }
  const conceptPages = pages.filter((p) => p.path.startsWith("concepts/"));
  if (conceptPages.length > 0) {
    const conceptNav = {
      title: "Concepts",
      children: conceptPages.sort((a, b) => a.navOrder - b.navOrder).map((p) => ({ title: p.title, path: p.path }))
    };
    devDocs.children.push(conceptNav);
  }
  return [userDocs, devDocs];
}
function generateMkdocsConfig(manifest, config, navigation) {
  const siteName = resolveProjectName(manifest);
  const theme = config.theme;
  const preset = resolvePreset(theme.preset ?? "developer");
  const isGitHubRepo = config.source.repo.includes("/");
  const navYaml = renderNavYaml(navigation, 0);
  let resolvedFeatures = preset && theme.features.length === ThemeSchemaDefaults.features.length ? [...preset.features] : [...theme.features];
  const layout = theme.layout ?? "tabs";
  if (layout === "sidebar") {
    resolvedFeatures = resolvedFeatures.filter(
      (f) => f !== "navigation.tabs" && f !== "navigation.tabs.sticky"
    );
    if (!resolvedFeatures.includes("toc.integrate")) {
      resolvedFeatures.push("toc.integrate");
    }
  } else if (layout === "tabs-sticky") {
    if (!resolvedFeatures.includes("navigation.tabs")) {
      resolvedFeatures.push("navigation.tabs");
    }
    if (!resolvedFeatures.includes("navigation.tabs.sticky")) {
      resolvedFeatures.push("navigation.tabs.sticky");
    }
  } else {
    if (!resolvedFeatures.includes("navigation.tabs")) {
      resolvedFeatures.push("navigation.tabs");
    }
  }
  const features = resolvedFeatures.map((f) => `      - ${f}`).join("\n");
  const scheme = preset ? preset.palette.scheme : theme.palette;
  const toggleScheme = preset?.palette.toggleScheme;
  let paletteYaml;
  if (toggleScheme) {
    paletteYaml = `  palette:
    - scheme: ${scheme}
      primary: custom
      accent: custom
      toggle:
        icon: material/brightness-${scheme === "slate" ? "4" : "7"}
        name: Switch to ${scheme === "slate" ? "light" : "dark"} mode
    - scheme: ${toggleScheme}
      primary: custom
      accent: custom
      toggle:
        icon: material/brightness-${toggleScheme === "slate" ? "4" : "7"}
        name: Switch to ${scheme === "slate" ? "dark" : "light"} mode`;
  } else {
    paletteYaml = `  palette:
    - scheme: ${scheme}
      primary: custom
      accent: custom
      toggle:
        icon: material/brightness-7
        name: Switch to dark mode
    - scheme: slate
      primary: custom
      accent: custom
      toggle:
        icon: material/brightness-4
        name: Switch to light mode`;
  }
  const fonts = preset?.fonts;
  const fontYaml = fonts ? `  font:
    text: "${fonts.text}"
    code: "${fonts.code}"` : "";
  const extraCss = [];
  if (preset) {
    extraCss.push("stylesheets/preset.css");
  }
  if (theme.custom_css) {
    extraCss.push(...theme.custom_css);
  }
  const extraCssYaml = extraCss.length > 0 ? `
extra_css:
${extraCss.map((c) => `  - ${c}`).join("\n")}
` : "";
  const extraJs = [];
  if (preset?.customJs) {
    extraJs.push("javascripts/preset.js");
  }
  if (theme.custom_js) {
    extraJs.push(...theme.custom_js);
  }
  const extraJsYaml = extraJs.length > 0 ? `
extra_javascript:
${extraJs.map((j) => `  - ${j}`).join("\n")}
` : "";
  let pluginsYaml = `plugins:
  - search:
      lang: en
  - glightbox:
      touchNavigation: true
      loop: false
      effect: zoom
      slide_effect: slide
      width: 100%
      height: auto
      zoomable: true
      draggable: true
  - minify:
      minify_html: true`;
  if (config.versioning.enabled) {
    pluginsYaml += `
  - mike:
      alias_type: symlink
      canonical_version: "${config.versioning.default_alias}"`;
  }
  let extraYaml = `extra:
  generator: false
  social: []`;
  if (config.versioning.enabled) {
    extraYaml += `
  version:
    provider: mike
    default: "${config.versioning.default_alias}"`;
  }
  return `# DocWalk Generated Configuration
# Do not edit manually \u2014 re-run 'docwalk generate' to update

site_name: "${siteName} Documentation"
site_description: "Auto-generated documentation for ${siteName}"
site_url: "${config.domain.custom ? `https://${config.domain.custom}${config.domain.base_path}` : ""}"

${isGitHubRepo ? `repo_url: "https://github.com/${config.source.repo}"
repo_name: "${config.source.repo}"` : `# repo_url: configure with your repository URL`}

theme:
  name: material
${paletteYaml}
${theme.logo ? `  logo: ${theme.logo}` : ""}
${theme.favicon ? `  favicon: ${theme.favicon}` : ""}
${fontYaml}
  features:
${features}

markdown_extensions:
  - admonition
  - pymdownx.details
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_code_format
  - pymdownx.highlight:
      anchor_linenums: true
  - pymdownx.tabbed:
      alternate_style: true
  - pymdownx.tasklist:
      custom_checkbox: true
  - tables
  - attr_list
  - md_in_html
  - toc:
      permalink: true
  - abbr
  - def_list
  - footnotes
  - pymdownx.emoji:
      emoji_index: !!python/name:material.extensions.emoji.twemoji
      emoji_generator: !!python/name:material.extensions.emoji.to_svg
  - pymdownx.inlinehilite
  - pymdownx.mark
  - pymdownx.keys

${pluginsYaml}
${extraCssYaml}${extraJsYaml}
nav:
${navYaml}

${extraYaml}
`;
}
function resolveAudienceSeparation(config, manifest) {
  const setting = config.analysis.audience;
  if (setting === "split") return true;
  if (setting === "unified") return false;
  return detectProjectType(manifest) === "library";
}
function detectProjectType(manifest) {
  if (manifest.projectMeta.projectType) return manifest.projectMeta.projectType;
  const allPaths = manifest.modules.map((m) => m.filePath);
  const hasPages = allPaths.some((p) => p.includes("pages/") || p.includes("app/"));
  const hasBin = allPaths.some((p) => p.includes("bin/") || p.includes("cli/"));
  const hasElectron = allPaths.some((p) => p.includes("electron") || p.includes("main.ts") || p.includes("main.js"));
  if (hasPages || hasElectron) return "application";
  const totalSymbols = manifest.modules.reduce((s, m) => s + m.symbols.length, 0);
  const exportedSymbols = manifest.modules.reduce(
    (s, m) => s + m.symbols.filter((sym) => sym.exported).length,
    0
  );
  if (totalSymbols > 0 && exportedSymbols / totalSymbols > 0.5) return "library";
  if (hasBin) return "application";
  return "unknown";
}
var import_promises6, import_path16, ThemeSchemaDefaults;
var init_mkdocs = __esm({
  "src/generators/mkdocs.ts"() {
    "use strict";
    import_promises6 = require("fs/promises");
    import_path16 = __toESM(require("path"), 1);
    init_hooks();
    init_theme_presets();
    init_utils();
    init_pages();
    init_overview();
    init_getting_started();
    init_architecture();
    init_providers();
    ThemeSchemaDefaults = {
      features: [
        "navigation.tabs",
        "navigation.sections",
        "navigation.expand",
        "navigation.top",
        "search.suggest",
        "search.highlight",
        "content.code.copy",
        "content.tabs.link"
      ]
    };
  }
});

// src/cli/commands/generate.ts
var generate_exports = {};
__export(generate_exports, {
  generateCommand: () => generateCommand
});
async function generateCommand(options) {
  if (options.verbose) setVerbose(true);
  header("Generate Documentation");
  let config;
  let filepath;
  try {
    const result = options.config ? await loadConfigFile(options.config) : await loadConfig();
    config = result.config;
    filepath = result.filepath;
  } catch (err) {
    if (err instanceof ConfigNotFoundError) {
      blank();
      log("info", "No configuration found \u2014 let's set up DocWalk.");
      blank();
      const { initCommand: initCommand2 } = await Promise.resolve().then(() => (init_init(), init_exports));
      await initCommand2({});
      try {
        const result = await loadConfig();
        config = result.config;
        filepath = result.filepath;
      } catch {
        log("error", "Could not load configuration after init. Please run docwalk init manually.");
        process.exit(1);
      }
    } else {
      throw err;
    }
  }
  log("success", `Config loaded from ${import_chalk4.default.dim(filepath)}`);
  if (options.theme) {
    config.theme.preset = options.theme;
    log("info", `Theme preset: ${import_chalk4.default.bold(options.theme)}`);
  }
  if (options.layout) {
    config.theme.layout = options.layout;
    log("info", `Layout: ${import_chalk4.default.bold(options.layout)}`);
  }
  if (options.ai) {
    config.analysis.ai_summaries = true;
    config.analysis.ai_narrative = true;
    config.analysis.ai_diagrams = true;
    if (!config.analysis.ai_provider) {
      config.analysis.ai_provider = {
        name: "gemini",
        model: "gemini-2.5-flash",
        api_key_env: "DOCWALK_AI_KEY"
      };
    }
    const provName = config.analysis.ai_provider.name;
    const keyEnv = config.analysis.ai_provider.api_key_env;
    const needsKey = provName !== "ollama" && provName !== "local" && provName !== "docwalk-proxy";
    if (needsKey && !resolveApiKey(provName, keyEnv)) {
      log("info", "No API key found \u2014 using DocWalk's free AI service (powered by Gemini Flash)");
      config.analysis.ai_provider.name = "docwalk-proxy";
    }
  }
  const aiProvider = config.analysis.ai_provider;
  const aiEnabled = config.analysis.ai_summaries && aiProvider;
  if (aiEnabled) {
    const provName = aiProvider.name;
    const keyEnv = aiProvider.api_key_env;
    const needsKey = provName !== "ollama" && provName !== "local" && provName !== "docwalk-proxy";
    if (needsKey && !resolveApiKey(provName, keyEnv)) {
      blank();
      const envVarName = keyEnv || provName.toUpperCase() + "_API_KEY";
      const { action } = await import_inquirer2.default.prompt([
        {
          type: "list",
          name: "action",
          message: `AI is enabled but no ${envVarName} found:`,
          choices: [
            { name: "Enter API key now", value: "enter" },
            { name: "Use DocWalk free tier instead", value: "proxy" },
            { name: "Continue without AI", value: "skip" }
          ]
        }
      ]);
      if (action === "enter") {
        const { apiKey } = await import_inquirer2.default.prompt([
          {
            type: "password",
            name: "apiKey",
            message: `${envVarName}:`,
            mask: "*",
            validate: (input) => input.length > 0 || "API key is required"
          }
        ]);
        process.env[envVarName] = apiKey;
        await saveProjectApiKey(provName, apiKey);
        log("success", `API key saved to ${import_chalk4.default.dim(".docwalk/.env")}`);
      } else if (action === "proxy") {
        aiProvider.name = "docwalk-proxy";
      } else {
        config.analysis.ai_summaries = false;
      }
    }
  }
  const repoRoot = resolveRepoRoot(config.source);
  const git = (0, import_simple_git2.default)(repoRoot);
  let commitSha;
  try {
    commitSha = await git.revparse(["HEAD"]);
  } catch {
    commitSha = "unknown";
    log("warn", "Not a git repository \u2014 commit tracking disabled");
  }
  const aiProviderFinal = config.analysis.ai_provider;
  const aiFinalEnabled = config.analysis.ai_summaries && aiProviderFinal;
  const providerLabel = aiProviderFinal ? `${aiProviderFinal.name}${aiProviderFinal.model ? ` (${aiProviderFinal.model})` : ""}` : "";
  log("info", `Analyzing ${import_chalk4.default.bold(config.source.repo)} on branch ${import_chalk4.default.bold(config.source.branch)}`);
  if (aiFinalEnabled) {
    log("info", `AI provider: ${import_chalk4.default.bold(providerLabel)} at ${import_chalk4.default.dim(aiProviderFinal.base_url || "default endpoint")}`);
  }
  const totalSteps = aiFinalEnabled ? 4 : 3;
  let step = 1;
  const scanSpinner = (0, import_ora2.default)({
    text: `[${step}/${totalSteps}] Scanning source files...`,
    prefixText: " "
  }).start();
  const startTime = Date.now();
  let aiStartTime;
  let insightsPhaseStarted = false;
  let scanFileCount = 0;
  let aiSummarySpinner;
  let aiInsightsSpinner;
  const manifest = await analyzeCodebase({
    source: config.source,
    analysis: config.analysis,
    repoRoot,
    commitSha,
    onProgress: (current, total, file) => {
      scanFileCount = current;
      scanSpinner.text = `[${step}/${totalSteps}] Scanning source files... ${current}/${total}`;
      log("debug", `[${current}/${total}] ${file}`);
    },
    onAIProgress: (current, total, message) => {
      const isInsightsPhase = message.startsWith("AI analyzing:");
      if (isInsightsPhase) {
        if (!insightsPhaseStarted) {
          insightsPhaseStarted = true;
          step++;
          aiInsightsSpinner = (0, import_ora2.default)({
            text: `[${step}/${totalSteps}] Enhancing code insights... 0/${total}`,
            prefixText: " "
          }).start();
        }
        const pct = Math.round(current / total * 100);
        if (aiInsightsSpinner) {
          aiInsightsSpinner.text = `[${step}/${totalSteps}] Enhancing code insights... ${current}/${total} (${pct}%)`;
        }
      } else {
        if (!aiStartTime) {
          aiStartTime = Date.now();
          step++;
          aiSummarySpinner = (0, import_ora2.default)({
            text: `[${step}/${totalSteps}] Writing AI summaries... 0/${total}`,
            prefixText: " "
          }).start();
        }
        const pct = Math.round(current / total * 100);
        if (aiSummarySpinner) {
          aiSummarySpinner.text = `[${step}/${totalSteps}] Writing AI summaries... ${current}/${total} (${pct}%)`;
        }
      }
      log("debug", `[AI ${current}/${total}] ${message}`);
    }
  });
  const analysisTime = ((Date.now() - startTime) / 1e3).toFixed(1);
  scanSpinner.succeed(
    `Scanned ${manifest.stats.totalFiles} files, ${manifest.stats.totalSymbols} symbols (${analysisTime}s)`
  );
  if (aiInsightsSpinner) {
    aiInsightsSpinner.succeed("Code insights enhanced");
  }
  if (config.analysis.ai_summaries) {
    const aiModules = manifest.modules.filter((m) => m.aiSummary);
    if (aiModules.length > 0) {
      const aiTime = aiStartTime ? ((Date.now() - aiStartTime) / 1e3).toFixed(1) : "?";
      if (aiSummarySpinner) {
        aiSummarySpinner.succeed(
          `AI summaries: ${aiModules.length}/${manifest.modules.length} modules (${aiTime}s via ${providerLabel})`
        );
      }
    } else {
      if (aiSummarySpinner) {
        aiSummarySpinner.warn("AI summaries: no modules received summaries");
      } else if (!aiProviderFinal) {
        log("warn", "AI summaries enabled but no ai_provider configured");
      } else if (aiProviderFinal.name !== "ollama" && aiProviderFinal.name !== "local" && aiProviderFinal.name !== "docwalk-proxy") {
        const keyEnv = aiProviderFinal.api_key_env;
        log("warn", `AI summaries enabled but ${keyEnv} environment variable not set`);
      } else {
        log("warn", `AI summaries enabled but no modules received summaries \u2014 check that ${providerLabel} is running`);
      }
    }
  } else {
    log("info", "AI summaries: disabled");
  }
  if (options.dryRun) {
    blank();
    log("info", "Dry run \u2014 skipping file generation");
    log("info", `Would generate ~${manifest.modules.length + 4} pages`);
    return;
  }
  step = totalSteps;
  const outputDir = import_path17.default.resolve(options.output);
  const genSpinner = (0, import_ora2.default)({
    text: `[${step}/${totalSteps}] Generating documentation pages...`,
    prefixText: " "
  }).start();
  const readFile7 = async (filePath) => {
    const fullPath = import_path17.default.isAbsolute(filePath) ? filePath : import_path17.default.join(repoRoot, filePath);
    return (0, import_promises7.readFile)(fullPath, "utf-8");
  };
  let pageCount = 0;
  await generateDocs({
    manifest,
    config,
    outputDir,
    readFile: readFile7,
    tryMode: options.tryMode,
    onProgress: (msg) => {
      if (msg.startsWith("Written:")) {
        pageCount++;
        genSpinner.text = `[${step}/${totalSteps}] Generating documentation pages... ${pageCount}`;
        log("debug", msg);
      } else if (msg.startsWith("Warning:")) {
        log("warn", msg.replace("Warning: ", ""));
      } else {
        log("info", msg);
      }
    }
  });
  genSpinner.succeed(`Generated ${pageCount} pages`);
  try {
    const { execa } = await import("execa");
    await execa("python3", ["-c", "import zensical"]);
  } catch {
    blank();
    log("warn", "Zensical not installed \u2014 needed for preview/deploy");
    console.log(`    Run: ${import_chalk4.default.cyan("docwalk doctor --install")}`);
  }
  blank();
  console.log(import_chalk4.default.dim("  Next steps:"));
  console.log(`    ${import_chalk4.default.cyan("docwalk dev")}     \u2014 Preview locally`);
  console.log(`    ${import_chalk4.default.cyan("docwalk deploy")}  \u2014 Deploy to ${config.deploy.provider}`);
  blank();
}
var import_chalk4, import_path17, import_ora2, import_inquirer2, import_promises7, import_simple_git2;
var init_generate = __esm({
  "src/cli/commands/generate.ts"() {
    "use strict";
    import_chalk4 = __toESM(require("chalk"), 1);
    import_path17 = __toESM(require("path"), 1);
    import_ora2 = __toESM(require("ora"), 1);
    import_inquirer2 = __toESM(require("inquirer"), 1);
    import_promises7 = require("fs/promises");
    init_loader();
    init_engine();
    init_mkdocs();
    init_providers();
    init_logger();
    init_utils2();
    init_secrets();
    import_simple_git2 = __toESM(require("simple-git"), 1);
  }
});

// src/cli/commands/init.ts
var init_exports = {};
__export(init_exports, {
  initCommand: () => initCommand
});
async function initCommand(options) {
  header("Initialize DocWalk");
  const interactive = options.interactive !== false;
  if (!interactive) {
    await writeDefaultConfig(options);
    return;
  }
  const { mode } = await import_inquirer3.default.prompt([
    {
      type: "list",
      name: "mode",
      message: "Setup mode:",
      choices: [
        { name: "Quick Start \u2014 analyze code, generate docs, done", value: "quick" },
        { name: "Custom     \u2014 configure deploy, sync, domain, theme", value: "custom" }
      ]
    }
  ]);
  if (mode === "quick") {
    await quickStartTrack(options);
  } else {
    await customTrack(options);
  }
}
async function quickStartTrack(options) {
  const detectedRepo = options.repo || await detectCurrentRepo();
  const { repo } = await import_inquirer3.default.prompt([
    {
      type: "input",
      name: "repo",
      message: "Repository:",
      default: detectedRepo,
      validate: (input) => input.length > 0 || "Repository is required"
    }
  ]);
  let branch = "main";
  try {
    const currentBranch = (0, import_child_process.execSync)("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
    if (currentBranch) branch = currentBranch;
  } catch {
  }
  blank();
  const aiResult = await runAISetup();
  blank();
  const { preset } = await import_inquirer3.default.prompt([
    {
      type: "list",
      name: "preset",
      message: "Theme:",
      choices: [
        { name: "Developer \u2014 Dark-first, code-dense, technical", value: "developer" },
        { name: "Corporate \u2014 Clean, professional", value: "corporate" },
        { name: "Startup   \u2014 Vibrant, modern", value: "startup" },
        { name: "Minimal   \u2014 Reading-focused, distraction-free", value: "minimal" }
      ],
      default: "developer"
    }
  ]);
  const repoName = repo.split("/").pop() || "docs";
  const config = {
    source: {
      repo,
      branch,
      include: DEFAULT_INCLUDES,
      exclude: DEFAULT_EXCLUDES,
      languages: "auto",
      provider: detectProvider(repo)
    },
    analysis: {
      depth: "full",
      ai_summaries: aiResult.enabled,
      ...aiResult.enabled && aiResult.providerName && {
        ai_provider: {
          name: aiResult.providerName,
          ...aiResult.model && { model: aiResult.model }
        }
      },
      dependency_graph: true,
      changelog: true,
      changelog_depth: 100,
      config_docs: true,
      max_file_size: 5e5,
      concurrency: 4
    },
    sync: {
      trigger: "on_push",
      diff_strategy: "incremental",
      impact_analysis: true,
      state_file: ".docwalk/state.json",
      auto_commit: false,
      commit_message: "docs: update documentation [docwalk]"
    },
    deploy: {
      provider: "gh-pages",
      project: `${repoName}-docs`,
      auto_ssl: true,
      output_dir: "site"
    },
    domain: {
      base_path: "/",
      dns_auto: true
    },
    theme: {
      preset,
      layout: "tabs",
      features: DEFAULT_FEATURES
    },
    versioning: {
      enabled: false,
      source: "tags",
      tag_pattern: "^v\\d+\\.\\d+\\.\\d+$",
      default_alias: "latest",
      max_versions: 10
    }
  };
  await writeConfigAndScaffold(config);
  blank();
  const { generateNow } = await import_inquirer3.default.prompt([
    {
      type: "confirm",
      name: "generateNow",
      message: "Generate documentation now?",
      default: true
    }
  ]);
  if (generateNow) {
    blank();
    const { generateCommand: generateCommand2 } = await Promise.resolve().then(() => (init_generate(), generate_exports));
    await generateCommand2({ output: "docwalk-output" });
  } else {
    blank();
    console.log(import_chalk5.default.dim("  Next steps:"));
    console.log(`    1. ${import_chalk5.default.cyan("docwalk generate")}  \u2014 Analyze and generate docs`);
    console.log(`    2. ${import_chalk5.default.cyan("docwalk dev")}       \u2014 Preview locally`);
    blank();
  }
}
async function customTrack(options) {
  const repoAnswers = await import_inquirer3.default.prompt([
    {
      type: "input",
      name: "repo",
      message: "Repository (owner/repo or local path):",
      default: options.repo || await detectCurrentRepo(),
      validate: (input) => input.length > 0 || "Repository is required"
    },
    {
      type: "list",
      name: "branch",
      message: "Branch to track:",
      choices: ["main", "master", "develop", "Other"],
      default: "main"
    },
    {
      type: "input",
      name: "branchCustom",
      message: "Enter branch name:",
      when: (answers) => answers.branch === "Other"
    }
  ]);
  const branch = repoAnswers.branch === "Other" ? repoAnswers.branchCustom : repoAnswers.branch;
  blank();
  log("info", "Analysis Configuration");
  const analysisAnswers = await import_inquirer3.default.prompt([
    {
      type: "list",
      name: "depth",
      message: "Analysis depth:",
      choices: [
        { name: "Full \u2014 AST, cross-refs, dependency graph, everything", value: "full" },
        { name: "Surface \u2014 File-level overview, exports, top-level docs", value: "surface" },
        { name: "API Only \u2014 Public API surface (exports, types, interfaces)", value: "api-only" }
      ],
      default: "full"
    },
    {
      type: "confirm",
      name: "dependency_graph",
      message: "Generate dependency graph?",
      default: true
    },
    {
      type: "confirm",
      name: "changelog",
      message: "Auto-generate changelog from git history?",
      default: true
    }
  ]);
  blank();
  const aiResult = await runAISetup();
  blank();
  log("info", "Deployment Configuration");
  const deployAnswers = await import_inquirer3.default.prompt([
    {
      type: "list",
      name: "provider",
      message: "Hosting provider:",
      choices: [
        { name: "GitHub Pages \u2014 Free for public repos, Actions-based", value: "gh-pages" },
        { name: "Cloudflare Pages \u2014 Global edge, Wrangler CLI", value: "cloudflare" },
        { name: "Vercel \u2014 Instant deploys, preview URLs", value: "vercel" },
        { name: "Netlify \u2014 Git-based, form handling", value: "netlify" },
        { name: "AWS S3 \u2014 S3 bucket + optional CloudFront", value: "s3" }
      ],
      default: options.provider || "gh-pages"
    },
    {
      type: "input",
      name: "project",
      message: "Project name on hosting platform:",
      default: (answers) => {
        const repoName = repoAnswers.repo.split("/").pop() || "docs";
        return `${repoName}-docs`;
      }
    }
  ]);
  blank();
  log("info", "Domain Configuration");
  const domainAnswers = await import_inquirer3.default.prompt([
    {
      type: "confirm",
      name: "useCustomDomain",
      message: "Configure a custom domain?",
      default: !!options.domain
    },
    {
      type: "input",
      name: "custom",
      message: "Custom domain (e.g., docs.yourcompany.com):",
      default: options.domain,
      when: (answers) => answers.useCustomDomain,
      validate: (input) => {
        if (!input.includes(".")) return "Enter a valid domain";
        return true;
      }
    },
    {
      type: "input",
      name: "base_path",
      message: "Base path (e.g., /project-name, or / for root):",
      default: "/"
    },
    {
      type: "confirm",
      name: "dns_auto",
      message: "Auto-configure DNS via provider API?",
      default: true,
      when: (answers) => answers.useCustomDomain
    }
  ]);
  blank();
  log("info", "Sync Strategy");
  const syncAnswers = await import_inquirer3.default.prompt([
    {
      type: "list",
      name: "trigger",
      message: "When should docs sync?",
      choices: [
        { name: "On Push \u2014 Every push to tracked branch triggers sync", value: "on_push" },
        { name: "Scheduled \u2014 Sync on a cron schedule", value: "cron" },
        { name: "Manual \u2014 Only via CLI command", value: "manual" }
      ],
      default: "on_push"
    },
    {
      type: "input",
      name: "cron",
      message: "Cron expression (e.g., '0 */6 * * *' for every 6 hours):",
      when: (answers) => answers.trigger === "cron",
      default: "0 */6 * * *"
    },
    {
      type: "confirm",
      name: "impact_analysis",
      message: "Enable cross-file impact analysis?",
      default: true
    }
  ]);
  blank();
  log("info", "Theme");
  const themeAnswers = await import_inquirer3.default.prompt([
    {
      type: "list",
      name: "preset",
      message: "Theme preset:",
      choices: [
        { name: "Developer \u2014 Dark-first, code-dense, technical (Inter + Fira Code)", value: "developer" },
        { name: "Corporate \u2014 Clean, professional, B2B (Roboto)", value: "corporate" },
        { name: "Startup \u2014 Vibrant, modern, energetic (Inter + Fira Code)", value: "startup" },
        { name: "Minimal \u2014 Reading-focused, distraction-free (Source Serif)", value: "minimal" },
        new import_inquirer3.default.Separator("\u2500\u2500 Premium \u2500\u2500"),
        { name: "API Reference \u2014 Code-dense, integrated TOC (Team+)", value: "api-reference" },
        { name: "Knowledge Base \u2014 Readable, breadcrumbs, sticky tabs (Team+)", value: "knowledge-base" },
        new import_inquirer3.default.Separator("\u2500\u2500"),
        { name: "Custom \u2014 Choose your own palette and accent", value: "custom" }
      ],
      default: "developer"
    },
    {
      type: "list",
      name: "layout",
      message: "Layout mode:",
      choices: [
        { name: "Tabs \u2014 Top navigation tabs (default)", value: "tabs" },
        { name: "Sidebar \u2014 No tabs, TOC integrated in left sidebar", value: "sidebar" },
        { name: "Sticky Tabs \u2014 Tabs that stay visible on scroll", value: "tabs-sticky" }
      ],
      default: "tabs"
    },
    {
      type: "list",
      name: "palette",
      message: "Color palette:",
      choices: [
        { name: "Slate (dark)", value: "slate" },
        { name: "Default (light)", value: "default" },
        { name: "Indigo", value: "indigo" },
        { name: "Teal", value: "teal" },
        { name: "Deep Purple", value: "deep-purple" }
      ],
      default: "slate",
      when: (answers) => answers.preset === "custom"
    },
    {
      type: "input",
      name: "accent",
      message: "Accent color (hex):",
      default: "#5de4c7",
      when: (answers) => answers.preset === "custom"
    }
  ]);
  const config = {
    source: {
      repo: repoAnswers.repo,
      branch,
      include: DEFAULT_INCLUDES,
      exclude: DEFAULT_EXCLUDES,
      languages: "auto",
      provider: detectProvider(repoAnswers.repo)
    },
    analysis: {
      depth: analysisAnswers.depth,
      ai_summaries: aiResult.enabled,
      ...aiResult.enabled && aiResult.providerName && {
        ai_provider: {
          name: aiResult.providerName,
          ...aiResult.model && { model: aiResult.model }
        }
      },
      dependency_graph: analysisAnswers.dependency_graph,
      changelog: analysisAnswers.changelog,
      changelog_depth: 100,
      config_docs: true,
      max_file_size: 5e5,
      concurrency: 4
    },
    sync: {
      trigger: syncAnswers.trigger,
      ...syncAnswers.cron && { cron: syncAnswers.cron },
      diff_strategy: "incremental",
      impact_analysis: syncAnswers.impact_analysis,
      state_file: ".docwalk/state.json",
      auto_commit: false,
      commit_message: "docs: update documentation [docwalk]"
    },
    deploy: {
      provider: deployAnswers.provider,
      project: deployAnswers.project,
      auto_ssl: true,
      output_dir: "site"
    },
    domain: {
      ...domainAnswers.custom && { custom: domainAnswers.custom },
      base_path: domainAnswers.base_path,
      dns_auto: domainAnswers.dns_auto ?? true
    },
    theme: {
      preset: themeAnswers.preset,
      layout: themeAnswers.layout || "tabs",
      ...themeAnswers.palette && { palette: themeAnswers.palette },
      ...themeAnswers.accent && { accent: themeAnswers.accent },
      features: DEFAULT_FEATURES
    },
    versioning: {
      enabled: false,
      source: "tags",
      tag_pattern: "^v\\d+\\.\\d+\\.\\d+$",
      default_alias: "latest",
      max_versions: 10
    }
  };
  await writeConfigAndScaffold(config);
  const { confirm: shouldSetupCI } = await import_inquirer3.default.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Generate CI/CD pipeline config?",
      default: true
    }
  ]);
  if (shouldSetupCI) {
    log("info", "Generating CI/CD configuration...");
    log(
      "success",
      `Run ${import_chalk5.default.cyan("docwalk ci-setup")} to generate the pipeline config`
    );
  }
  blank();
  log("success", "DocWalk initialized!");
  blank();
  console.log(import_chalk5.default.dim("  Next steps:"));
  console.log(`    1. ${import_chalk5.default.cyan("docwalk generate")}  \u2014 Analyze and generate docs`);
  console.log(`    2. ${import_chalk5.default.cyan("docwalk dev")}       \u2014 Preview locally`);
  console.log(`    3. ${import_chalk5.default.cyan("docwalk deploy")}    \u2014 Deploy to ${deployAnswers.provider}`);
  blank();
}
async function writeConfigAndScaffold(config) {
  const configPath = import_path18.default.resolve("docwalk.config.yml");
  const yamlContent = import_js_yaml.default.dump(config, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false
  });
  await (0, import_promises8.writeFile)(configPath, `# DocWalk Configuration
# Generated by 'docwalk init'
# Docs: https://docwalk.dev/config

${yamlContent}`);
  blank();
  log("success", `Configuration written to ${import_chalk5.default.cyan("docwalk.config.yml")}`);
  await (0, import_promises8.mkdir)(".docwalk", { recursive: true });
  const gitignorePath = import_path18.default.resolve(".docwalk/.gitignore");
  await (0, import_promises8.writeFile)(gitignorePath, "state.json\nmanifest.json\n.env\n");
}
function detectProvider(repo) {
  if (repo === "." || repo.startsWith("/") || repo.startsWith("./") || repo.startsWith("../")) {
    return "local";
  }
  try {
    (0, import_child_process.execSync)("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
    return "local";
  } catch {
    return repo.includes("/") ? "github" : "local";
  }
}
async function detectCurrentRepo() {
  try {
    const { execa } = await import("execa");
    const result = await execa("git", [
      "remote",
      "get-url",
      "origin"
    ]);
    const url = result.stdout.trim();
    const match = url.match(
      /github\.com[:/]([^/]+\/[^/.]+)/
    );
    if (match) return match[1];
    return url;
  } catch {
    return ".";
  }
}
async function writeDefaultConfig(options) {
  const repo = options.repo || ".";
  const config = {
    source: {
      repo,
      branch: "main",
      include: DEFAULT_INCLUDES,
      exclude: DEFAULT_EXCLUDES,
      languages: "auto",
      provider: detectProvider(repo)
    },
    analysis: { depth: "full", ai_summaries: false, dependency_graph: true, changelog: true, changelog_depth: 100, config_docs: true, types_page: true, dependencies_page: true, usage_guide_page: true, max_file_size: 5e5, concurrency: 4 },
    sync: { trigger: "on_push", diff_strategy: "incremental", impact_analysis: true, state_file: ".docwalk/state.json", auto_commit: false, commit_message: "docs: update documentation [docwalk]" },
    deploy: { provider: options.provider || "gh-pages", project: `${repo.split("/").pop()}-docs`, auto_ssl: true, output_dir: "site" },
    domain: { ...options.domain && { custom: options.domain }, base_path: "/", dns_auto: true },
    theme: { preset: options.theme || "developer", layout: options.layout || "tabs", palette: "slate", accent: "#5de4c7", features: DEFAULT_FEATURES },
    versioning: { enabled: false, source: "tags", default_alias: "latest", max_versions: 10 }
  };
  const yamlContent = import_js_yaml.default.dump(config, { indent: 2, lineWidth: 100, noRefs: true });
  await (0, import_promises8.writeFile)("docwalk.config.yml", `# DocWalk Configuration

${yamlContent}`);
  await (0, import_promises8.mkdir)(".docwalk", { recursive: true });
  await (0, import_promises8.writeFile)(import_path18.default.resolve(".docwalk/.gitignore"), "state.json\nmanifest.json\n.env\n");
  log("success", `Configuration written to ${import_chalk5.default.cyan("docwalk.config.yml")}`);
}
var import_inquirer3, import_chalk5, import_promises8, import_child_process, import_path18, import_js_yaml, DEFAULT_INCLUDES, DEFAULT_EXCLUDES, DEFAULT_FEATURES;
var init_init = __esm({
  "src/cli/commands/init.ts"() {
    "use strict";
    import_inquirer3 = __toESM(require("inquirer"), 1);
    import_chalk5 = __toESM(require("chalk"), 1);
    import_promises8 = require("fs/promises");
    import_child_process = require("child_process");
    import_path18 = __toESM(require("path"), 1);
    import_js_yaml = __toESM(require("js-yaml"), 1);
    init_logger();
    init_ai_setup();
    DEFAULT_INCLUDES = [
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.jsx",
      "**/*.py",
      "**/*.go",
      "**/*.rs",
      "**/*.java",
      "**/*.rb",
      "**/*.php",
      "**/*.cs",
      "**/*.c",
      "**/*.h",
      "**/*.cpp",
      "**/*.hpp",
      "**/*.cc",
      "**/*.cxx",
      "**/*.swift",
      "**/*.kt",
      "**/*.kts",
      "**/*.scala",
      "**/*.sh",
      "**/*.bash",
      "**/*.yaml",
      "**/*.yml",
      "**/*.tf",
      "**/*.hcl",
      "**/*.md",
      "**/*.json",
      "**/*.toml",
      "**/*.xml",
      "**/*.sql",
      "**/*.dockerfile",
      "**/Dockerfile"
    ];
    DEFAULT_EXCLUDES = [
      "node_modules/**",
      "dist/**",
      "build/**",
      "out/**",
      ".git/**",
      ".next/**",
      "vendor/**",
      "__pycache__/**",
      "venv/**",
      ".venv/**",
      "target/**",
      "**/*.test.*",
      "**/*.spec.*",
      "**/__tests__/**",
      "**/test/**",
      "**/tests/**",
      "coverage/**",
      ".docwalk/**",
      "docwalk-output/**",
      "site/**",
      "**/*.d.ts",
      "**/*.min.js",
      "**/migrations/**"
    ];
    DEFAULT_FEATURES = [
      "navigation.tabs",
      "navigation.sections",
      "navigation.expand",
      "navigation.top",
      "search.suggest",
      "search.highlight",
      "content.code.copy",
      "content.tabs.link"
    ];
  }
});

// src/sync/engine.ts
async function runSync(options) {
  const { repoRoot, source, analysis, sync, dryRun, since, onProgress } = options;
  const startTime = Date.now();
  const git = (0, import_simple_git3.default)(repoRoot);
  const currentCommit = (await git.revparse(["HEAD"])).trim();
  onProgress?.(`Current commit: ${currentCommit.slice(0, 8)}`);
  const statePath = import_path19.default.resolve(repoRoot, sync.state_file);
  const manifestPath = import_path19.default.resolve(repoRoot, ".docwalk/manifest.json");
  const previousState = await loadSyncState(statePath);
  const fromCommit = since ?? previousState?.lastCommitSha;
  const needsFullAnalysis = !fromCommit || previousState && !await isManifestValid(previousState.manifestPath);
  if (needsFullAnalysis) {
    const reason = !fromCommit ? "No previous sync state found" : "Manifest file is missing or corrupt";
    onProgress?.(`${reason} \u2014 performing full analysis`);
    return performFullAnalysis({
      source,
      analysis,
      repoRoot,
      currentCommit,
      statePath,
      manifestPath,
      startTime,
      onProgress
    });
  }
  const fromCommitValid = await isCommitReachable(git, fromCommit);
  if (!fromCommitValid) {
    onProgress?.(
      `Previous commit ${fromCommit.slice(0, 8)} not found in history (force push or rebase?) \u2014 falling back to full analysis`
    );
    return performFullAnalysis({
      source,
      analysis,
      repoRoot,
      currentCommit,
      statePath,
      manifestPath,
      startTime,
      onProgress
    });
  }
  onProgress?.(
    `Diffing ${fromCommit.slice(0, 8)}..${currentCommit.slice(0, 8)}`
  );
  const diffs = await computeDiff(git, fromCommit, currentCommit);
  if (diffs.length === 0) {
    onProgress?.("No changes detected \u2014 skipping sync");
    return {
      diffs: [],
      modulesReanalyzed: 0,
      pagesRebuilt: 0,
      pagesCreated: 0,
      pagesDeleted: 0,
      impactedModules: [],
      duration: Date.now() - startTime,
      previousCommit: fromCommit,
      currentCommit
    };
  }
  onProgress?.(`Found ${diffs.length} changed files`);
  if (dryRun) {
    return {
      diffs,
      modulesReanalyzed: 0,
      pagesRebuilt: 0,
      pagesCreated: 0,
      pagesDeleted: 0,
      impactedModules: [],
      duration: Date.now() - startTime,
      previousCommit: fromCommit,
      currentCommit
    };
  }
  const prevManifestPath = previousState?.manifestPath ?? manifestPath;
  const previousManifest = await loadManifest(prevManifestPath);
  const renamedFiles = diffs.filter((d) => d.status === "renamed");
  if (previousManifest && renamedFiles.length > 0) {
    for (const rename of renamedFiles) {
      if (!rename.oldPath) continue;
      const oldModule = previousManifest.modules.find(
        (m) => m.filePath === rename.oldPath
      );
      if (oldModule) {
        oldModule.filePath = rename.path;
        for (const edge of previousManifest.dependencyGraph.edges) {
          if (edge.from === rename.oldPath) edge.from = rename.path;
          if (edge.to === rename.oldPath) edge.to = rename.path;
        }
        const nodeIdx = previousManifest.dependencyGraph.nodes.indexOf(
          rename.oldPath
        );
        if (nodeIdx >= 0) {
          previousManifest.dependencyGraph.nodes[nodeIdx] = rename.path;
        }
      }
    }
  }
  const filesToAnalyze = diffs.filter((d) => d.status !== "deleted").map((d) => d.path);
  const deletedFiles = diffs.filter((d) => d.status === "deleted").map((d) => d.path);
  let impactedModules = [];
  if (sync.impact_analysis && previousManifest) {
    impactedModules = findImpactedModulesRecursive(
      diffs,
      previousManifest
    );
    onProgress?.(
      `Impact analysis: ${impactedModules.length} downstream modules affected`
    );
    const analyzeSet = new Set(filesToAnalyze);
    for (const impacted of impactedModules) {
      if (!analyzeSet.has(impacted)) {
        filesToAnalyze.push(impacted);
        analyzeSet.add(impacted);
      }
    }
  }
  onProgress?.(`Re-analyzing ${filesToAnalyze.length} files...`);
  const manifest = await analyzeCodebase({
    source,
    analysis,
    repoRoot,
    commitSha: currentCommit,
    targetFiles: filesToAnalyze,
    previousManifest,
    onProgress: (cur, total, file) => onProgress?.(`Analyzing [${cur}/${total}] ${file}`)
  });
  manifest.modules = manifest.modules.filter(
    (m) => !deletedFiles.includes(m.filePath)
  );
  await saveSyncState(statePath, {
    lastCommitSha: currentCommit,
    lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString(),
    manifestPath: prevManifestPath,
    totalPages: manifest.modules.length
  });
  await saveManifest(prevManifestPath, manifest);
  const pagesCreated = diffs.filter((d) => d.status === "added").length;
  const pagesDeleted = deletedFiles.length;
  return {
    diffs,
    modulesReanalyzed: filesToAnalyze.length,
    pagesRebuilt: filesToAnalyze.length,
    pagesCreated,
    pagesDeleted,
    impactedModules,
    duration: Date.now() - startTime,
    previousCommit: fromCommit,
    currentCommit
  };
}
async function performFullAnalysis(params) {
  const { source, analysis, repoRoot, currentCommit, statePath, manifestPath, startTime, onProgress } = params;
  const manifest = await analyzeCodebase({
    source,
    analysis,
    repoRoot,
    commitSha: currentCommit,
    onProgress: (cur, total, file) => onProgress?.(`Analyzing [${cur}/${total}] ${file}`)
  });
  await saveSyncState(statePath, {
    lastCommitSha: currentCommit,
    lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString(),
    manifestPath,
    totalPages: manifest.modules.length
  });
  await saveManifest(manifestPath, manifest);
  return {
    diffs: [],
    modulesReanalyzed: manifest.modules.length,
    pagesRebuilt: manifest.modules.length,
    pagesCreated: manifest.modules.length,
    pagesDeleted: 0,
    impactedModules: [],
    duration: Date.now() - startTime,
    previousCommit: "none",
    currentCommit
  };
}
async function isCommitReachable(git, commitSha) {
  try {
    await git.raw(["cat-file", "-t", commitSha]);
    return true;
  } catch {
    return false;
  }
}
async function computeDiff(git, fromCommit, toCommit) {
  const diffResult = await git.diff([
    "--name-status",
    fromCommit,
    toCommit
  ]);
  const diffs = [];
  for (const line of diffResult.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("	");
    const statusCode = parts[0];
    if (statusCode.startsWith("R")) {
      diffs.push({
        path: parts[2],
        oldPath: parts[1],
        status: "renamed"
      });
    } else if (statusCode.startsWith("C")) {
      diffs.push({
        path: parts[2],
        oldPath: parts[1],
        status: "added"
      });
    } else if (statusCode === "A") {
      diffs.push({ path: parts[1], status: "added" });
    } else if (statusCode === "M") {
      diffs.push({ path: parts[1], status: "modified" });
    } else if (statusCode === "D") {
      diffs.push({ path: parts[1], status: "deleted" });
    }
  }
  return diffs;
}
function findImpactedModulesRecursive(diffs, manifest) {
  const changedPaths = new Set(diffs.map((d) => d.path));
  const impacted = /* @__PURE__ */ new Set();
  const reverseDeps = /* @__PURE__ */ new Map();
  for (const edge of manifest.dependencyGraph.edges) {
    if (!reverseDeps.has(edge.to)) {
      reverseDeps.set(edge.to, /* @__PURE__ */ new Set());
    }
    reverseDeps.get(edge.to).add(edge.from);
  }
  const queue = [...changedPaths];
  const visited = new Set(changedPaths);
  while (queue.length > 0) {
    const current = queue.shift();
    const dependents = reverseDeps.get(current);
    if (!dependents) continue;
    for (const dep of dependents) {
      if (!visited.has(dep)) {
        visited.add(dep);
        impacted.add(dep);
        queue.push(dep);
      }
    }
  }
  for (const changed of changedPaths) {
    impacted.delete(changed);
  }
  return [...impacted];
}
async function isManifestValid(manifestPath) {
  try {
    await (0, import_promises9.access)(manifestPath);
    const content = await (0, import_promises9.readFile)(manifestPath, "utf-8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed?.modules);
  } catch {
    return false;
  }
}
async function loadSyncState(statePath) {
  try {
    const content = await (0, import_promises9.readFile)(statePath, "utf-8");
    const parsed = JSON.parse(content);
    if (typeof parsed?.lastCommitSha !== "string" || typeof parsed?.lastSyncedAt !== "string" || typeof parsed?.manifestPath !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
async function saveSyncState(statePath, state) {
  await (0, import_promises9.mkdir)(import_path19.default.dirname(statePath), { recursive: true });
  await (0, import_promises9.writeFile)(statePath, JSON.stringify(state, null, 2));
}
async function loadManifest(manifestPath) {
  try {
    const content = await (0, import_promises9.readFile)(manifestPath, "utf-8");
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed?.modules)) return void 0;
    return parsed;
  } catch {
    return void 0;
  }
}
async function saveManifest(manifestPath, manifest) {
  await (0, import_promises9.mkdir)(import_path19.default.dirname(manifestPath), { recursive: true });
  await (0, import_promises9.writeFile)(manifestPath, JSON.stringify(manifest, null, 2));
}
var import_simple_git3, import_promises9, import_path19;
var init_engine2 = __esm({
  "src/sync/engine.ts"() {
    "use strict";
    import_simple_git3 = __toESM(require("simple-git"), 1);
    import_promises9 = require("fs/promises");
    import_path19 = __toESM(require("path"), 1);
    init_engine();
  }
});

// src/cli/commands/sync.ts
var sync_exports = {};
__export(sync_exports, {
  syncCommand: () => syncCommand
});
async function syncCommand(options) {
  if (options.verbose) setVerbose(true);
  header("Sync Documentation");
  const { config, filepath } = options.config ? await loadConfigFile(options.config) : await loadConfig();
  log("success", `Config loaded from ${import_chalk6.default.dim(filepath)}`);
  const repoRoot = resolveRepoRoot(config.source);
  const syncConfig = {
    ...config.sync,
    ...options.full && { diff_strategy: "full" }
  };
  log("info", "Running sync...");
  const result = await runSync({
    repoRoot,
    source: config.source,
    analysis: config.analysis,
    sync: syncConfig,
    dryRun: options.dryRun,
    since: options.since,
    onProgress: (msg) => log("debug", msg)
  });
  blank();
  if (result.diffs.length === 0) {
    log("success", "Documentation is up to date \u2014 no changes detected");
    return;
  }
  log("success", `Sync complete (${(result.duration / 1e3).toFixed(1)}s)`);
  blank();
  console.log(import_chalk6.default.dim("  Summary:"));
  console.log(`    Files changed:        ${import_chalk6.default.cyan(result.diffs.length.toString())}`);
  console.log(`    Modules re-analyzed:  ${import_chalk6.default.cyan(result.modulesReanalyzed.toString())}`);
  console.log(`    Pages rebuilt:        ${import_chalk6.default.cyan(result.pagesRebuilt.toString())}`);
  console.log(`    Pages created:        ${import_chalk6.default.green(result.pagesCreated.toString())}`);
  console.log(`    Pages deleted:        ${import_chalk6.default.red(result.pagesDeleted.toString())}`);
  if (result.impactedModules.length > 0) {
    console.log(`    Impacted downstream:  ${import_chalk6.default.yellow(result.impactedModules.length.toString())}`);
  }
  console.log(`    Commit range:         ${import_chalk6.default.dim(`${result.previousCommit.slice(0, 8)}..${result.currentCommit.slice(0, 8)}`)}`);
  blank();
  if (options.dryRun) {
    log("info", "Dry run \u2014 no files were modified");
    blank();
    console.log(import_chalk6.default.dim("  Changed files:"));
    for (const diff of result.diffs) {
      const icon = diff.status === "added" ? import_chalk6.default.green("+") : diff.status === "deleted" ? import_chalk6.default.red("-") : import_chalk6.default.yellow("~");
      console.log(`    ${icon} ${diff.path}`);
    }
    blank();
  }
}
var import_chalk6;
var init_sync = __esm({
  "src/cli/commands/sync.ts"() {
    "use strict";
    import_chalk6 = __toESM(require("chalk"), 1);
    init_loader();
    init_engine2();
    init_logger();
    init_utils2();
  }
});

// src/utils/cli-tools.ts
function isCommandNotFound(error) {
  if (!error || typeof error !== "object") return false;
  const err = error;
  if (err.code === "ENOENT") return true;
  if (err.exitCode === 127) return true;
  if (typeof err.message === "string" && err.message.includes("is not recognized")) {
    return true;
  }
  return false;
}
async function runTool(command, args, options) {
  const { execa } = await import("execa");
  try {
    return await execa(command, args, options);
  } catch (error) {
    const toolName = command === "npx" ? args[0] || command : command;
    if (isCommandNotFound(error)) {
      const info = TOOL_INFO[toolName];
      if (info) {
        throw new ToolNotFoundError(info.name, info.install, info.docs);
      }
      throw new ToolNotFoundError(
        toolName,
        `Install ${toolName} and ensure it is available in your PATH`,
        ""
      );
    }
    throw error;
  }
}
function formatToolError(error) {
  const lines = [];
  lines.push(import_chalk7.default.red(`  \u2717 ${error.message}`));
  lines.push("");
  lines.push(import_chalk7.default.dim("  To install:"));
  lines.push(`    ${import_chalk7.default.cyan(error.installHint)}`);
  if (error.docsUrl) {
    lines.push("");
    lines.push(import_chalk7.default.dim("  Documentation:"));
    lines.push(`    ${import_chalk7.default.dim(error.docsUrl)}`);
  }
  return lines.join("\n");
}
var import_chalk7, ZENSICAL_PACKAGES, ZENSICAL_INSTALL_CMD, TOOL_INFO, ToolNotFoundError;
var init_cli_tools = __esm({
  "src/utils/cli-tools.ts"() {
    "use strict";
    import_chalk7 = __toESM(require("chalk"), 1);
    ZENSICAL_PACKAGES = ["zensical"];
    ZENSICAL_INSTALL_CMD = `pip install ${ZENSICAL_PACKAGES.join(" ")}`;
    TOOL_INFO = {
      wrangler: {
        name: "Wrangler (Cloudflare CLI)",
        install: "npm install -g wrangler",
        docs: "https://developers.cloudflare.com/workers/wrangler/install-and-update/"
      },
      vercel: {
        name: "Vercel CLI",
        install: "npm install -g vercel",
        docs: "https://vercel.com/docs/cli"
      },
      zensical: {
        name: "Zensical",
        install: ZENSICAL_INSTALL_CMD,
        docs: "https://zensical.dev/getting-started/"
      },
      gh: {
        name: "GitHub CLI",
        install: "https://cli.github.com \u2014 follow install instructions for your OS",
        docs: "https://cli.github.com/manual/"
      },
      netlify: {
        name: "Netlify CLI",
        install: "npm install -g netlify-cli",
        docs: "https://docs.netlify.com/cli/get-started/"
      },
      aws: {
        name: "AWS CLI",
        install: "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html",
        docs: "https://docs.aws.amazon.com/cli/latest/reference/"
      }
    };
    ToolNotFoundError = class extends Error {
      constructor(tool, installHint, docsUrl) {
        super(`${tool} is not installed or not found in PATH`);
        this.tool = tool;
        this.installHint = installHint;
        this.docsUrl = docsUrl;
        this.name = "ToolNotFoundError";
      }
    };
  }
});

// src/deploy/providers/github-pages.ts
var import_promises10, import_path20, GitHubPagesProvider;
var init_github_pages = __esm({
  "src/deploy/providers/github-pages.ts"() {
    "use strict";
    init_cli_tools();
    import_promises10 = require("fs/promises");
    import_path20 = __toESM(require("path"), 1);
    GitHubPagesProvider = class {
      id = "gh-pages";
      name = "GitHub Pages";
      async checkAuth() {
        const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
        if (token) {
          return { authenticated: true, message: "GitHub token found" };
        }
        try {
          await runTool("gh", ["auth", "status"]);
          return { authenticated: true, message: "Authenticated via gh CLI" };
        } catch {
          return {
            authenticated: false,
            message: "No GitHub authentication found. Set GITHUB_TOKEN or run `gh auth login`."
          };
        }
      }
      async setupProject(deploy, domain) {
        return { projectId: deploy.project || "docs" };
      }
      async deploy(buildDir, deploy, domain) {
        if (domain.custom) {
          const cnamePath = import_path20.default.join(buildDir, "CNAME");
          await (0, import_promises10.writeFile)(cnamePath, domain.custom);
        }
        return {
          url: domain.custom ? `https://${domain.custom}${domain.base_path}` : `https://<username>.github.io/<repo>${domain.base_path}`,
          provider: this.id,
          projectId: deploy.project || "docs",
          domain: domain.custom,
          ssl: true
        };
      }
      async undeploy(deploy, domain) {
        try {
          await runTool("gh", [
            "api",
            "--method",
            "DELETE",
            "repos/{owner}/{repo}/pages"
          ]);
          return {
            success: true,
            message: "GitHub Pages has been disabled for this repository"
          };
        } catch {
          return {
            success: false,
            message: "Could not disable GitHub Pages automatically. Go to Settings \u2192 Pages in your repository to disable it manually."
          };
        }
      }
      async configureDomain(domain, deploy) {
        if (!domain.custom) {
          return { configured: true };
        }
        const isSubdomain = domain.custom.split(".").length > 2;
        const dnsRecords = isSubdomain ? [
          {
            type: "CNAME",
            name: domain.custom.split(".")[0],
            value: "<username>.github.io"
          }
        ] : [
          { type: "A", name: "@", value: "185.199.108.153" },
          { type: "A", name: "@", value: "185.199.109.153" },
          { type: "A", name: "@", value: "185.199.110.153" },
          { type: "A", name: "@", value: "185.199.111.153" }
        ];
        return { configured: false, dnsRecords };
      }
      async generateCIConfig(deploy, domain) {
        const content = `# DocWalk \u2014 GitHub Pages Deployment
# Auto-generated by DocWalk. Modify with care.

name: Deploy Documentation

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install DocWalk
        run: npm install -g docwalk

      - name: Install Zensical
        run: ${ZENSICAL_INSTALL_CMD}

      - name: DocWalk Sync and Generate
        run: |
          docwalk sync
          docwalk generate

      - name: Build Site
        run: zensical build --config-file docwalk-output/mkdocs.yml --site-dir site

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: site

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;
        return {
          path: ".github/workflows/docwalk-deploy.yml",
          content
        };
      }
      async generatePreviewCIConfig(deploy, domain) {
        const content = `# DocWalk \u2014 PR Preview Deployment
# Auto-generated by DocWalk. Builds docs on PR and posts a preview artifact link.

name: PR Documentation Preview

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install DocWalk
        run: npm install -g docwalk

      - name: Install Zensical
        run: ${ZENSICAL_INSTALL_CMD}

      - name: DocWalk Generate
        run: docwalk generate --full

      - name: Build Site
        run: zensical build --config-file docwalk-output/mkdocs.yml --site-dir site

      - name: Upload preview artifact
        uses: actions/upload-artifact@v4
        with:
          name: docs-preview-pr-\${{ github.event.pull_request.number }}
          path: site
          retention-days: 5

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            const runUrl = \`\${context.serverUrl}/\${context.repo.owner}/\${context.repo.repo}/actions/runs/\${context.runId}\`;
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: \`## Documentation Preview\\n\\nDocs preview built successfully.\\n\\nDownload the preview artifact from the [workflow run](\${runUrl}).\\n\\n> _Generated by DocWalk_\`
            });
`;
        return {
          path: ".github/workflows/docwalk-preview.yml",
          content
        };
      }
    };
  }
});

// src/deploy/providers/cloudflare.ts
var CloudflareProvider;
var init_cloudflare = __esm({
  "src/deploy/providers/cloudflare.ts"() {
    "use strict";
    init_cli_tools();
    CloudflareProvider = class {
      id = "cloudflare";
      name = "Cloudflare Pages";
      async checkAuth() {
        const token = process.env.CLOUDFLARE_API_TOKEN;
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        if (token && accountId) {
          return { authenticated: true, message: "Cloudflare credentials found" };
        }
        try {
          await runTool("npx", ["wrangler", "whoami"]);
          return {
            authenticated: true,
            message: "Authenticated via Wrangler CLI"
          };
        } catch (error) {
          if (error instanceof ToolNotFoundError) {
            return { authenticated: false, message: error.message };
          }
          return {
            authenticated: false,
            message: "Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, or run `npx wrangler login`."
          };
        }
      }
      async setupProject(deploy, domain) {
        const projectName = deploy.project || "docwalk-docs";
        try {
          await runTool("npx", [
            "wrangler",
            "pages",
            "project",
            "create",
            projectName,
            "--production-branch",
            "main"
          ]);
        } catch {
        }
        return { projectId: projectName };
      }
      async deploy(buildDir, deploy, domain) {
        const projectName = deploy.project || "docwalk-docs";
        const result = await runTool("npx", [
          "wrangler",
          "pages",
          "deploy",
          buildDir,
          "--project-name",
          projectName
        ]);
        const stdout = String(result.stdout ?? "");
        const urlMatch = stdout.match(/https:\/\/[^\s]+\.pages\.dev/);
        const url = urlMatch?.[0] || `https://${projectName}.pages.dev`;
        return {
          url: domain.custom ? `https://${domain.custom}${domain.base_path}` : url,
          previewUrl: url,
          provider: this.id,
          projectId: projectName,
          domain: domain.custom,
          ssl: true
        };
      }
      async undeploy(deploy, domain) {
        const projectName = deploy.project || "docwalk-docs";
        try {
          await runTool("npx", [
            "wrangler",
            "pages",
            "project",
            "delete",
            projectName,
            "--yes"
          ]);
          return {
            success: true,
            message: `Cloudflare Pages project '${projectName}' has been deleted`
          };
        } catch (error) {
          if (error instanceof ToolNotFoundError) {
            return { success: false, message: error.message };
          }
          return {
            success: false,
            message: `Could not delete Cloudflare Pages project '${projectName}'. Delete it manually from the Cloudflare dashboard.`
          };
        }
      }
      async configureDomain(domain, deploy) {
        if (!domain.custom) {
          return { configured: true };
        }
        const projectName = deploy.project || "docwalk-docs";
        try {
          await runTool("npx", [
            "wrangler",
            "pages",
            "project",
            "add-custom-domain",
            projectName,
            domain.custom
          ]);
          return { configured: true };
        } catch {
          return {
            configured: false,
            dnsRecords: [
              {
                type: "CNAME",
                name: domain.custom.split(".")[0],
                value: `${projectName}.pages.dev`
              }
            ]
          };
        }
      }
      async generateCIConfig(deploy, domain) {
        const projectName = deploy.project || "docwalk-docs";
        const content = `# DocWalk \u2014 Cloudflare Pages Deployment
# Auto-generated by DocWalk. Modify with care.

name: Deploy Documentation

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install DocWalk
        run: npm install -g docwalk

      - name: Install Zensical
        run: ${ZENSICAL_INSTALL_CMD}

      - name: DocWalk Sync and Generate
        run: |
          docwalk sync
          docwalk generate

      - name: Build Site
        run: zensical build --config-file docwalk-output/mkdocs.yml --site-dir site

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy site --project-name ${projectName}
`;
        return {
          path: ".github/workflows/docwalk-deploy.yml",
          content
        };
      }
      async generatePreviewCIConfig(deploy, domain) {
        const projectName = deploy.project || "docwalk-docs";
        const content = `# DocWalk \u2014 PR Preview Deployment (Cloudflare Pages)
# Auto-generated by DocWalk. Deploys a preview branch on each PR.

name: PR Documentation Preview

on:
  pull_request:
    branches: [main]

jobs:
  preview:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      deployments: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install DocWalk
        run: npm install -g docwalk

      - name: Install Zensical
        run: ${ZENSICAL_INSTALL_CMD}

      - name: DocWalk Generate
        run: docwalk generate --full

      - name: Build Site
        run: zensical build --config-file docwalk-output/mkdocs.yml --site-dir site

      - name: Deploy Preview to Cloudflare Pages
        id: deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy site --project-name ${projectName} --branch pr-\${{ github.event.pull_request.number }}

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            const previewUrl = \`https://pr-\${{ github.event.pull_request.number }}.${projectName}.pages.dev\`;
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: \`## Documentation Preview\\n\\nPreview deployed to: \${previewUrl}\\n\\n> _Generated by DocWalk_\`
            });
`;
        return {
          path: ".github/workflows/docwalk-preview.yml",
          content
        };
      }
    };
  }
});

// src/deploy/providers/vercel.ts
var import_promises11, import_path21, VercelProvider;
var init_vercel = __esm({
  "src/deploy/providers/vercel.ts"() {
    "use strict";
    init_cli_tools();
    import_promises11 = require("fs/promises");
    import_path21 = __toESM(require("path"), 1);
    VercelProvider = class {
      id = "vercel";
      name = "Vercel";
      async checkAuth() {
        const token = process.env.VERCEL_TOKEN;
        if (token) {
          return { authenticated: true, message: "Vercel token found" };
        }
        try {
          await runTool("npx", ["vercel", "whoami"]);
          return { authenticated: true, message: "Authenticated via Vercel CLI" };
        } catch (error) {
          if (error instanceof ToolNotFoundError) {
            return { authenticated: false, message: error.message };
          }
          return {
            authenticated: false,
            message: "Set VERCEL_TOKEN or run `npx vercel login`."
          };
        }
      }
      async setupProject(deploy, domain) {
        const projectName = deploy.project || "docwalk-docs";
        return { projectId: projectName };
      }
      async deploy(buildDir, deploy, domain) {
        const vercelConfig = {
          version: 2,
          name: deploy.project || "docwalk-docs",
          builds: [{ src: "**", use: "@vercel/static" }],
          routes: [
            { handle: "filesystem" },
            { src: "/(.*)", dest: "/index.html" }
          ]
        };
        await (0, import_promises11.writeFile)(
          import_path21.default.join(buildDir, "vercel.json"),
          JSON.stringify(vercelConfig, null, 2)
        );
        const args = ["vercel", "--prod", "--yes", buildDir];
        if (process.env.VERCEL_TOKEN) {
          args.push("--token", process.env.VERCEL_TOKEN);
        }
        const result = await runTool("npx", args);
        const stdout = String(result.stdout ?? "");
        const url = stdout.trim().split("\n").pop() || "";
        return {
          url: domain.custom ? `https://${domain.custom}${domain.base_path}` : url,
          previewUrl: url,
          provider: this.id,
          projectId: deploy.project || "docwalk-docs",
          domain: domain.custom,
          ssl: true
        };
      }
      async undeploy(deploy, domain) {
        const projectName = deploy.project || "docwalk-docs";
        try {
          await runTool("npx", ["vercel", "rm", projectName, "--yes"]);
          return {
            success: true,
            message: `Vercel project '${projectName}' has been removed`
          };
        } catch (error) {
          if (error instanceof ToolNotFoundError) {
            return { success: false, message: error.message };
          }
          return {
            success: false,
            message: `Could not remove Vercel project '${projectName}'. Delete it manually from the Vercel dashboard.`
          };
        }
      }
      async configureDomain(domain, deploy) {
        if (!domain.custom) return { configured: true };
        try {
          await runTool("npx", ["vercel", "domains", "add", domain.custom]);
          return { configured: true };
        } catch {
          return {
            configured: false,
            dnsRecords: [
              {
                type: "CNAME",
                name: domain.custom.split(".")[0],
                value: "cname.vercel-dns.com"
              }
            ]
          };
        }
      }
      async generateCIConfig(deploy, domain) {
        const content = `# DocWalk \u2014 Vercel Deployment
# Auto-generated by DocWalk. Modify with care.

name: Deploy Documentation

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install DocWalk
        run: npm install -g docwalk

      - name: Install Zensical
        run: ${ZENSICAL_INSTALL_CMD}

      - name: DocWalk Sync and Generate
        run: |
          docwalk sync
          docwalk generate

      - name: Build Site
        run: zensical build --config-file docwalk-output/mkdocs.yml --site-dir site

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: site
          vercel-args: --prod
`;
        return {
          path: ".github/workflows/docwalk-deploy.yml",
          content
        };
      }
      async generatePreviewCIConfig(deploy, domain) {
        const content = `# DocWalk \u2014 PR Preview Deployment (Vercel)
# Auto-generated by DocWalk. Deploys a preview on each PR.

name: PR Documentation Preview

on:
  pull_request:
    branches: [main]

jobs:
  preview:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install DocWalk
        run: npm install -g docwalk

      - name: Install Zensical
        run: ${ZENSICAL_INSTALL_CMD}

      - name: DocWalk Generate
        run: docwalk generate --full

      - name: Build Site
        run: zensical build --config-file docwalk-output/mkdocs.yml --site-dir site

      - name: Deploy Preview to Vercel
        id: deploy
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: site

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            const previewUrl = '\${{ steps.deploy.outputs.preview-url }}';
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: \`## Documentation Preview\\n\\nPreview deployed to: \${previewUrl}\\n\\n> _Generated by DocWalk_\`
            });
`;
        return {
          path: ".github/workflows/docwalk-preview.yml",
          content
        };
      }
    };
  }
});

// src/deploy/providers/netlify.ts
var NetlifyProvider;
var init_netlify = __esm({
  "src/deploy/providers/netlify.ts"() {
    "use strict";
    init_cli_tools();
    NetlifyProvider = class {
      id = "netlify";
      name = "Netlify";
      async checkAuth() {
        const token = process.env.NETLIFY_AUTH_TOKEN;
        if (token) {
          return { authenticated: true, message: "Netlify auth token found" };
        }
        try {
          await runTool("netlify", ["status"]);
          return {
            authenticated: true,
            message: "Authenticated via Netlify CLI"
          };
        } catch (error) {
          if (error instanceof ToolNotFoundError) {
            return { authenticated: false, message: error.message };
          }
          return {
            authenticated: false,
            message: "Set NETLIFY_AUTH_TOKEN or run `netlify login`."
          };
        }
      }
      async setupProject(deploy, domain) {
        const projectName = deploy.project || "docwalk-docs";
        try {
          await runTool("netlify", ["sites:create", "--name", projectName]);
        } catch {
        }
        return { projectId: projectName };
      }
      async deploy(buildDir, deploy, domain) {
        const projectName = deploy.project || "docwalk-docs";
        const result = await runTool("netlify", [
          "deploy",
          "--dir",
          buildDir,
          "--prod",
          "--site",
          projectName
        ]);
        const stdout = String(result.stdout ?? "");
        const urlMatch = stdout.match(/https:\/\/[^\s]+\.netlify\.app/);
        const url = urlMatch?.[0] || `https://${projectName}.netlify.app`;
        return {
          url: domain.custom ? `https://${domain.custom}${domain.base_path}` : url,
          previewUrl: url,
          provider: this.id,
          projectId: projectName,
          domain: domain.custom,
          ssl: true
        };
      }
      async undeploy(deploy, domain) {
        const projectName = deploy.project || "docwalk-docs";
        try {
          await runTool("netlify", [
            "sites:delete",
            "--site",
            projectName,
            "--force"
          ]);
          return {
            success: true,
            message: `Netlify site '${projectName}' has been deleted`
          };
        } catch (error) {
          if (error instanceof ToolNotFoundError) {
            return { success: false, message: error.message };
          }
          return {
            success: false,
            message: `Could not delete Netlify site '${projectName}'. Delete it manually from the Netlify dashboard.`
          };
        }
      }
      async configureDomain(domain, deploy) {
        if (!domain.custom) {
          return { configured: true };
        }
        const projectName = deploy.project || "docwalk-docs";
        return {
          configured: false,
          dnsRecords: [
            {
              type: "CNAME",
              name: domain.custom.split(".")[0],
              value: `${projectName}.netlify.app`
            }
          ]
        };
      }
      async generateCIConfig(deploy, domain) {
        const content = `# DocWalk \u2014 Netlify Deployment
# Auto-generated by DocWalk. Modify with care.

name: Deploy Documentation

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install DocWalk
        run: npm install -g docwalk

      - name: Install Zensical
        run: ${ZENSICAL_INSTALL_CMD}

      - name: DocWalk Sync and Generate
        run: |
          docwalk sync
          docwalk generate

      - name: Build Site
        run: zensical build --config-file docwalk-output/mkdocs.yml --site-dir site

      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v3
        with:
          publish-dir: ./site
          production-deploy: true
          github-token: \${{ secrets.GITHUB_TOKEN }}
        env:
          NETLIFY_AUTH_TOKEN: \${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: \${{ secrets.NETLIFY_SITE_ID }}
`;
        return {
          path: ".github/workflows/docwalk-deploy.yml",
          content
        };
      }
      async generatePreviewCIConfig(deploy, domain) {
        const content = `# DocWalk \u2014 PR Preview Deployment (Netlify)
# Auto-generated by DocWalk. Deploys a preview on each PR.

name: PR Documentation Preview

on:
  pull_request:
    branches: [main]

jobs:
  preview:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install DocWalk
        run: npm install -g docwalk

      - name: Install Zensical
        run: ${ZENSICAL_INSTALL_CMD}

      - name: DocWalk Generate
        run: docwalk generate --full

      - name: Build Site
        run: zensical build --config-file docwalk-output/mkdocs.yml --site-dir site

      - name: Deploy Preview to Netlify
        id: deploy
        uses: nwtgck/actions-netlify@v3
        with:
          publish-dir: ./site
          production-deploy: false
          github-token: \${{ secrets.GITHUB_TOKEN }}
          deploy-message: "PR #\${{ github.event.pull_request.number }} preview"
        env:
          NETLIFY_AUTH_TOKEN: \${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: \${{ secrets.NETLIFY_SITE_ID }}

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            const deployUrl = '\${{ steps.deploy.outputs.deploy-url }}';
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: \`## Documentation Preview\\n\\nPreview deployed to: \${deployUrl}\\n\\n> _Generated by DocWalk_\`
            });
`;
        return {
          path: ".github/workflows/docwalk-preview.yml",
          content
        };
      }
    };
  }
});

// src/deploy/providers/s3.ts
var S3Provider;
var init_s3 = __esm({
  "src/deploy/providers/s3.ts"() {
    "use strict";
    init_cli_tools();
    S3Provider = class {
      id = "s3";
      name = "AWS S3";
      async checkAuth() {
        const accessKey = process.env.AWS_ACCESS_KEY_ID;
        const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
        if (accessKey && secretKey) {
          return { authenticated: true, message: "AWS credentials found" };
        }
        try {
          await runTool("aws", ["sts", "get-caller-identity"]);
          return {
            authenticated: true,
            message: "Authenticated via AWS CLI"
          };
        } catch (error) {
          if (error instanceof ToolNotFoundError) {
            return { authenticated: false, message: error.message };
          }
          return {
            authenticated: false,
            message: "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or configure AWS CLI with `aws configure`."
          };
        }
      }
      async setupProject(deploy, domain) {
        const bucketName = deploy.project || "docwalk-docs";
        const region = deploy.provider_config?.region || "us-east-1";
        try {
          await runTool("aws", [
            "s3",
            "mb",
            `s3://${bucketName}`,
            "--region",
            region
          ]);
          await runTool("aws", [
            "s3",
            "website",
            `s3://${bucketName}`,
            "--index-document",
            "index.html",
            "--error-document",
            "404.html"
          ]);
        } catch {
        }
        return { projectId: bucketName };
      }
      async deploy(buildDir, deploy, domain) {
        const bucketName = deploy.project || "docwalk-docs";
        const region = deploy.provider_config?.region || "us-east-1";
        const cloudFrontId = deploy.provider_config?.cloudfront_distribution_id;
        await runTool("aws", [
          "s3",
          "sync",
          buildDir,
          `s3://${bucketName}`,
          "--delete",
          "--region",
          region
        ]);
        if (cloudFrontId) {
          try {
            await runTool("aws", [
              "cloudfront",
              "create-invalidation",
              "--distribution-id",
              cloudFrontId,
              "--paths",
              "/*"
            ]);
          } catch {
          }
        }
        const baseUrl = domain.custom ? `https://${domain.custom}${domain.base_path}` : `http://${bucketName}.s3-website-${region}.amazonaws.com`;
        return {
          url: baseUrl,
          provider: this.id,
          projectId: bucketName,
          domain: domain.custom,
          ssl: !!domain.custom || !!cloudFrontId
        };
      }
      async undeploy(deploy, domain) {
        const bucketName = deploy.project || "docwalk-docs";
        try {
          await runTool("aws", [
            "s3",
            "rm",
            `s3://${bucketName}`,
            "--recursive"
          ]);
          await runTool("aws", [
            "s3",
            "rb",
            `s3://${bucketName}`
          ]);
          return {
            success: true,
            message: `S3 bucket '${bucketName}' has been deleted`
          };
        } catch (error) {
          if (error instanceof ToolNotFoundError) {
            return { success: false, message: error.message };
          }
          return {
            success: false,
            message: `Could not delete S3 bucket '${bucketName}'. Delete it manually from the AWS console.`
          };
        }
      }
      async configureDomain(domain, deploy) {
        if (!domain.custom) {
          return { configured: true };
        }
        const bucketName = deploy.project || "docwalk-docs";
        const region = deploy.provider_config?.region || "us-east-1";
        return {
          configured: false,
          dnsRecords: [
            {
              type: "CNAME",
              name: domain.custom.split(".")[0],
              value: `${bucketName}.s3-website-${region}.amazonaws.com`
            }
          ]
        };
      }
      async generateCIConfig(deploy, domain) {
        const bucketName = deploy.project || "docwalk-docs";
        const region = deploy.provider_config?.region || "us-east-1";
        const cloudFrontId = deploy.provider_config?.cloudfront_distribution_id;
        const invalidationStep = cloudFrontId ? `
      - name: Invalidate CloudFront Cache
        run: aws cloudfront create-invalidation --distribution-id ${cloudFrontId} --paths "/*"
` : "";
        const content = `# DocWalk \u2014 AWS S3 Deployment
# Auto-generated by DocWalk. Modify with care.

name: Deploy Documentation

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install DocWalk
        run: npm install -g docwalk

      - name: Install Zensical
        run: ${ZENSICAL_INSTALL_CMD}

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${region}

      - name: DocWalk Sync and Generate
        run: |
          docwalk sync
          docwalk generate

      - name: Build Site
        run: zensical build --config-file docwalk-output/mkdocs.yml --site-dir site

      - name: Deploy to S3
        run: aws s3 sync site s3://${bucketName} --delete
${invalidationStep}`;
        return {
          path: ".github/workflows/docwalk-deploy.yml",
          content
        };
      }
      async generatePreviewCIConfig(deploy, domain) {
        const bucketName = deploy.project || "docwalk-docs";
        const region = deploy.provider_config?.region || "us-east-1";
        const content = `# DocWalk \u2014 PR Preview Deployment (AWS S3)
# Auto-generated by DocWalk. Deploys a preview to a PR-specific prefix.

name: PR Documentation Preview

on:
  pull_request:
    branches: [main]

jobs:
  preview:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      id-token: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install DocWalk
        run: npm install -g docwalk

      - name: Install Zensical
        run: ${ZENSICAL_INSTALL_CMD}

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${region}

      - name: DocWalk Generate
        run: docwalk generate --full

      - name: Build Site
        run: zensical build --config-file docwalk-output/mkdocs.yml --site-dir site

      - name: Deploy Preview to S3
        run: aws s3 sync site s3://${bucketName}/pr-\${{ github.event.pull_request.number }} --delete

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            const previewUrl = 'http://${bucketName}.s3-website-${region}.amazonaws.com/pr-\${{ github.event.pull_request.number }}';
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: \`## Documentation Preview\\n\\nPreview deployed to: \${previewUrl}\\n\\n> _Generated by DocWalk_\`
            });
`;
        return {
          path: ".github/workflows/docwalk-preview.yml",
          content
        };
      }
    };
  }
});

// src/deploy/index.ts
function registerProvider(provider) {
  providers.set(provider.id, provider);
}
function getProvider(id) {
  return providers.get(id);
}
var providers;
var init_deploy = __esm({
  "src/deploy/index.ts"() {
    "use strict";
    init_github_pages();
    init_cloudflare();
    init_vercel();
    init_netlify();
    init_s3();
    providers = /* @__PURE__ */ new Map();
    registerProvider(new GitHubPagesProvider());
    registerProvider(new CloudflareProvider());
    registerProvider(new VercelProvider());
    registerProvider(new NetlifyProvider());
    registerProvider(new S3Provider());
  }
});

// src/cli/commands/deploy.ts
var deploy_exports = {};
__export(deploy_exports, {
  deployCommand: () => deployCommand
});
async function deployCommand(options) {
  if (options.verbose) setVerbose(true);
  header("Deploy Documentation");
  const { config, filepath } = options.config ? await loadConfigFile(options.config) : await loadConfig();
  log("success", `Config loaded from ${import_chalk8.default.dim(filepath)}`);
  const deployConfig = {
    ...config.deploy,
    ...options.provider && { provider: options.provider }
  };
  const domainConfig = {
    ...config.domain,
    ...options.domain && { custom: options.domain }
  };
  const provider = getProvider(deployConfig.provider);
  if (!provider) {
    log("error", `Unknown provider: ${deployConfig.provider}`);
    log(
      "info",
      `Available providers: gh-pages, cloudflare, vercel`
    );
    process.exit(1);
  }
  log("info", `Checking ${provider.name} authentication...`);
  try {
    const auth = await provider.checkAuth();
    if (!auth.authenticated) {
      log("error", auth.message);
      process.exit(1);
    }
    log("success", auth.message);
  } catch (error) {
    if (error instanceof ToolNotFoundError) {
      console.log(formatToolError(error));
      process.exit(1);
    }
    throw error;
  }
  const buildDir = import_path22.default.resolve(deployConfig.output_dir || "site");
  if (!options.skipBuild) {
    log("info", "Building documentation site...");
    try {
      await runTool("zensical", [
        "build",
        "--config-file",
        "docwalk-output/mkdocs.yml",
        "--site-dir",
        buildDir
      ]);
      log("success", `Site built to ${import_chalk8.default.dim(buildDir)}`);
    } catch (error) {
      if (error instanceof ToolNotFoundError) {
        console.log(formatToolError(error));
        process.exit(1);
      }
      log("error", "Build failed. Is Zensical installed?");
      log("info", `Run: ${import_chalk8.default.cyan(ZENSICAL_INSTALL_CMD)}`);
      process.exit(1);
    }
  }
  log("info", `Setting up ${provider.name} project...`);
  try {
    const { projectId } = await provider.setupProject(deployConfig, domainConfig);
    log("success", `Project configured: ${import_chalk8.default.cyan(projectId)}`);
  } catch (error) {
    if (error instanceof ToolNotFoundError) {
      console.log(formatToolError(error));
      process.exit(1);
    }
    throw error;
  }
  await executeHooks("pre_deploy", config.hooks, { cwd: process.cwd() });
  log("info", "Deploying...");
  try {
    const result = await provider.deploy(buildDir, deployConfig, domainConfig);
    log("success", `Deployed to ${import_chalk8.default.cyan(result.url)}`);
    if (result.previewUrl && result.previewUrl !== result.url) {
      log("info", `Preview: ${import_chalk8.default.dim(result.previewUrl)}`);
    }
    if (domainConfig.custom) {
      log("info", `Configuring domain: ${import_chalk8.default.cyan(domainConfig.custom)}...`);
      const domainResult = await provider.configureDomain(
        domainConfig,
        deployConfig
      );
      if (domainResult.configured) {
        log("success", "Custom domain configured with SSL");
      } else if (domainResult.dnsRecords) {
        log("warn", "Manual DNS configuration required:");
        blank();
        for (const record of domainResult.dnsRecords) {
          console.log(
            `    ${import_chalk8.default.cyan(record.type)} ${import_chalk8.default.dim(record.name)} \u2192 ${record.value}`
          );
        }
        blank();
        log("info", "Add these records to your DNS provider, then re-run deploy.");
      }
    }
    await executeHooks("post_deploy", config.hooks, { cwd: process.cwd() });
    blank();
    log("success", "Deployment complete!");
    console.log(`
    ${import_chalk8.default.bold.hex("#5de4c7")("\u2192")} ${import_chalk8.default.bold(result.url)}
`);
  } catch (error) {
    if (error instanceof ToolNotFoundError) {
      console.log(formatToolError(error));
      process.exit(1);
    }
    throw error;
  }
}
var import_chalk8, import_path22;
var init_deploy2 = __esm({
  "src/cli/commands/deploy.ts"() {
    "use strict";
    import_chalk8 = __toESM(require("chalk"), 1);
    import_path22 = __toESM(require("path"), 1);
    init_loader();
    init_deploy();
    init_cli_tools();
    init_logger();
    init_hooks();
  }
});

// src/cli/commands/undeploy.ts
var undeploy_exports = {};
__export(undeploy_exports, {
  undeployCommand: () => undeployCommand
});
async function undeployCommand(options) {
  if (options.verbose) setVerbose(true);
  header("Undeploy Documentation");
  const { config, filepath } = options.config ? await loadConfigFile(options.config) : await loadConfig();
  log("success", `Config loaded from ${import_chalk9.default.dim(filepath)}`);
  const deployConfig = {
    ...config.deploy,
    ...options.provider && { provider: options.provider }
  };
  const provider = getProvider(deployConfig.provider);
  if (!provider) {
    log("error", `Unknown provider: ${deployConfig.provider}`);
    log(
      "info",
      `Available providers: gh-pages, cloudflare, vercel`
    );
    process.exit(1);
  }
  if (!options.force) {
    const projectName = deployConfig.project || "docwalk-docs";
    log(
      "warn",
      `This will remove the '${projectName}' deployment from ${provider.name}.`
    );
    log("info", `Use ${import_chalk9.default.cyan("--force")} to skip this confirmation.`);
    blank();
    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const answer = await new Promise((resolve) => {
      rl.question(
        import_chalk9.default.yellow("  Are you sure? (y/N) "),
        (ans) => {
          rl.close();
          resolve(ans.trim().toLowerCase());
        }
      );
    });
    if (answer !== "y" && answer !== "yes") {
      log("info", "Cancelled.");
      return;
    }
    blank();
  }
  log("info", `Removing deployment from ${provider.name}...`);
  try {
    const result = await provider.undeploy(deployConfig, config.domain);
    if (result.success) {
      log("success", result.message);
    } else {
      log("warn", result.message);
    }
  } catch (error) {
    if (error instanceof ToolNotFoundError) {
      console.log(formatToolError(error));
      process.exit(1);
    }
    throw error;
  }
  blank();
}
var import_chalk9;
var init_undeploy = __esm({
  "src/cli/commands/undeploy.ts"() {
    "use strict";
    import_chalk9 = __toESM(require("chalk"), 1);
    init_loader();
    init_deploy();
    init_cli_tools();
    init_logger();
  }
});

// src/cli/commands/dev.ts
var dev_exports = {};
__export(dev_exports, {
  devCommand: () => devCommand
});
async function startWatcher(repoRoot, include, verbose2) {
  const fs = await import("fs");
  const watchDirs = /* @__PURE__ */ new Set();
  for (const pattern of include) {
    const topDir = pattern.split("/")[0].replace(/\*.*$/, "");
    if (topDir) {
      const fullDir = import_path23.default.resolve(repoRoot, topDir);
      try {
        const stat2 = await fs.promises.stat(fullDir);
        if (stat2.isDirectory()) {
          watchDirs.add(fullDir);
        }
      } catch {
      }
    }
  }
  if (watchDirs.size === 0) {
    watchDirs.add(repoRoot);
  }
  let regenerating = false;
  let pendingRegenerate = false;
  async function regenerate() {
    if (regenerating) {
      pendingRegenerate = true;
      return;
    }
    regenerating = true;
    log("info", "Source files changed \u2014 regenerating docs...");
    try {
      await runTool("npx", ["tsx", "src/cli/index.ts", "generate", "--full"], {
        cwd: repoRoot,
        stdio: verbose2 ? "inherit" : "pipe"
      });
      log("success", "Docs regenerated. Zensical will pick up changes automatically.");
    } catch {
      log("warn", "Regeneration failed \u2014 check your source files for errors.");
    }
    regenerating = false;
    if (pendingRegenerate) {
      pendingRegenerate = false;
      await regenerate();
    }
  }
  let debounceTimer = null;
  for (const dir of watchDirs) {
    log("debug", `Watching ${import_chalk10.default.dim(dir)}`);
    const watcher = fs.watch(dir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      if (filename.includes("docwalk-output") || filename.includes(".docwalk")) {
        return;
      }
      if (!/\.(ts|tsx|js|jsx|py|go|rs|md)$/.test(filename)) {
        return;
      }
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        regenerate();
      }, 500);
    });
    watcher.unref();
  }
  log("success", `Watching ${watchDirs.size} source director${watchDirs.size === 1 ? "y" : "ies"} for changes`);
  blank();
}
async function devCommand(options) {
  if (options.verbose) setVerbose(true);
  header("Development Server");
  const { config } = options.config ? await loadConfigFile(options.config) : await loadConfig();
  const repoRoot = resolveRepoRoot(config.source);
  if (options.watch) {
    await startWatcher(repoRoot, config.source.include, !!options.verbose);
  }
  log("info", `Starting dev server on ${options.host}:${options.port}...`);
  blank();
  try {
    await runTool(
      "zensical",
      [
        "serve",
        "--config-file",
        "docwalk-output/mkdocs.yml",
        "--dev-addr",
        `${options.host}:${options.port}`
      ],
      { stdio: "inherit" }
    );
  } catch (error) {
    if (error instanceof ToolNotFoundError) {
      log("error", "Zensical is required to preview docs.");
      blank();
      log("info", "Install it with:");
      console.log(`    ${import_chalk10.default.cyan(ZENSICAL_INSTALL_CMD)}`);
      blank();
      log("info", "If you don't have Python installed:");
      console.log(`    ${import_chalk10.default.cyan("brew install python")}     ${import_chalk10.default.dim("# macOS")}`);
      console.log(`    ${import_chalk10.default.cyan("sudo apt install python3")} ${import_chalk10.default.dim("# Ubuntu/Debian")}`);
      blank();
      log("info", "Then run:");
      console.log(`    ${import_chalk10.default.cyan(ZENSICAL_INSTALL_CMD)}`);
      console.log(`    ${import_chalk10.default.cyan("docwalk dev")}`);
      process.exit(1);
    }
    log("error", "Failed to start Zensical dev server.");
    blank();
    log("info", "Make sure Zensical is installed:");
    console.log(`    ${import_chalk10.default.cyan(ZENSICAL_INSTALL_CMD)}`);
    blank();
    log("info", "Then generate docs first:");
    console.log(`    ${import_chalk10.default.cyan("docwalk generate")}`);
    process.exit(1);
  }
}
var import_chalk10, import_path23;
var init_dev = __esm({
  "src/cli/commands/dev.ts"() {
    "use strict";
    import_chalk10 = __toESM(require("chalk"), 1);
    import_path23 = __toESM(require("path"), 1);
    init_loader();
    init_cli_tools();
    init_logger();
    init_utils2();
  }
});

// src/cli/commands/status.ts
var status_exports = {};
__export(status_exports, {
  statusCommand: () => statusCommand
});
async function statusCommand(options) {
  header("DocWalk Status");
  try {
    const { config, filepath } = options.config ? await loadConfigFile(options.config) : await loadConfig();
    console.log(import_chalk11.default.dim("  Configuration"));
    console.log(`    Config file:    ${import_chalk11.default.cyan(filepath)}`);
    console.log(`    Repository:     ${import_chalk11.default.cyan(config.source.repo)}`);
    console.log(`    Branch:         ${config.source.branch}`);
    console.log(`    Provider:       ${config.deploy.provider}`);
    console.log(`    Domain:         ${config.domain.custom || import_chalk11.default.dim("(none)")}`);
    console.log(`    Base path:      ${config.domain.base_path}`);
    console.log(`    Sync trigger:   ${config.sync.trigger}`);
    console.log(`    Analysis depth: ${config.analysis.depth}`);
    console.log(`    AI summaries:   ${config.analysis.ai_summaries ? import_chalk11.default.green("enabled") : import_chalk11.default.dim("disabled")}`);
    blank();
    const statePath = import_path24.default.resolve(config.sync.state_file);
    try {
      const stateContent = await (0, import_promises12.readFile)(statePath, "utf-8");
      const state = JSON.parse(stateContent);
      console.log(import_chalk11.default.dim("  Sync State"));
      console.log(`    Last commit:    ${import_chalk11.default.cyan(state.lastCommitSha.slice(0, 8))}`);
      console.log(`    Last synced:    ${state.lastSyncedAt}`);
      console.log(`    Total pages:    ${state.totalPages}`);
      blank();
    } catch {
      console.log(import_chalk11.default.dim("  Sync State"));
      console.log(`    ${import_chalk11.default.yellow("Not synced yet")} \u2014 run ${import_chalk11.default.cyan("docwalk generate")} first`);
      blank();
    }
  } catch (error) {
    log("error", error.message);
    log("info", `Run ${import_chalk11.default.cyan("docwalk init")} to set up DocWalk`);
  }
}
var import_chalk11, import_path24, import_promises12;
var init_status = __esm({
  "src/cli/commands/status.ts"() {
    "use strict";
    import_chalk11 = __toESM(require("chalk"), 1);
    import_path24 = __toESM(require("path"), 1);
    import_promises12 = require("fs/promises");
    init_loader();
    init_logger();
  }
});

// src/cli/commands/doctor.ts
var doctor_exports = {};
__export(doctor_exports, {
  doctorCommand: () => doctorCommand
});
async function getCommandOutput(command, args) {
  try {
    const { execa } = await import("execa");
    const result = await execa(command, args);
    return (result.stdout ?? "").trim();
  } catch {
    return null;
  }
}
async function checkPython() {
  const output = await getCommandOutput("python3", ["--version"]);
  if (output) {
    const version = output.replace("Python ", "");
    return { name: "Python", ok: true, version };
  }
  return { name: "Python", ok: false, detail: "not found \u2014 install python3" };
}
async function checkPip() {
  const output = await getCommandOutput("pip3", ["--version"]);
  if (output) {
    const match = output.match(/pip\s+([\d.]+)/);
    const version = match?.[1] ?? "unknown";
    return { name: "pip", ok: true, version };
  }
  const fallback = await getCommandOutput("pip", ["--version"]);
  if (fallback) {
    const match = fallback.match(/pip\s+([\d.]+)/);
    const version = match?.[1] ?? "unknown";
    return { name: "pip", ok: true, version };
  }
  return { name: "pip", ok: false, detail: "not found \u2014 install pip3" };
}
async function checkPackage(pkg) {
  const output = await getCommandOutput("pip3", ["show", pkg]);
  if (output) {
    const match = output.match(/Version:\s*(.+)/);
    const version = match?.[1]?.trim();
    return { name: pkg, ok: true, version };
  }
  const fallback = await getCommandOutput("pip", ["show", pkg]);
  if (fallback) {
    const match = fallback.match(/Version:\s*(.+)/);
    const version = match?.[1]?.trim();
    return { name: pkg, ok: true, version };
  }
  return { name: pkg, ok: false, detail: "not installed" };
}
async function doctorCommand(options) {
  header("Doctor \u2014 Prerequisites Check");
  const results = [];
  results.push(await checkPython());
  results.push(await checkPip());
  for (const pkg of ZENSICAL_PACKAGES) {
    results.push(await checkPackage(pkg));
  }
  console.log(import_chalk12.default.bold("  Prerequisites"));
  console.log(import_chalk12.default.dim("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
  for (const result of results) {
    if (result.ok) {
      const version = result.version ? import_chalk12.default.dim(` ${result.version}`) : "";
      console.log(`  ${import_chalk12.default.green("\u2713")} ${result.name}${version}`);
    } else {
      const detail = result.detail ? import_chalk12.default.dim(` \u2014 ${result.detail}`) : "";
      console.log(`  ${import_chalk12.default.red("\u2717")} ${result.name}${detail}`);
    }
  }
  blank();
  const missing = results.filter((r) => !r.ok);
  if (missing.length === 0) {
    log("success", "All prerequisites satisfied!");
    return;
  }
  const missingSystem = missing.filter((r) => r.name === "Python" || r.name === "pip");
  const missingPackages = missing.filter((r) => r.name !== "Python" && r.name !== "pip");
  if (missingSystem.length > 0) {
    log("warn", "Python/pip must be installed first:");
    console.log(`    ${import_chalk12.default.cyan("brew install python")}     ${import_chalk12.default.dim("# macOS")}`);
    console.log(`    ${import_chalk12.default.cyan("sudo apt install python3")} ${import_chalk12.default.dim("# Ubuntu/Debian")}`);
    blank();
  }
  if (missingPackages.length > 0) {
    if (options.install) {
      log("info", "Installing missing packages...");
      blank();
      const packagesToInstall = missingPackages.map((r) => r.name);
      try {
        const { execa } = await import("execa");
        await execa("pip3", ["install", ...packagesToInstall], { stdio: "inherit" });
        blank();
        log("success", `Installed: ${packagesToInstall.join(", ")}`);
      } catch {
        try {
          const { execa } = await import("execa");
          await execa("pip", ["install", ...packagesToInstall], { stdio: "inherit" });
          blank();
          log("success", `Installed: ${packagesToInstall.join(", ")}`);
        } catch {
          blank();
          log("error", "Installation failed. Try manually:");
          console.log(`    ${import_chalk12.default.cyan(`pip install ${packagesToInstall.join(" ")}`)}`);
        }
      }
    } else {
      log("info", `Run ${import_chalk12.default.cyan("docwalk doctor --install")} to install missing packages.`);
    }
  }
}
var import_chalk12;
var init_doctor = __esm({
  "src/cli/commands/doctor.ts"() {
    "use strict";
    import_chalk12 = __toESM(require("chalk"), 1);
    init_cli_tools();
    init_logger();
  }
});

// src/cli/commands/ci-setup.ts
var ci_setup_exports = {};
__export(ci_setup_exports, {
  ciSetupCommand: () => ciSetupCommand
});
async function ciSetupCommand(options) {
  header("CI/CD Setup");
  const { config } = options.config ? await loadConfigFile(options.config) : await loadConfig();
  const providerId = options.provider || config.deploy.provider;
  const provider = getProvider(providerId);
  if (!provider) {
    log("error", `Unknown provider: ${providerId}`);
    process.exit(1);
  }
  log("info", `Generating ${provider.name} CI/CD configuration...`);
  const ciConfig = await provider.generateCIConfig(config.deploy, config.domain);
  const ciPath = import_path25.default.resolve(ciConfig.path);
  await (0, import_promises13.mkdir)(import_path25.default.dirname(ciPath), { recursive: true });
  await (0, import_promises13.writeFile)(ciPath, ciConfig.content);
  log("success", `Deploy workflow written to ${import_chalk13.default.cyan(ciConfig.path)}`);
  if (options.preview) {
    const previewConfig = await provider.generatePreviewCIConfig(
      config.deploy,
      config.domain
    );
    const previewPath = import_path25.default.resolve(previewConfig.path);
    await (0, import_promises13.mkdir)(import_path25.default.dirname(previewPath), { recursive: true });
    await (0, import_promises13.writeFile)(previewPath, previewConfig.content);
    log("success", `Preview workflow written to ${import_chalk13.default.cyan(previewConfig.path)}`);
  }
  blank();
  if (providerId === "cloudflare") {
    console.log(import_chalk13.default.dim("  Required GitHub Secrets:"));
    console.log(`    ${import_chalk13.default.cyan("CLOUDFLARE_API_TOKEN")}   \u2014 Cloudflare API token`);
    console.log(`    ${import_chalk13.default.cyan("CLOUDFLARE_ACCOUNT_ID")}  \u2014 Cloudflare account ID`);
  } else if (providerId === "vercel") {
    console.log(import_chalk13.default.dim("  Required GitHub Secrets:"));
    console.log(`    ${import_chalk13.default.cyan("VERCEL_TOKEN")}       \u2014 Vercel authentication token`);
    console.log(`    ${import_chalk13.default.cyan("VERCEL_ORG_ID")}      \u2014 Vercel organization ID`);
    console.log(`    ${import_chalk13.default.cyan("VERCEL_PROJECT_ID")}  \u2014 Vercel project ID`);
  }
  blank();
  log("info", `Commit ${import_chalk13.default.cyan(ciConfig.path)} to enable automatic deployments`);
  if (options.preview) {
    log("info", `Commit the preview workflow to enable PR previews`);
  }
  blank();
}
var import_chalk13, import_promises13, import_path25;
var init_ci_setup = __esm({
  "src/cli/commands/ci-setup.ts"() {
    "use strict";
    import_chalk13 = __toESM(require("chalk"), 1);
    import_promises13 = require("fs/promises");
    import_path25 = __toESM(require("path"), 1);
    init_loader();
    init_deploy();
    init_logger();
  }
});

// src/cli/commands/version.ts
var version_exports = {};
__export(version_exports, {
  versionDeployCommand: () => versionDeployCommand,
  versionListCommand: () => versionListCommand
});
async function versionListCommand(options) {
  if (options.verbose) setVerbose(true);
  header("Documentation Versions");
  const { config } = options.config ? await loadConfigFile(options.config) : await loadConfig();
  if (!config.versioning.enabled) {
    log("warn", "Versioning is not enabled in your configuration.");
    log("info", `Enable it by setting ${import_chalk14.default.cyan("versioning.enabled: true")} in docwalk.config.yml`);
    return;
  }
  const repoRoot = resolveRepoRoot(config.source);
  const git = (0, import_simple_git4.default)(repoRoot);
  const tagsResult = await git.tags();
  const pattern = new RegExp(config.versioning.tag_pattern);
  const matchingTags = tagsResult.all.filter((t) => pattern.test(t));
  if (matchingTags.length === 0) {
    log("info", "No version tags found matching pattern: " + import_chalk14.default.dim(config.versioning.tag_pattern));
    return;
  }
  const displayed = matchingTags.reverse().slice(0, config.versioning.max_versions);
  log("info", `Found ${matchingTags.length} version(s):`);
  blank();
  for (const tag of displayed) {
    console.log(`    ${import_chalk14.default.cyan(tag)}`);
  }
  blank();
  log("info", `Default alias: ${import_chalk14.default.cyan(config.versioning.default_alias)}`);
}
async function versionDeployCommand(tag, options) {
  if (options.verbose) setVerbose(true);
  header(`Deploy Version: ${tag}`);
  const { config } = options.config ? await loadConfigFile(options.config) : await loadConfig();
  if (!config.versioning.enabled) {
    log("error", "Versioning is not enabled in your configuration.");
    process.exit(1);
  }
  const repoRoot = resolveRepoRoot(config.source);
  const git = (0, import_simple_git4.default)(repoRoot);
  const tagsResult = await git.tags();
  if (!tagsResult.all.includes(tag)) {
    log("error", `Tag '${tag}' not found in repository.`);
    log("info", "Run " + import_chalk14.default.cyan("docwalk version list") + " to see available versions.");
    process.exit(1);
  }
  const alias = options.alias || config.versioning.default_alias;
  const setDefault = options.setDefault !== false;
  log("info", `Deploying version ${import_chalk14.default.cyan(tag)} with alias ${import_chalk14.default.cyan(alias)}...`);
  try {
    const mikeArgs = [
      "deploy",
      "--config-file",
      "docwalk-output/mkdocs.yml",
      tag,
      alias
    ];
    if (setDefault) {
      mikeArgs.push("--update-aliases");
    }
    await runTool("mike", mikeArgs);
    log("success", `Version ${import_chalk14.default.cyan(tag)} deployed as ${import_chalk14.default.cyan(alias)}`);
    if (setDefault) {
      await runTool("mike", [
        "set-default",
        "--config-file",
        "docwalk-output/mkdocs.yml",
        alias
      ]);
      log("success", `Default version set to ${import_chalk14.default.cyan(alias)}`);
    }
  } catch (error) {
    if (error instanceof ToolNotFoundError) {
      console.log(formatToolError(error));
      log("info", `Install mike: ${import_chalk14.default.cyan("pip install mike")}`);
      process.exit(1);
    }
    throw error;
  }
}
var import_chalk14, import_simple_git4;
var init_version = __esm({
  "src/cli/commands/version.ts"() {
    "use strict";
    import_chalk14 = __toESM(require("chalk"), 1);
    import_simple_git4 = __toESM(require("simple-git"), 1);
    init_loader();
    init_cli_tools();
    init_logger();
    init_utils2();
  }
});

// src/cli/index.ts
var import_commander = require("commander");
init_logger();
init_secrets();
var program = new import_commander.Command();
program.name("docwalk").description(
  "Your codebase, documented. Automatically.\nAnalyze repos, generate documentation sites, deploy anywhere."
).version("0.1.0").hook("preAction", async () => {
  await loadProjectEnv();
  banner();
});
program.command("init").description("Initialize DocWalk for a repository").option("-r, --repo <repo>", "Repository (owner/repo or local path)").option("-p, --provider <provider>", "Deploy provider (gh-pages, cloudflare, vercel)").option("-d, --domain <domain>", "Custom domain").option("-t, --theme <theme>", "Theme preset (developer, corporate, startup, minimal, api-reference, knowledge-base)").option("-l, --layout <layout>", "Navigation layout (tabs, sidebar)").option("--no-interactive", "Skip interactive prompts, use defaults").action(async (options) => {
  const { initCommand: initCommand2 } = await Promise.resolve().then(() => (init_init(), init_exports));
  await initCommand2(options);
});
program.command("generate").description("Analyze codebase and generate documentation").option("-c, --config <path>", "Config file path").option("-o, --output <dir>", "Output directory", "docwalk-output").option("--full", "Force full re-analysis (ignore cache)").option("--dry-run", "Show what would be generated without writing files").option("--ai", "Enable AI features using DOCWALK_AI_KEY environment variable").option("--try-mode", "Try mode: limit output and append upsell banners").option("-t, --theme <theme>", "Theme preset (developer, corporate, startup, minimal)").option("-l, --layout <layout>", "Navigation layout (tabs, sidebar, tabs-sticky)").option("-v, --verbose", "Verbose output").action(async (options) => {
  const { generateCommand: generateCommand2 } = await Promise.resolve().then(() => (init_generate(), generate_exports));
  await generateCommand2(options);
});
program.command("sync").description("Incremental sync \u2014 detect changes and update docs").option("-c, --config <path>", "Config file path").option("--dry-run", "Show diff without applying changes").option("--full", "Force full re-analysis instead of incremental").option("--since <commit>", "Diff from a specific commit SHA instead of last synced").option("-v, --verbose", "Verbose output").action(async (options) => {
  const { syncCommand: syncCommand2 } = await Promise.resolve().then(() => (init_sync(), sync_exports));
  await syncCommand2(options);
});
program.command("deploy").description("Deploy documentation to hosting provider").option("-c, --config <path>", "Config file path").option("-p, --provider <provider>", "Override deploy provider").option("-d, --domain <domain>", "Override custom domain").option("--skip-build", "Deploy existing build without rebuilding").option("-v, --verbose", "Verbose output").action(async (options) => {
  const { deployCommand: deployCommand2 } = await Promise.resolve().then(() => (init_deploy2(), deploy_exports));
  await deployCommand2(options);
});
program.command("undeploy").description("Remove deployment from hosting provider").option("-c, --config <path>", "Config file path").option("-p, --provider <provider>", "Override deploy provider").option("--force", "Skip confirmation prompt").option("-v, --verbose", "Verbose output").action(async (options) => {
  const { undeployCommand: undeployCommand2 } = await Promise.resolve().then(() => (init_undeploy(), undeploy_exports));
  await undeployCommand2(options);
});
program.command("dev").description("Start local preview server").option("-c, --config <path>", "Config file path").option("--port <port>", "Port number", "8000").option("--host <host>", "Host to bind to", "127.0.0.1").option("-w, --watch", "Watch source files and auto-regenerate docs").option("-v, --verbose", "Verbose output").action(async (options) => {
  const { devCommand: devCommand2 } = await Promise.resolve().then(() => (init_dev(), dev_exports));
  await devCommand2(options);
});
program.command("status").description("Show sync state, project info, and deployment status").option("-c, --config <path>", "Config file path").action(async (options) => {
  const { statusCommand: statusCommand2 } = await Promise.resolve().then(() => (init_status(), status_exports));
  await statusCommand2(options);
});
program.command("doctor").description("Check Zensical prerequisites and optionally install missing packages").option("--install", "Install missing Python packages").action(async (options) => {
  const { doctorCommand: doctorCommand2 } = await Promise.resolve().then(() => (init_doctor(), doctor_exports));
  await doctorCommand2(options);
});
program.command("ci-setup").description("Generate CI/CD pipeline configuration for your provider").option("-c, --config <path>", "Config file path").option("-p, --provider <provider>", "Override deploy provider").option("--preview", "Also generate PR preview deployment workflow").action(async (options) => {
  const { ciSetupCommand: ciSetupCommand2 } = await Promise.resolve().then(() => (init_ci_setup(), ci_setup_exports));
  await ciSetupCommand2(options);
});
var versionCmd = program.command("version").description("Manage versioned documentation (requires mike)");
versionCmd.command("list").description("List available documentation versions from git tags").option("-c, --config <path>", "Config file path").option("-v, --verbose", "Verbose output").action(async (options) => {
  const { versionListCommand: versionListCommand2 } = await Promise.resolve().then(() => (init_version(), version_exports));
  await versionListCommand2(options);
});
versionCmd.command("deploy <tag>").description("Deploy a specific version tag using mike").option("-c, --config <path>", "Config file path").option("-a, --alias <alias>", "Version alias (e.g., latest, stable)").option("--no-set-default", "Don't set this as the default version").option("-v, --verbose", "Verbose output").action(async (tag, options) => {
  const { versionDeployCommand: versionDeployCommand2 } = await Promise.resolve().then(() => (init_version(), version_exports));
  await versionDeployCommand2(tag, options);
});
program.parse();
