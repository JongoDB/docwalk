import {
  saveProjectApiKey
} from "./chunk-LPLYQTRT.js";
import {
  resolveApiKey
} from "./chunk-5FUP7YMS.js";
import {
  blank,
  log
} from "./chunk-YQ34VMHP.js";

// src/cli/flows/ai-setup.ts
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
var PROVIDER_CHOICES = [
  { name: "Google Gemini    \u2014 free tier, fast, great for docs", value: "gemini" },
  { name: "Anthropic Claude \u2014 best quality, requires API key", value: "anthropic" },
  { name: "OpenAI GPT      \u2014 widely available", value: "openai" },
  { name: "OpenRouter       \u2014 multi-model gateway", value: "openrouter" },
  { name: "Local / Ollama   \u2014 no API key, runs locally", value: "ollama" },
  { name: "Skip             \u2014 use DocWalk free AI", value: "docwalk-proxy" }
];
var KEY_URLS = {
  gemini: "https://aistudio.google.com/app/apikey",
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  openrouter: "https://openrouter.ai/keys"
};
var ENV_VAR_NAMES = {
  gemini: "GEMINI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY"
};
var DEFAULT_MODELS = {
  gemini: "gemini-2.5-flash",
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
  openrouter: "google/gemini-2.5-flash",
  ollama: "llama3.2"
};
async function runAISetup() {
  const { enableAI } = await inquirer.prompt([
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
  const { provider } = await inquirer.prompt([
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
    log("success", `Found existing ${chalk.cyan(envVar)} in environment`);
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
    console.log(`  Get your API key: ${chalk.cyan.underline(keyUrl)}`);
    blank();
  }
  const { apiKey } = await inquirer.prompt([
    {
      type: "password",
      name: "apiKey",
      message: `${envVar}:`,
      mask: "*",
      validate: (input) => input.length > 0 || "API key is required"
    }
  ]);
  const spinner = ora("Validating API key...").start();
  try {
    await validateApiKey(provider, apiKey);
    spinner.succeed("API key is valid");
  } catch (err) {
    spinner.fail(`API key validation failed: ${err.message || "unknown error"}`);
    const { fallback } = await inquirer.prompt([
      {
        type: "list",
        name: "fallback",
        message: "What would you like to do?",
        choices: [
          { name: "Try a different key", value: "retry" },
          { name: "Save anyway (skip validation)", value: "save" },
          { name: "Use DocWalk free AI instead", value: "proxy" }
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
  log("success", `API key saved to ${chalk.dim(".docwalk/.env")}`);
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

export {
  runAISetup
};
