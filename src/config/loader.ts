/**
 * DocWalk Configuration Loader
 *
 * Uses cosmiconfig to discover docwalk.config.yml (or .json, .js, etc.)
 * from the project root, then validates it against the Zod schema.
 */

import { cosmiconfig } from "cosmiconfig";
import { DocWalkConfigSchema, type DocWalkConfig } from "./schema.js";
import chalk from "chalk";

const MODULE_NAME = "docwalk";

const explorer = cosmiconfig(MODULE_NAME, {
  searchPlaces: [
    "docwalk.config.yml",
    "docwalk.config.yaml",
    "docwalk.config.json",
    "docwalk.config.js",
    "docwalk.config.ts",
    ".docwalkrc",
    ".docwalkrc.yml",
    ".docwalkrc.yaml",
    ".docwalkrc.json",
  ],
});

/** Clear cosmiconfig's search/load caches (needed after writing a new config). */
export function clearConfigCache(): void {
  explorer.clearSearchCache();
  explorer.clearLoadCache();
}

export interface LoadConfigResult {
  config: DocWalkConfig;
  filepath: string;
}

/**
 * Load and validate DocWalk configuration from the project directory.
 *
 * @param searchFrom - Directory to search from (defaults to cwd)
 * @returns Validated config and the filepath it was loaded from
 * @throws If no config found or validation fails
 */
export async function loadConfig(
  searchFrom?: string
): Promise<LoadConfigResult> {
  const result = await explorer.search(searchFrom);

  if (!result || result.isEmpty) {
    throw new ConfigNotFoundError(
      `No docwalk configuration found. Run ${chalk.cyan("docwalk init")} to create one.`
    );
  }

  const parsed = DocWalkConfigSchema.safeParse(result.config);

  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((issue) => {
        const path = issue.path.join(".");
        return `  ${chalk.red("✗")} ${chalk.dim(path)}: ${issue.message}`;
      })
      .join("\n");

    throw new ConfigValidationError(
      `Invalid configuration in ${chalk.dim(result.filepath)}:\n${errors}`
    );
  }

  return {
    config: parsed.data,
    filepath: result.filepath,
  };
}

/**
 * Load config from a specific file path.
 */
export async function loadConfigFile(
  filepath: string
): Promise<LoadConfigResult> {
  const result = await explorer.load(filepath);

  if (!result || result.isEmpty) {
    throw new ConfigNotFoundError(
      `Configuration file is empty: ${chalk.dim(filepath)}`
    );
  }

  const parsed = DocWalkConfigSchema.safeParse(result.config);

  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((issue) => {
        const path = issue.path.join(".");
        return `  ${chalk.red("✗")} ${chalk.dim(path)}: ${issue.message}`;
      })
      .join("\n");

    throw new ConfigValidationError(
      `Invalid configuration in ${chalk.dim(filepath)}:\n${errors}`
    );
  }

  return {
    config: parsed.data,
    filepath: result.filepath,
  };
}

// ─── Error Classes ──────────────────────────────────────────────────────────

export class ConfigNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigNotFoundError";
  }
}

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigValidationError";
  }
}
