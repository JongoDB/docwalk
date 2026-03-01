#!/usr/bin/env node

/**
 * DocWalk postinstall — installs required Python/Zensical packages.
 *
 * Runs automatically after `npm install`. Gracefully warns if Python
 * or pip is unavailable instead of failing the install.
 */

const { execFileSync } = require("child_process");

const PACKAGES = ["zensical"];

function run(cmd, args) {
  return execFileSync(cmd, args, { stdio: "pipe", encoding: "utf-8" });
}

function tryInstall() {
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
      "\n⚠  DocWalk: Python/pip not found — Zensical not installed." +
      "\n   Install Python 3, then run: docwalk doctor --install\n"
    );
    return;
  }

  console.log("DocWalk: Installing Zensical...");

  try {
    execFileSync(pip, ["install", ...PACKAGES], { stdio: "inherit" });
  } catch {
    console.warn(
      "\n⚠  DocWalk: Failed to install Zensical." +
      "\n   Run manually: docwalk doctor --install\n"
    );
  }
}

try {
  tryInstall();
} catch {
  // Never let postinstall block npm install
}
