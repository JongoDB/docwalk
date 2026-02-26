/**
 * DocWalk CLI — dev command
 *
 * Starts MkDocs' built-in dev server for local preview.
 */

import chalk from "chalk";
import { loadConfig, loadConfigFile } from "../../config/loader.js";
import { log, header, blank } from "../../utils/logger.js";

interface DevOptions {
  config?: string;
  port: string;
  host: string;
}

export async function devCommand(options: DevOptions): Promise<void> {
  header("Development Server");

  const { config } = options.config
    ? await loadConfigFile(options.config)
    : await loadConfig();

  log("info", `Starting MkDocs dev server on ${options.host}:${options.port}...`);
  blank();

  try {
    const { execa } = await import("execa");
    await execa(
      "mkdocs",
      [
        "serve",
        "--config-file",
        "docwalk-output/mkdocs.yml",
        "--dev-addr",
        `${options.host}:${options.port}`,
      ],
      { stdio: "inherit" }
    );
  } catch (error) {
    log("error", "Failed to start MkDocs dev server.");
    log("info", `Make sure MkDocs Material is installed:`);
    console.log(`    ${chalk.cyan("pip install mkdocs-material")}`);
    blank();
    log("info", `Then generate docs first:`);
    console.log(`    ${chalk.cyan("docwalk generate")}`);
    process.exit(1);
  }
}
