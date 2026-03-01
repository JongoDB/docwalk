/**
 * DocWalk — Interactive AI Setup Flow
 *
 * Reusable flow for configuring an AI provider with key validation.
 * Called from both `init` and `generate` commands.
 */

import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { log, blank } from "../../utils/logger.js";
import { saveProjectApiKey } from "../../utils/secrets.js";
import { resolveApiKey } from "../../analysis/providers/index.js";

export interface AISetupResult {
  enabled: boolean;
  providerName?: string;
  model?: string;
  keyStored?: boolean;
}

const PROVIDER_CHOICES = [
  { name: "Google Gemini    — free tier, fast, great for docs", value: "gemini" },
  { name: "Anthropic Claude — best quality, requires API key", value: "anthropic" },
  { name: "OpenAI GPT      — widely available", value: "openai" },
  { name: "OpenRouter       — multi-model gateway", value: "openrouter" },
  { name: "Local / Ollama   — no API key, runs locally", value: "ollama" },
  { name: "Skip             — use DocWalk free AI", value: "docwalk-proxy" },
];

const KEY_URLS: Record<string, string> = {
  gemini: "https://aistudio.google.com/app/apikey",
  anthropic: "https://console.anthropic.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
  openrouter: "https://openrouter.ai/keys",
};

const ENV_VAR_NAMES: Record<string, string> = {
  gemini: "GEMINI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

const DEFAULT_MODELS: Record<string, string> = {
  gemini: "gemini-2.5-flash",
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
  openrouter: "google/gemini-2.5-flash",
  ollama: "llama3.2",
};

/**
 * Run the interactive AI setup flow.
 * Returns the chosen provider config, and stores the key in .docwalk/.env.
 */
export async function runAISetup(): Promise<AISetupResult> {
  const { enableAI } = await inquirer.prompt([
    {
      type: "confirm",
      name: "enableAI",
      message: "Enable AI-powered documentation? (summaries, narratives, diagrams)",
      default: true,
    },
  ]);

  if (!enableAI) {
    return { enabled: false };
  }

  const { provider } = await inquirer.prompt([
    {
      type: "list",
      name: "provider",
      message: "AI provider:",
      choices: PROVIDER_CHOICES,
    },
  ]);

  // Providers that don't need an API key
  if (provider === "ollama" || provider === "docwalk-proxy") {
    return {
      enabled: true,
      providerName: provider,
      model: DEFAULT_MODELS[provider],
    };
  }

  // Check if key already exists in environment
  const envVar = ENV_VAR_NAMES[provider];
  const existingKey = resolveApiKey(provider, envVar);

  if (existingKey) {
    log("success", `Found existing ${chalk.cyan(envVar)} in environment`);
    return {
      enabled: true,
      providerName: provider,
      model: DEFAULT_MODELS[provider],
      keyStored: false,
    };
  }

  // Prompt for API key
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
      validate: (input: string) => input.length > 0 || "API key is required",
    },
  ]);

  // Validate the key with a minimal test call
  const spinner = ora("Validating API key...").start();

  try {
    await validateApiKey(provider, apiKey);
    spinner.succeed("API key is valid");
  } catch (err: any) {
    spinner.fail(`API key validation failed: ${err.message || "unknown error"}`);

    const { fallback } = await inquirer.prompt([
      {
        type: "list",
        name: "fallback",
        message: "What would you like to do?",
        choices: [
          { name: "Try a different key", value: "retry" },
          { name: "Save anyway (skip validation)", value: "save" },
          { name: "Use DocWalk free AI instead", value: "proxy" },
        ],
      },
    ]);

    if (fallback === "retry") {
      return runAISetup(); // Recurse for retry
    }

    if (fallback === "proxy") {
      return {
        enabled: true,
        providerName: "docwalk-proxy",
        model: DEFAULT_MODELS["docwalk-proxy"],
      };
    }

    // "save" — fall through to save the key anyway
  }

  // Save to .docwalk/.env
  await saveProjectApiKey(provider, apiKey);
  log("success", `API key saved to ${chalk.dim(".docwalk/.env")}`);

  return {
    enabled: true,
    providerName: provider,
    model: DEFAULT_MODELS[provider],
    keyStored: true,
  };
}

/**
 * Validate an API key by making a minimal test call.
 */
async function validateApiKey(provider: string, apiKey: string): Promise<void> {
  switch (provider) {
    case "gemini": {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { maxOutputTokens: 10 },
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
        messages: [{ role: "user", content: "Say hi" }],
      });
      break;
    }
    case "openai": {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey });
      await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say hi" }],
      });
      break;
    }
    case "openrouter": {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
      });
      await client.chat.completions.create({
        model: "google/gemini-2.5-flash",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say hi" }],
      });
      break;
    }
    default:
      // No validation available for this provider
      break;
  }
}
