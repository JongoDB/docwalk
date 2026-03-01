// src/analysis/providers/base.ts
function buildModuleSummaryPrompt(module, fileContent) {
  const symbolList = module.symbols.filter((s) => s.exported).map((s) => {
    const params = s.parameters?.map((p) => `${p.name}: ${p.type || "any"}`).join(", ") || "";
    const ret = s.returns?.type ? ` \u2192 ${s.returns.type}` : "";
    const doc = s.docs?.summary ? ` \u2014 ${s.docs.summary}` : "";
    return `- ${s.kind} ${s.name}(${params})${ret}${doc}`;
  }).join("\n");
  const lines = fileContent.split("\n");
  const truncatedContent = lines.slice(0, 150).join("\n");
  return `Summarize this source file in 2-3 sentences for a documentation site. State what the module does, its main exports, and how it fits into a larger system.

File: ${module.filePath}
Language: ${module.language}
Lines: ${module.lineCount}
Exported symbols:
${symbolList || "(none)"}

Source code:
\`\`\`
${truncatedContent}
\`\`\`

Write only the summary \u2014 no preamble, no bullet points, just 2-3 clear sentences.`;
}
function buildSymbolSummaryPrompt(symbol, fileContent, filePath) {
  const lines = fileContent.split("\n");
  const startLine = Math.max(0, symbol.location.line - 3);
  const endLine = symbol.location.endLine ? Math.min(symbol.location.endLine + 2, lines.length) : Math.min(startLine + 40, lines.length);
  const snippet = lines.slice(startLine, endLine).join("\n");
  const paramInfo = symbol.parameters ? `Parameters: ${symbol.parameters.map((p) => `${p.name}${p.type ? `: ${p.type}` : ""}${p.optional ? " (optional)" : ""}`).join(", ")}` : "";
  return `Write a 1-2 sentence summary for this ${symbol.kind}. State what it does and when a developer would use it.

File: ${filePath}:${symbol.location.line}
Symbol: ${symbol.name} (${symbol.kind})
${paramInfo}
${symbol.returns?.type ? `Returns: ${symbol.returns.type}` : ""}
${symbol.docs?.summary ? `Existing doc: ${symbol.docs.summary}` : ""}

Code:
\`\`\`
${snippet}
\`\`\`

Write only the summary \u2014 no preamble, no code blocks.`;
}

// src/analysis/providers/anthropic.ts
var AnthropicProvider = class {
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
  async summarizeModule(module, fileContent) {
    return this.callAPI(buildModuleSummaryPrompt(module, fileContent));
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

// src/analysis/providers/openai.ts
var OpenAIProvider = class {
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
  async summarizeModule(module, fileContent) {
    return this.generate(buildModuleSummaryPrompt(module, fileContent));
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

// src/analysis/providers/gemini.ts
var GeminiProvider = class {
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
  async summarizeModule(module, fileContent) {
    return this.generate(buildModuleSummaryPrompt(module, fileContent));
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

// src/analysis/providers/ollama.ts
var DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";
var OllamaProvider = class extends OpenAIProvider {
  name = "Ollama (Local)";
  constructor(model, baseURL) {
    super("ollama", model || "llama3.2", baseURL || DEFAULT_OLLAMA_BASE_URL);
  }
};

// src/analysis/providers/openrouter.ts
var OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
var OpenRouterProvider = class extends OpenAIProvider {
  name = "OpenRouter";
  constructor(apiKey, model) {
    super(apiKey, model || "anthropic/claude-3.5-sonnet", OPENROUTER_BASE_URL);
  }
};

// src/analysis/providers/docwalk-proxy.ts
var DEFAULT_BASE_URL = "https://docwalk-ai-proxy.jonathanrannabargar.workers.dev";
var DocWalkProxyProvider = class {
  name = "DocWalk Proxy (Gemini Flash)";
  baseURL;
  constructor(baseURL) {
    this.baseURL = (baseURL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  }
  async summarizeModule(module, fileContent) {
    return this.generate(buildModuleSummaryPrompt(module, fileContent));
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

// src/analysis/providers/index.ts
var WELL_KNOWN_ENV_VARS = {
  anthropic: ["ANTHROPIC_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"]
};
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

export {
  AnthropicProvider,
  OpenAIProvider,
  GeminiProvider,
  OllamaProvider,
  OpenRouterProvider,
  DocWalkProxyProvider,
  resolveApiKey,
  createProvider,
  createProxyFallback
};
