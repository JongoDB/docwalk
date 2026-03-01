/**
 * DocWalk CLI — dev command
 *
 * Starts Zensical dev server for local preview. If Zensical isn't installed,
 * auto-installs it into .docwalk/venv/ (no system pip needed).
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
 * Find the zensical binary — check managed venv first, then system PATH.
 */
async function findZensical(): Promise<string | null> {
  const { hasZensicalInVenv, zensicalBin } = await import("./doctor.js");

  // Check managed venv
  if (hasZensicalInVenv()) {
    return zensicalBin();
  }

  // Check system install
  try {
    const { execa } = await import("execa");
    await execa("zensical", ["--version"]);
    return "zensical";
  } catch {
    return null;
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

  const port = options.port;
  const host = options.host;
  const outputDir = path.resolve("docwalk-output");

  // Check if docs exist
  const fs = await import("fs");
  if (!fs.existsSync(path.join(outputDir, "docs"))) {
    log("error", "No generated docs found. Run docwalk generate first.");
    process.exit(1);
  }

  // Find zensical — auto-install if missing
  let zensical = await findZensical();

  if (!zensical) {
    log("info", "Zensical not found — installing to .docwalk/venv/...");
    blank();

    const { installZensical, zensicalBin } = await import("./doctor.js");
    const installed = await installZensical();

    if (installed) {
      zensical = zensicalBin();
    } else {
      log("error", "Could not install Zensical. Please install Python 3 first:");
      console.log(`    ${chalk.cyan("brew install python")}     ${chalk.dim("# macOS")}`);
      console.log(`    ${chalk.cyan("sudo apt install python3")} ${chalk.dim("# Ubuntu/Debian")}`);
      process.exit(1);
    }
    blank();
  }

  log("info", `Starting dev server on ${host}:${port}...`);
  blank();

  const { execa } = await import("execa");
  try {
    await execa(
      zensical,
      [
        "serve",
        "--config-file",
        "docwalk-output/mkdocs.yml",
        "--dev-addr",
        `${host}:${port}`,
      ],
      { stdio: "inherit" }
    );
  } catch (err: any) {
    if (err.exitCode !== undefined) {
      // Zensical exited (user pressed Ctrl+C, etc.)
      return;
    }
    log("error", `Dev server failed: ${err.message}`);
    process.exit(1);
  }
}
