/**
 * File Discovery
 *
 * Discovers source files in a repository using fast-glob,
 * respecting include/exclude patterns from configuration.
 */

import fg from "fast-glob";
import type { SourceConfig } from "../config/schema.js";
import path from "path";

/**
 * Discover all source files matching the configured patterns.
 *
 * @param repoRoot - Absolute path to the repository root
 * @param source - Source configuration with include/exclude globs
 * @returns Array of file paths relative to repoRoot
 */
export async function discoverFiles(
  repoRoot: string,
  source: SourceConfig
): Promise<string[]> {
  const files = await fg(source.include, {
    cwd: repoRoot,
    ignore: source.exclude,
    dot: false,
    onlyFiles: true,
    followSymbolicLinks: false,
    absolute: false,
  });

  // Sort for deterministic output
  return files.sort();
}

/**
 * Discover files that match a specific set of paths (for incremental sync).
 * Validates that each path still exists and matches include/exclude rules.
 */
export async function validateFilePaths(
  repoRoot: string,
  filePaths: string[],
  source: SourceConfig
): Promise<string[]> {
  const allFiles = await discoverFiles(repoRoot, source);
  const allFileSet = new Set(allFiles);

  return filePaths.filter((fp) => allFileSet.has(fp));
}
