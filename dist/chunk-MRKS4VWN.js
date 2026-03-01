// src/utils/cli-tools.ts
import chalk from "chalk";
var ZENSICAL_PACKAGES = ["zensical"];
var ZENSICAL_INSTALL_CMD = `pip install ${ZENSICAL_PACKAGES.join(" ")}`;
var TOOL_INFO = {
  wrangler: {
    name: "Wrangler (Cloudflare CLI)",
    install: "npm install -g wrangler",
    docs: "https://developers.cloudflare.com/workers/wrangler/install-and-update/"
  },
  vercel: {
    name: "Vercel CLI",
    install: "npm install -g vercel",
    docs: "https://vercel.com/docs/cli"
  },
  zensical: {
    name: "Zensical",
    install: ZENSICAL_INSTALL_CMD,
    docs: "https://zensical.dev/getting-started/"
  },
  gh: {
    name: "GitHub CLI",
    install: "https://cli.github.com \u2014 follow install instructions for your OS",
    docs: "https://cli.github.com/manual/"
  },
  netlify: {
    name: "Netlify CLI",
    install: "npm install -g netlify-cli",
    docs: "https://docs.netlify.com/cli/get-started/"
  },
  aws: {
    name: "AWS CLI",
    install: "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html",
    docs: "https://docs.aws.amazon.com/cli/latest/reference/"
  }
};
var ToolNotFoundError = class extends Error {
  constructor(tool, installHint, docsUrl) {
    super(`${tool} is not installed or not found in PATH`);
    this.tool = tool;
    this.installHint = installHint;
    this.docsUrl = docsUrl;
    this.name = "ToolNotFoundError";
  }
};
function isCommandNotFound(error) {
  if (!error || typeof error !== "object") return false;
  const err = error;
  if (err.code === "ENOENT") return true;
  if (err.exitCode === 127) return true;
  if (typeof err.message === "string" && err.message.includes("is not recognized")) {
    return true;
  }
  return false;
}
async function runTool(command, args, options) {
  const { execa } = await import("execa");
  try {
    return await execa(command, args, options);
  } catch (error) {
    const toolName = command === "npx" ? args[0] || command : command;
    if (isCommandNotFound(error)) {
      const info = TOOL_INFO[toolName];
      if (info) {
        throw new ToolNotFoundError(info.name, info.install, info.docs);
      }
      throw new ToolNotFoundError(
        toolName,
        `Install ${toolName} and ensure it is available in your PATH`,
        ""
      );
    }
    throw error;
  }
}
function formatToolError(error) {
  const lines = [];
  lines.push(chalk.red(`  \u2717 ${error.message}`));
  lines.push("");
  lines.push(chalk.dim("  To install:"));
  lines.push(`    ${chalk.cyan(error.installHint)}`);
  if (error.docsUrl) {
    lines.push("");
    lines.push(chalk.dim("  Documentation:"));
    lines.push(`    ${chalk.dim(error.docsUrl)}`);
  }
  return lines.join("\n");
}

export {
  ZENSICAL_PACKAGES,
  ZENSICAL_INSTALL_CMD,
  ToolNotFoundError,
  runTool,
  formatToolError
};
