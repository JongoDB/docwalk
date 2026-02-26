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

  // ── Start MkDocs dev server (with fallback to Node.js static server) ──
  log("info", `Starting dev server on ${options.host}:${options.port}...`);
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
      // Fallback: use a built-in Node.js static file server
      log("warn", "MkDocs not found — falling back to built-in static server.");
      log("info", "For full features (search, live-reload), install MkDocs:");
      console.log(`    ${chalk.cyan("pip install mkdocs-material")}`);
      blank();

      await startFallbackServer(options.host, parseInt(options.port, 10));
      return;
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

/**
 * Fallback static file server using Node.js built-in http module.
 * Serves the site/ directory when MkDocs is not installed.
 */
async function startFallbackServer(host: string, port: number): Promise<void> {
  const http = await import("http");
  const fs = await import("fs");
  const pathMod = await import("path");

  // Try site/ first (MkDocs build output), then docwalk-output/docs/
  const candidates = ["site", "docwalk-output/site", "docwalk-output/docs"];
  let serveDir = "";
  for (const candidate of candidates) {
    const absPath = pathMod.default.resolve(candidate);
    try {
      const stat = await fs.promises.stat(absPath);
      if (stat.isDirectory()) {
        serveDir = absPath;
        break;
      }
    } catch {
      // Not found, try next
    }
  }

  if (!serveDir) {
    log("error", "No site directory found to serve.");
    log("info", "Run `docwalk generate` first, then `mkdocs build` to produce the site.");
    process.exit(1);
  }

  const MIME_TYPES: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".md": "text/markdown",
    ".xml": "application/xml",
    ".txt": "text/plain",
  };

  const server = http.createServer(async (req, res) => {
    let urlPath = decodeURIComponent(req.url || "/");

    // Strip query string
    const qIdx = urlPath.indexOf("?");
    if (qIdx >= 0) urlPath = urlPath.slice(0, qIdx);

    // Map to file path
    let filePath = pathMod.default.join(serveDir, urlPath);

    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.isDirectory()) {
        filePath = pathMod.default.join(filePath, "index.html");
      }
    } catch {
      // File not found — try adding .html
      if (!filePath.endsWith(".html")) {
        try {
          await fs.promises.stat(filePath + ".html");
          filePath = filePath + ".html";
        } catch {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("404 Not Found");
          return;
        }
      }
    }

    try {
      const content = await fs.promises.readFile(filePath);
      const ext = pathMod.default.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
    }
  });

  server.listen(port, host, () => {
    log("success", `Static server running at ${chalk.cyan(`http://${host}:${port}`)}`);
    log("info", `Serving files from ${chalk.dim(serveDir)}`);
    blank();
    log("info", "Note: This is a basic static server. For search and live-reload,");
    log("info", `install MkDocs: ${chalk.cyan("pip install mkdocs-material")}`);
  });
}
