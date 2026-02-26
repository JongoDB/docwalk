/**
 * DocWalk Logger
 *
 * Structured, colorful logging for CLI output.
 */

import chalk from "chalk";

export type LogLevel = "debug" | "info" | "warn" | "error" | "success";

const PREFIXES: Record<LogLevel, string> = {
  debug: chalk.dim("  ⠿"),
  info: chalk.blue("  ℹ"),
  warn: chalk.yellow("  ⚠"),
  error: chalk.red("  ✗"),
  success: chalk.green("  ✓"),
};

let verbose = false;

export function setVerbose(v: boolean): void {
  verbose = v;
}

export function log(level: LogLevel, message: string): void {
  if (level === "debug" && !verbose) return;

  const prefix = PREFIXES[level];
  const coloredMsg =
    level === "error"
      ? chalk.red(message)
      : level === "warn"
        ? chalk.yellow(message)
        : level === "success"
          ? chalk.green(message)
          : level === "debug"
            ? chalk.dim(message)
            : message;

  console.log(`${prefix} ${coloredMsg}`);
}

export function header(text: string): void {
  console.log();
  console.log(chalk.bold(text));
  console.log(chalk.dim("─".repeat(Math.min(text.length + 4, 60))));
}

export function blank(): void {
  console.log();
}

export function banner(): void {
  console.log();
  console.log(
    chalk.hex("#5de4c7").bold("  ⚒  DocWalk") +
      chalk.dim(" — Your codebase, documented.")
  );
  console.log();
}
