/**
 * CLI Tool Detection Utilities
 *
 * Provides user-friendly error messages when required external
 * CLI tools (wrangler, vercel, zensical, gh) are not installed.
 */

import chalk from "chalk";

/** Required Python packages for Zensical documentation sites. */
export const ZENSICAL_PACKAGES = ["zensical"];

/** pip install command for Zensical. */
export const ZENSICAL_INSTALL_CMD = `pip install ${ZENSICAL_PACKAGES.join(" ")}`;

/** Known CLI tools with install instructions. */
const TOOL_INFO: Record<string, { name: string; install: string; docs: string }> = {
  wrangler: {
    name: "Wrangler (Cloudflare CLI)",
    install: "npm install -g wrangler",
    docs: "https://developers.cloudflare.com/workers/wrangler/install-and-update/",
  },
  vercel: {
    name: "Vercel CLI",
    install: "npm install -g vercel",
    docs: "https://vercel.com/docs/cli",
  },
  zensical: {
    name: "Zensical",
    install: ZENSICAL_INSTALL_CMD,
    docs: "https://zensical.dev/getting-started/",
  },
  gh: {
    name: "GitHub CLI",
    install: "https://cli.github.com — follow install instructions for your OS",
    docs: "https://cli.github.com/manual/",
  },
  netlify: {
    name: "Netlify CLI",
    install: "npm install -g netlify-cli",
    docs: "https://docs.netlify.com/cli/get-started/",
  },
  aws: {
    name: "AWS CLI",
    install: "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html",
    docs: "https://docs.aws.amazon.com/cli/latest/reference/",
  },
};

/**
 * Error subclass for missing CLI tools, carrying install hints.
 */
export class ToolNotFoundError extends Error {
  constructor(
    public readonly tool: string,
    public readonly installHint: string,
    public readonly docsUrl: string
  ) {
    super(`${tool} is not installed or not found in PATH`);
    this.name = "ToolNotFoundError";
  }
}

/**
 * Check whether an error from execa indicates the command was not found.
 */
function isCommandNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as Record<string, unknown>;

  // execa sets code to ENOENT when the binary doesn't exist
  if (err.code === "ENOENT") return true;

  // On some platforms the shell reports exit code 127
  if (err.exitCode === 127) return true;

  // Windows-specific: ERROR_FILE_NOT_FOUND
  if (typeof err.message === "string" && err.message.includes("is not recognized")) {
    return true;
  }

  return false;
}

/**
 * Run an execa command with user-friendly error handling for missing tools.
 *
 * If the command binary is not found, throws a ToolNotFoundError with
 * install instructions. Otherwise re-throws the original error.
 */
export async function runTool(
  command: string,
  args: string[],
  options?: Record<string, unknown>
): Promise<import("execa").Result> {
  const { execa } = await import("execa");

  try {
    return await execa(command, args, options);
  } catch (error) {
    // Resolve the actual binary name (strip npx wrapper)
    const toolName = command === "npx" ? (args[0] || command) : command;

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

/**
 * Format a ToolNotFoundError into user-friendly CLI output lines.
 */
export function formatToolError(error: ToolNotFoundError): string {
  const lines: string[] = [];
  lines.push(chalk.red(`  ✗ ${error.message}`));
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
