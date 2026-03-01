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
async function hasZensical() {
  try {
    const { execa } = await import("execa");
    await execa("python3", ["-c", "import zensical"]);
    return true;
  } catch {
    return false;
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
  const port = parseInt(options.port, 10);
  const host = options.host;
  const outputDir = path.resolve("docwalk-output");
  const fs = await import("fs");
  if (!fs.existsSync(path.join(outputDir, "docs"))) {
    log("error", "No generated docs found. Run docwalk generate first.");
    process.exit(1);
  }
  if (await hasZensical()) {
    log("info", `Starting Zensical dev server on ${host}:${port}...`);
    blank();
    const { runTool } = await import("./cli-tools-ZOSG3UVT.js");
    await runTool(
      "zensical",
      [
        "serve",
        "--config-file",
        "docwalk-output/mkdocs.yml",
        "--dev-addr",
        `${host}:${port}`
      ],
      { stdio: "inherit" }
    );
  } else {
    log("info", "Starting Node.js preview server (no Python needed)...");
    blank();
    const { startPreviewServer } = await import("./preview-server-ARW6MZ2F.js");
    await startPreviewServer(outputDir, host, port);
    const url = `http://${host === "127.0.0.1" ? "localhost" : host}:${port}`;
    log("success", `Preview server running at ${chalk.cyan(url)}`);
    blank();
    console.log(chalk.dim("  Press Ctrl+C to stop"));
    blank();
    await new Promise(() => {
    });
  }
}
export {
  devCommand
};
