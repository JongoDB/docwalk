/**
 * DocWalk Secrets — Project-local API key storage
 *
 * Stores API keys in `.docwalk/.env` (gitignored, mode 0o600).
 * Keys loaded here never overwrite existing environment variables.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const DOCWALK_DIR = ".docwalk";
const ENV_FILE = ".env";

/** Map of provider name → env var name. */
const PROVIDER_ENV_VARS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

/**
 * Save an API key for a provider to `.docwalk/.env`.
 * Creates the directory if it doesn't exist.
 */
export async function saveProjectApiKey(provider: string, key: string): Promise<void> {
  const dir = path.resolve(DOCWALK_DIR);
  await mkdir(dir, { recursive: true });

  const envPath = path.join(dir, ENV_FILE);
  const envVar = PROVIDER_ENV_VARS[provider] || "DOCWALK_AI_KEY";

  // Read existing content, replace or append the key
  let content = "";
  try {
    content = await readFile(envPath, "utf-8");
  } catch {
    // File doesn't exist yet
  }

  const lines = content.split("\n").filter((l) => l.trim() !== "");
  const idx = lines.findIndex((l) => l.startsWith(`${envVar}=`));
  const newLine = `${envVar}=${key}`;

  if (idx >= 0) {
    lines[idx] = newLine;
  } else {
    lines.push(newLine);
  }

  await writeFile(envPath, lines.join("\n") + "\n", { mode: 0o600 });
}

/**
 * Load `.docwalk/.env` into `process.env` without overwriting existing vars.
 * Silently does nothing if the file doesn't exist.
 */
export async function loadProjectEnv(): Promise<void> {
  const envPath = path.resolve(DOCWALK_DIR, ENV_FILE);

  let content: string;
  try {
    content = await readFile(envPath, "utf-8");
  } catch {
    return; // No .env file — nothing to do
  }

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;

    const name = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();

    // Never overwrite existing environment variables
    if (!process.env[name]) {
      process.env[name] = value;
    }
  }
}
