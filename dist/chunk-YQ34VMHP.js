// src/utils/logger.ts
import chalk from "chalk";
var PREFIXES = {
  debug: chalk.dim("  \u283F"),
  info: chalk.blue("  \u2139"),
  warn: chalk.yellow("  \u26A0"),
  error: chalk.red("  \u2717"),
  success: chalk.green("  \u2713")
};
var verbose = false;
function setVerbose(v) {
  verbose = v;
}
function log(level, message) {
  if (level === "debug" && !verbose) return;
  const prefix = PREFIXES[level];
  const coloredMsg = level === "error" ? chalk.red(message) : level === "warn" ? chalk.yellow(message) : level === "success" ? chalk.green(message) : level === "debug" ? chalk.dim(message) : message;
  console.log(`${prefix} ${coloredMsg}`);
}
function header(text) {
  console.log();
  console.log(chalk.bold(text));
  console.log(chalk.dim("\u2500".repeat(Math.min(text.length + 4, 60))));
}
function blank() {
  console.log();
}
function banner() {
  console.log();
  console.log(
    chalk.hex("#5de4c7").bold("  \u2692  DocWalk") + chalk.dim(" \u2014 Your codebase, documented.")
  );
  console.log();
}

export {
  setVerbose,
  log,
  header,
  blank,
  banner
};
