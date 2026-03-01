import {
  ZENSICAL_PACKAGES
} from "./chunk-MRKS4VWN.js";
import {
  blank,
  header,
  log
} from "./chunk-YQ34VMHP.js";

// src/cli/commands/doctor.ts
import chalk from "chalk";
import path from "path";
import { existsSync } from "fs";
var VENV_DIR = path.resolve(".docwalk", "venv");
function venvPython() {
  return path.join(VENV_DIR, "bin", "python3");
}
function venvPip() {
  return path.join(VENV_DIR, "bin", "pip");
}
function zensicalBin() {
  return path.join(VENV_DIR, "bin", "zensical");
}
function hasVenv() {
  return existsSync(venvPython());
}
function hasZensicalInVenv() {
  return existsSync(zensicalBin());
}
async function getCommandOutput(command, args) {
  try {
    const { execa } = await import("execa");
    const result = await execa(command, args);
    return (result.stdout ?? "").trim();
  } catch {
    return null;
  }
}
async function checkPython() {
  const output = await getCommandOutput("python3", ["--version"]);
  if (output) {
    const version = output.replace("Python ", "");
    return { name: "Python", ok: true, version };
  }
  return { name: "Python", ok: false, detail: "not found \u2014 install python3" };
}
async function checkZensical() {
  if (hasZensicalInVenv()) {
    const output2 = await getCommandOutput(venvPython(), ["-c", "import zensical; print(zensical.__version__)"]);
    const version = output2 || "installed";
    return { name: "zensical", ok: true, version, detail: `in .docwalk/venv` };
  }
  const output = await getCommandOutput("python3", ["-c", "import zensical; print(zensical.__version__)"]);
  if (output) {
    return { name: "zensical", ok: true, version: output, detail: "system" };
  }
  return { name: "zensical", ok: false, detail: "not installed" };
}
async function doctorCommand(options) {
  header("Doctor \u2014 Prerequisites Check");
  const results = [];
  results.push(await checkPython());
  results.push(await checkZensical());
  console.log(chalk.bold("  Prerequisites"));
  console.log(chalk.dim("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
  for (const result of results) {
    if (result.ok) {
      const version = result.version ? chalk.dim(` ${result.version}`) : "";
      const detail = result.detail ? chalk.dim(` (${result.detail})`) : "";
      console.log(`  ${chalk.green("\u2713")} ${result.name}${version}${detail}`);
    } else {
      const detail = result.detail ? chalk.dim(` \u2014 ${result.detail}`) : "";
      console.log(`  ${chalk.red("\u2717")} ${result.name}${detail}`);
    }
  }
  blank();
  const missing = results.filter((r) => !r.ok);
  if (missing.length === 0) {
    log("success", "All prerequisites satisfied!");
    return;
  }
  if (!results[0].ok) {
    log("warn", "Python 3 is required. Install it first:");
    console.log(`    ${chalk.cyan("brew install python")}     ${chalk.dim("# macOS")}`);
    console.log(`    ${chalk.cyan("sudo apt install python3")} ${chalk.dim("# Ubuntu/Debian")}`);
    blank();
    return;
  }
  if (options.install) {
    await installZensical();
  } else {
    log("info", `Run ${chalk.cyan("docwalk doctor --install")} to install Zensical.`);
  }
}
async function installZensical() {
  const { execa } = await import("execa");
  const { mkdir } = await import("fs/promises");
  await mkdir(".docwalk", { recursive: true });
  if (!hasVenv()) {
    log("info", "Creating Python virtual environment in .docwalk/venv/...");
    try {
      await execa("python3", ["-m", "venv", VENV_DIR], { stdio: "inherit" });
    } catch (err) {
      log("error", `Failed to create venv: ${err.message}`);
      return false;
    }
  }
  log("info", `Installing ${ZENSICAL_PACKAGES.join(", ")}...`);
  blank();
  try {
    await execa(venvPip(), ["install", ...ZENSICAL_PACKAGES], { stdio: "inherit" });
    blank();
    log("success", `Zensical installed to ${chalk.dim(".docwalk/venv/")}`);
    return true;
  } catch (err) {
    blank();
    log("error", `Installation failed: ${err.message}`);
    return false;
  }
}
export {
  doctorCommand,
  hasVenv,
  hasZensicalInVenv,
  installZensical,
  zensicalBin
};
