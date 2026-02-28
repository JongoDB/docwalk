#!/usr/bin/env node

/**
 * DocWalk postinstall — installs required Python/MkDocs packages.
 *
 * Runs automatically after `npm install`. Gracefully warns if Python
 * or pip is unavailable instead of failing the install.
 */

import { execFileSync } from "child_process";

const PACKAGES = ["mkdocs-material", "mkdocs-minify-plugin", "mkdocs-glightbox"];

function run(cmd, args) {
  return execFileSync(cmd, args, { stdio: "pipe", encoding: "utf-8" });
}

function tryInstall() {
  // Find pip
  let pip;
  for (const candidate of ["pip3", "pip"]) {
    try {
      run(candidate, ["--version"]);
      pip = candidate;
      break;
    } catch {}
  }

  if (!pip) {
    console.warn(
      "\n⚠  DocWalk: Python/pip not found — MkDocs packages not installed." +
      "\n   Install Python 3, then run: docwalk doctor --install\n"
    );
    return;
  }

  console.log("DocWalk: Installing MkDocs dependencies...");

  try {
    execFileSync(pip, ["install", ...PACKAGES], { stdio: "inherit" });
  } catch {
    console.warn(
      "\n⚠  DocWalk: Failed to install MkDocs packages." +
      "\n   Run manually: docwalk doctor --install\n"
    );
  }
}

tryInstall();
