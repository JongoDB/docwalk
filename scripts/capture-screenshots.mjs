#!/usr/bin/env node
/**
 * Captures screenshots of generated docs for each theme preset.
 * Requires: zensical, playwright (with chromium)
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from "fs";
import path from "path";

const THEMES = ["developer", "corporate", "startup", "minimal"];
const ROOT = path.resolve(import.meta.dirname, "..");
const CONFIG_PATH = path.join(ROOT, "docwalk.config.yml");
const OUTPUT_DIR = path.join(ROOT, "docwalk-output");
const SCREENSHOT_DIR = path.join(ROOT, "assets", "screenshots");
const MKDOCS_PATH = process.env.MKDOCS_PATH || "zensical";

// Save original config
const originalConfig = readFileSync(CONFIG_PATH, "utf-8");

mkdirSync(SCREENSHOT_DIR, { recursive: true });

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { cwd: ROOT, stdio: "pipe", timeout: 120000, ...opts });
}

async function captureScreenshot(theme, port) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const url = `http://127.0.0.1:${port}`;

  // Wait for server to be ready
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }

  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000); // let fonts/mermaid render

  const outPath = path.join(SCREENSHOT_DIR, `theme-${theme}.webp`);
  await page.screenshot({ path: outPath, type: "png" });

  // Convert to webp if possible, otherwise keep png
  try {
    run(`npx -y sharp-cli -i "${outPath}" -o "${outPath.replace('.webp', '.webp')}" --format webp --quality 85`);
  } catch {
    // Keep as png, rename
    const pngPath = outPath.replace(".webp", ".png");
    if (existsSync(outPath)) {
      cpSync(outPath, pngPath);
    }
  }

  await browser.close();
  console.log(`  ✓ Screenshot saved: ${outPath}`);
}

async function main() {
  let port = 8100;

  for (const theme of THEMES) {
    console.log(`\n── Theme: ${theme} ──`);

    // Update config to use this theme
    const newConfig = originalConfig.replace(
      /preset:\s*\w+/,
      `preset: ${theme}`
    );
    writeFileSync(CONFIG_PATH, newConfig);

    // Generate docs
    console.log("  Generating docs...");
    run("npx tsx src/cli/index.ts generate");

    // Build documentation site
    console.log("  Building documentation site...");
    try {
      run(`${MKDOCS_PATH} build`, { cwd: OUTPUT_DIR });
    } catch (e) {
      console.log(`  ⚠ mkdocs build warning (continuing): ${e.message.slice(0, 200)}`);
    }

    // Start mkdocs serve in background
    const currentPort = port++;
    console.log(`  Starting dev server on port ${currentPort}...`);
    const { spawn } = await import("child_process");
    const server = spawn(MKDOCS_PATH, ["serve", "-a", `127.0.0.1:${currentPort}`, "--no-livereload"], {
      cwd: OUTPUT_DIR,
      stdio: "pipe",
    });

    try {
      await captureScreenshot(theme, currentPort);
    } finally {
      server.kill();
    }
  }

  // Restore original config
  writeFileSync(CONFIG_PATH, originalConfig);
  console.log("\n✓ All screenshots captured. Restoring original config.");
}

main().catch((e) => {
  // Restore config on error
  writeFileSync(CONFIG_PATH, originalConfig);
  console.error(e);
  process.exit(1);
});
