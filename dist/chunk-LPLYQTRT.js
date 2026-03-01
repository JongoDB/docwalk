// src/utils/secrets.ts
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
var DOCWALK_DIR = ".docwalk";
var ENV_FILE = ".env";
var PROVIDER_ENV_VARS = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY"
};
async function saveProjectApiKey(provider, key) {
  const dir = path.resolve(DOCWALK_DIR);
  await mkdir(dir, { recursive: true });
  const envPath = path.join(dir, ENV_FILE);
  const envVar = PROVIDER_ENV_VARS[provider] || "DOCWALK_AI_KEY";
  let content = "";
  try {
    content = await readFile(envPath, "utf-8");
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
  await writeFile(envPath, lines.join("\n") + "\n", { mode: 384 });
}
async function loadProjectEnv() {
  const envPath = path.resolve(DOCWALK_DIR, ENV_FILE);
  let content;
  try {
    content = await readFile(envPath, "utf-8");
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

export {
  saveProjectApiKey,
  loadProjectEnv
};
