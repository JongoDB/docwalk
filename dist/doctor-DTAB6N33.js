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
async function checkPip() {
  const output = await getCommandOutput("pip3", ["--version"]);
  if (output) {
    const match = output.match(/pip\s+([\d.]+)/);
    const version = match?.[1] ?? "unknown";
    return { name: "pip", ok: true, version };
  }
  const fallback = await getCommandOutput("pip", ["--version"]);
  if (fallback) {
    const match = fallback.match(/pip\s+([\d.]+)/);
    const version = match?.[1] ?? "unknown";
    return { name: "pip", ok: true, version };
  }
  return { name: "pip", ok: false, detail: "not found \u2014 install pip3" };
}
async function checkPackage(pkg) {
  const output = await getCommandOutput("pip3", ["show", pkg]);
  if (output) {
    const match = output.match(/Version:\s*(.+)/);
    const version = match?.[1]?.trim();
    return { name: pkg, ok: true, version };
  }
  const fallback = await getCommandOutput("pip", ["show", pkg]);
  if (fallback) {
    const match = fallback.match(/Version:\s*(.+)/);
    const version = match?.[1]?.trim();
    return { name: pkg, ok: true, version };
  }
  return { name: pkg, ok: false, detail: "not installed" };
}
async function doctorCommand(options) {
  header("Doctor \u2014 Prerequisites Check");
  const results = [];
  results.push(await checkPython());
  results.push(await checkPip());
  for (const pkg of ZENSICAL_PACKAGES) {
    results.push(await checkPackage(pkg));
  }
  console.log(chalk.bold("  Prerequisites"));
  console.log(chalk.dim("  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
  for (const result of results) {
    if (result.ok) {
      const version = result.version ? chalk.dim(` ${result.version}`) : "";
      console.log(`  ${chalk.green("\u2713")} ${result.name}${version}`);
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
export {
  doctorCommand
};
