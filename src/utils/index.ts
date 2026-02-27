import path from "path";

export { computeFileHash, computeCompositeHash } from "./hash.js";
export { log, header, blank, banner, setVerbose } from "./logger.js";
export type { LogLevel } from "./logger.js";

/**
 * Resolve the repo root directory from config source settings.
 * Handles the case where provider is "local" but repo is an "owner/repo"
 * GitHub-style name rather than a file path — falls back to CWD.
 */
export function resolveRepoRoot(source: { provider: string; repo: string }): string {
  if (source.provider !== "local") {
    return process.cwd();
  }

  const repo = source.repo;

  // If repo looks like a GitHub "owner/repo" rather than a file path, use CWD
  if (repo.includes("/") && !repo.startsWith(".") && !repo.startsWith("/")) {
    return process.cwd();
  }

  return path.resolve(repo);
}
