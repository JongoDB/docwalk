/**
 * DocWalk CLI — dev command
 *
 * Starts MkDocs' built-in dev server for local preview.
 * Supports --watch to auto-regenerate docs when source files change.
 */

import chalk from "chalk";
import path from "path";
import { loadConfig, loadConfigFile } from "../../config/loader.js";
import { ToolNotFoundError, formatToolError, runTool } from "../../utils/cli-tools.js";
import { log, header, blank, setVerbose } from "../../utils/logger.js";

interface DevOptions {
  config?: string;
  port: string;
  host: string;
  watch?: boolean;
  verbose?: boolean;
}

/**
 * Start a file watcher that re-runs `docwalk generate` when source files change.
 * Uses fs.watch recursively (Node 18+) to avoid external dependencies.
 */
async function startWatcher(
  repoRoot: string,
  include: string[],
  verbose: boolean
): Promise<void> {
  const fs = await import("fs");

  // Watch the source directories derived from include globs
  const watchDirs = new Set<string>();
  for (const pattern of include) {
    // Extract the top-level directory from the glob pattern
    const topDir = pattern.split("/")[0].replace(/\*.*$/, "");
    if (topDir) {
      const fullDir = path.resolve(repoRoot, topDir);
      try {
        const stat = await fs.promises.stat(fullDir);
        if (stat.isDirectory()) {
          watchDirs.add(fullDir);
        }
      } catch {
        // Directory doesn't exist — skip
      }
    }
  }

  if (watchDirs.size === 0) {
    // Fall back to watching the repo root
    watchDirs.add(repoRoot);
  }

  let regenerating = false;
  let pendingRegenerate = false;

  async function regenerate(): Promise<void> {
    if (regenerating) {
      pendingRegenerate = true;
      return;
    }

    regenerating = true;
    log("info", "Source files changed — regenerating docs...");

    try {
      await runTool("npx", ["tsx", "src/cli/index.ts", "generate", "--full"], {
        cwd: repoRoot,
        stdio: verbose ? "inherit" : "pipe",
      });
      log("success", "Docs regenerated. MkDocs will pick up changes automatically.");
    } catch {
      log("warn", "Regeneration failed — check your source files for errors.");
    }

    regenerating = false;

    if (pendingRegenerate) {
      pendingRegenerate = false;
      await regenerate();
    }
  }

  // Debounce: wait for changes to settle before regenerating
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  for (const dir of watchDirs) {
    log("debug", `Watching ${chalk.dim(dir)}`);

    const watcher = fs.watch(dir, { recursive: true }, (_event, filename) => {
      if (!filename) return;

      // Skip generated output and hidden files
      if (filename.includes("docwalk-output") || filename.includes(".docwalk")) {
        return;
      }

      // Only watch source code files
      if (!/\.(ts|tsx|js|jsx|py|go|rs|md)$/.test(filename)) {
        return;
      }

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        regenerate();
      }, 500);
    });

    // Ensure the watcher doesn't prevent process exit
    watcher.unref();
  }

  log("success", `Watching ${watchDirs.size} source director${watchDirs.size === 1 ? "y" : "ies"} for changes`);
  blank();
}

export async function devCommand(options: DevOptions): Promise<void> {
  if (options.verbose) setVerbose(true);

  header("Development Server");

  const { config } = options.config
    ? await loadConfigFile(options.config)
    : await loadConfig();

  const repoRoot = config.source.provider === "local"
    ? path.resolve(config.source.repo)
    : process.cwd();

  // ── Start file watcher if --watch ────────────────────────────────────
  if (options.watch) {
    await startWatcher(repoRoot, config.source.include, !!options.verbose);
  }

  // ── Start MkDocs dev server ──────────────────────────────────────────
  log("info", `Starting MkDocs dev server on ${options.host}:${options.port}...`);
  blank();

  try {
    await runTool(
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
    if (error instanceof ToolNotFoundError) {
      console.log(formatToolError(error));
      process.exit(1);
    }

    log("error", "Failed to start MkDocs dev server.");
    blank();
    log("info", "Make sure MkDocs Material is installed:");
    console.log(`    ${chalk.cyan("pip install mkdocs-material")}`);
    blank();
    log("info", "Then generate docs first:");
    console.log(`    ${chalk.cyan("docwalk generate")}`);
    process.exit(1);
  }
}
