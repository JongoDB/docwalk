#!/usr/bin/env node

/**
 * DocWalk CLI binary entry point.
 * This file is referenced in package.json "bin" and
 * simply bootstraps the CLI from the compiled source.
 *
 * In dev mode (no dist/), spawns tsx to run the TypeScript source directly.
 */

import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distEntry = resolve(__dirname, "../dist/cli/index.js");
const srcEntry = resolve(__dirname, "../src/cli/index.ts");

if (existsSync(distEntry)) {
  await import(distEntry);
} else {
  // Dev mode: re-exec via tsx so TypeScript source works
  try {
    execFileSync(
      resolve(__dirname, "../node_modules/.bin/tsx"),
      [srcEntry, ...process.argv.slice(2)],
      { stdio: "inherit", cwd: process.cwd() }
    );
  } catch (e) {
    process.exit(e.status ?? 1);
  }
}
