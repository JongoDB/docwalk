import {
  ToolNotFoundError,
  ZENSICAL_INSTALL_CMD,
  runTool
} from "./chunk-RI67YQXQ.js";
import {
  loadConfig,
  loadConfigFile
} from "./chunk-DTNMTRIJ.js";
import {
  resolveRepoRoot
} from "./chunk-BAPW5PUT.js";
import {
  blank,
  header,
  log,
  setVerbose
} from "./chunk-YQ34VMHP.js";

// src/cli/commands/dev.ts
import chalk from "chalk";
import path from "path";
async function startWatcher(repoRoot, include, verbose) {
  const fs = await import("fs");
  const watchDirs = /* @__PURE__ */ new Set();
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
      }
    }
  }
  if (watchDirs.size === 0) {
    watchDirs.add(repoRoot);
  }
  let regenerating = false;
  let pendingRegenerate = false;
  async function regenerate() {
    if (regenerating) {
      pendingRegenerate = true;
      return;
    }
    regenerating = true;
    log("info", "Source files changed \u2014 regenerating docs...");
    try {
      await runTool("npx", ["tsx", "src/cli/index.ts", "generate", "--full"], {
        cwd: repoRoot,
        stdio: verbose ? "inherit" : "pipe"
      });
      log("success", "Docs regenerated. Zensical will pick up changes automatically.");
    } catch {
      log("warn", "Regeneration failed \u2014 check your source files for errors.");
    }
    regenerating = false;
    if (pendingRegenerate) {
      pendingRegenerate = false;
      await regenerate();
    }
  }
  let debounceTimer = null;
  for (const dir of watchDirs) {
    log("debug", `Watching ${chalk.dim(dir)}`);
    const watcher = fs.watch(dir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      if (filename.includes("docwalk-output") || filename.includes(".docwalk")) {
        return;
      }
      if (!/\.(ts|tsx|js|jsx|py|go|rs|md)$/.test(filename)) {
        return;
      }
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
async function devCommand(options) {
  if (options.verbose) setVerbose(true);
  header("Development Server");
  const { config } = options.config ? await loadConfigFile(options.config) : await loadConfig();
  const repoRoot = resolveRepoRoot(config.source);
  if (options.watch) {
    await startWatcher(repoRoot, config.source.include, !!options.verbose);
  }
  log("info", `Starting dev server on ${options.host}:${options.port}...`);
  blank();
  try {
    await runTool(
      "zensical",
      [
        "serve",
        "--config-file",
        "docwalk-output/mkdocs.yml",
        "--dev-addr",
        `${options.host}:${options.port}`
      ],
      { stdio: "inherit" }
    );
  } catch (error) {
    if (error instanceof ToolNotFoundError) {
      log("error", "Zensical is required to preview docs.");
      blank();
      log("info", "Install it with:");
      console.log(`    ${chalk.cyan(ZENSICAL_INSTALL_CMD)}`);
      blank();
      log("info", "If you don't have Python installed:");
      console.log(`    ${chalk.cyan("brew install python")}     ${chalk.dim("# macOS")}`);
      console.log(`    ${chalk.cyan("sudo apt install python3")} ${chalk.dim("# Ubuntu/Debian")}`);
      blank();
      log("info", "Then run:");
      console.log(`    ${chalk.cyan(ZENSICAL_INSTALL_CMD)}`);
      console.log(`    ${chalk.cyan("docwalk dev")}`);
      process.exit(1);
    }
    log("error", "Failed to start Zensical dev server.");
    blank();
    log("info", "Make sure Zensical is installed:");
    console.log(`    ${chalk.cyan(ZENSICAL_INSTALL_CMD)}`);
    blank();
    log("info", "Then generate docs first:");
    console.log(`    ${chalk.cyan("docwalk generate")}`);
    process.exit(1);
  }
}
export {
  devCommand
};
