/**
 * DocWalk CLI — dev command
 *
 * Starts a local preview server. Uses Zensical (MkDocs) if available,
 * otherwise falls back to a pure Node.js preview server — no Python needed.
 */

import chalk from "chalk";
import path from "path";
import { loadConfig, loadConfigFile } from "../../config/loader.js";
import { log, header, blank, setVerbose } from "../../utils/logger.js";
import { resolveRepoRoot } from "../../utils/index.js";

interface DevOptions {
  config?: string;
  port: string;
  host: string;
  watch?: boolean;
  verbose?: boolean;
}

/**
 * Start a file watcher that re-runs `docwalk generate` when source files change.
 */
async function startWatcher(
  repoRoot: string,
  include: string[],
  verbose: boolean
): Promise<void> {
  const fs = await import("fs");

  const watchDirs = new Set<string>();
  for (const pattern of include) {
    const topDir = pattern.split("/")[0].replace(/\*.*$/, "");
    if (topDir) {
      const fullDir = path.resolve(repoRoot, topDir);
      try {
        const stat = await fs.promises.stat(fullDir);
        if (stat.isDirectory()) {
          watchDirs.add(fullDir);
        }
      } catch {
        // Directory doesn't exist
      }
    }
  }

  if (watchDirs.size === 0) {
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
      const { runTool } = await import("../../utils/cli-tools.js");
      await runTool("npx", ["tsx", "src/cli/index.ts", "generate", "--full"], {
        cwd: repoRoot,
        stdio: verbose ? "inherit" : "pipe",
      });
      log("success", "Docs regenerated.");
    } catch {
      log("warn", "Regeneration failed — check your source files for errors.");
    }

    regenerating = false;

    if (pendingRegenerate) {
      pendingRegenerate = false;
      await regenerate();
    }
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  for (const dir of watchDirs) {
    log("debug", `Watching ${chalk.dim(dir)}`);

    const watcher = fs.watch(dir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      if (filename.includes("docwalk-output") || filename.includes(".docwalk")) return;
      if (!/\.(ts|tsx|js|jsx|py|go|rs|md)$/.test(filename)) return;

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

/**
 * Check if Zensical is available.
 */
async function hasZensical(): Promise<boolean> {
  try {
    const { execa } = await import("execa");
    await execa("python3", ["-c", "import zensical"]);
    return true;
  } catch {
    return false;
  }
}

export async function devCommand(options: DevOptions): Promise<void> {
  if (options.verbose) setVerbose(true);

  header("Development Server");

  const { config } = options.config
    ? await loadConfigFile(options.config)
    : await loadConfig();

  const repoRoot = resolveRepoRoot(config.source);

  // Start file watcher if --watch
  if (options.watch) {
    await startWatcher(repoRoot, config.source.include, !!options.verbose);
  }

  const port = parseInt(options.port, 10);
  const host = options.host;
  const outputDir = path.resolve("docwalk-output");

  // Check if docs exist
  const fs = await import("fs");
  if (!fs.existsSync(path.join(outputDir, "docs"))) {
    log("error", "No generated docs found. Run docwalk generate first.");
    process.exit(1);
  }

  // Try Zensical first, fall back to Node.js preview server
  if (await hasZensical()) {
    log("info", `Starting Zensical dev server on ${host}:${port}...`);
    blank();

    const { runTool } = await import("../../utils/cli-tools.js");
    await runTool(
      "zensical",
      [
        "serve",
        "--config-file",
        "docwalk-output/mkdocs.yml",
        "--dev-addr",
        `${host}:${port}`,
      ],
      { stdio: "inherit" }
    );
  } else {
    log("info", "Starting Node.js preview server (no Python needed)...");
    blank();

    const { startPreviewServer } = await import("../preview-server.js");
    await startPreviewServer(outputDir, host, port);

    const url = `http://${host === "127.0.0.1" ? "localhost" : host}:${port}`;
    log("success", `Preview server running at ${chalk.cyan(url)}`);
    blank();
    console.log(chalk.dim("  Press Ctrl+C to stop"));
    blank();

    // Keep process alive
    await new Promise(() => {});
  }
}
