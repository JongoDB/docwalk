/**
 * DocWalk CLI — doctor command
 *
 * Checks all MkDocs prerequisites (Python, pip, required packages)
 * and optionally installs missing packages with --install.
 */

import chalk from "chalk";
import { MKDOCS_PACKAGES } from "../../utils/cli-tools.js";
import { log, header, blank } from "../../utils/logger.js";

interface DoctorOptions {
  install?: boolean;
}

interface CheckResult {
  name: string;
  ok: boolean;
  version?: string;
  detail?: string;
}

async function getCommandOutput(command: string, args: string[]): Promise<string | null> {
  try {
    const { execa } = await import("execa");
    const result = await execa(command, args);
    return (result.stdout ?? "").trim();
  } catch {
    return null;
  }
}

async function checkPython(): Promise<CheckResult> {
  const output = await getCommandOutput("python3", ["--version"]);
  if (output) {
    const version = output.replace("Python ", "");
    return { name: "Python", ok: true, version };
  }
  return { name: "Python", ok: false, detail: "not found — install python3" };
}

async function checkPip(): Promise<CheckResult> {
  const output = await getCommandOutput("pip3", ["--version"]);
  if (output) {
    const match = output.match(/pip\s+([\d.]+)/);
    const version = match?.[1] ?? "unknown";
    return { name: "pip", ok: true, version };
  }
  // Fallback: try pip
  const fallback = await getCommandOutput("pip", ["--version"]);
  if (fallback) {
    const match = fallback.match(/pip\s+([\d.]+)/);
    const version = match?.[1] ?? "unknown";
    return { name: "pip", ok: true, version };
  }
  return { name: "pip", ok: false, detail: "not found — install pip3" };
}

async function checkPackage(pkg: string): Promise<CheckResult> {
  const output = await getCommandOutput("pip3", ["show", pkg]);
  if (output) {
    const match = output.match(/Version:\s*(.+)/);
    const version = match?.[1]?.trim();
    return { name: pkg, ok: true, version };
  }
  // Fallback: try pip
  const fallback = await getCommandOutput("pip", ["show", pkg]);
  if (fallback) {
    const match = fallback.match(/Version:\s*(.+)/);
    const version = match?.[1]?.trim();
    return { name: pkg, ok: true, version };
  }
  return { name: pkg, ok: false, detail: "not installed" };
}

export async function doctorCommand(options: DoctorOptions): Promise<void> {
  header("Doctor — Prerequisites Check");

  const results: CheckResult[] = [];

  // Check Python and pip
  results.push(await checkPython());
  results.push(await checkPip());

  // Check each required package
  for (const pkg of MKDOCS_PACKAGES) {
    results.push(await checkPackage(pkg));
  }

  // Display results
  console.log(chalk.bold("  Prerequisites"));
  console.log(chalk.dim("  ──────────────────────────"));

  for (const result of results) {
    if (result.ok) {
      const version = result.version ? chalk.dim(` ${result.version}`) : "";
      console.log(`  ${chalk.green("✓")} ${result.name}${version}`);
    } else {
      const detail = result.detail ? chalk.dim(` — ${result.detail}`) : "";
      console.log(`  ${chalk.red("✗")} ${result.name}${detail}`);
    }
  }

  blank();

  const missing = results.filter((r) => !r.ok);

  if (missing.length === 0) {
    log("success", "All prerequisites satisfied!");
    return;
  }

  // Separate system deps (python/pip) from pip packages
  const missingSystem = missing.filter((r) => r.name === "Python" || r.name === "pip");
  const missingPackages = missing.filter((r) => r.name !== "Python" && r.name !== "pip");

  if (missingSystem.length > 0) {
    log("warn", "Python/pip must be installed first:");
    console.log(`    ${chalk.cyan("brew install python")}     ${chalk.dim("# macOS")}`);
    console.log(`    ${chalk.cyan("sudo apt install python3")} ${chalk.dim("# Ubuntu/Debian")}`);
    blank();
  }

  if (missingPackages.length > 0) {
    if (options.install) {
      // Install missing packages
      log("info", "Installing missing packages...");
      blank();

      const packagesToInstall = missingPackages.map((r) => r.name);

      try {
        const { execa } = await import("execa");
        await execa("pip3", ["install", ...packagesToInstall], { stdio: "inherit" });
        blank();
        log("success", `Installed: ${packagesToInstall.join(", ")}`);
      } catch {
        try {
          const { execa } = await import("execa");
          await execa("pip", ["install", ...packagesToInstall], { stdio: "inherit" });
          blank();
          log("success", `Installed: ${packagesToInstall.join(", ")}`);
        } catch {
          blank();
          log("error", "Installation failed. Try manually:");
          console.log(`    ${chalk.cyan(`pip install ${packagesToInstall.join(" ")}`)}`);
        }
      }
    } else {
      log("info", `Run ${chalk.cyan("docwalk doctor --install")} to install missing packages.`);
    }
  }
}
