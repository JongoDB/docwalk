import {
  loadConfig,
  loadConfigFile
} from "./chunk-DI75Y54W.js";
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
      const { runTool } = await import("./cli-tools-ZOSG3UVT.js");
      await runTool("npx", ["tsx", "src/cli/index.ts", "generate", "--full"], {
        cwd: repoRoot,
        stdio: verbose ? "inherit" : "pipe"
      });
      log("success", "Docs regenerated.");
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
async function findZensical() {
  const { hasZensicalInVenv, zensicalBin } = await import("./doctor-UMIFOYKA.js");
  if (hasZensicalInVenv()) {
    return zensicalBin();
  }
  try {
    const { execa } = await import("execa");
    await execa("zensical", ["--version"]);
    return "zensical";
  } catch {
    return null;
  }
}
async function devCommand(options) {
  if (options.verbose) setVerbose(true);
  header("Development Server");
  const { config } = options.config ? await loadConfigFile(options.config) : await loadConfig();
  const repoRoot = resolveRepoRoot(config.source);
  if (options.watch) {
    await startWatcher(repoRoot, config.source.include, !!options.verbose);
  }
  const port = options.port;
  const host = options.host;
  const outputDir = path.resolve("docwalk-output");
  const fs = await import("fs");
  if (!fs.existsSync(path.join(outputDir, "docs"))) {
    log("error", "No generated docs found. Run docwalk generate first.");
    process.exit(1);
  }
  let zensical = await findZensical();
  if (!zensical) {
    log("info", "Zensical not found \u2014 installing to .docwalk/venv/...");
    blank();
    const { installZensical, zensicalBin } = await import("./doctor-UMIFOYKA.js");
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
        `${host}:${port}`
      ],
      { stdio: "inherit" }
    );
  } catch (err) {
    if (err.exitCode !== void 0) {
      return;
    }
    log("error", `Dev server failed: ${err.message}`);
    process.exit(1);
  }
}
export {
  devCommand
};
