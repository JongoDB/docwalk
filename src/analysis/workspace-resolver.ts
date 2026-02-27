/**
 * Workspace Resolver
 *
 * Detects monorepo workspace structures (npm workspaces, pnpm-workspace.yaml,
 * lerna.json) and builds a map of package names to their directory paths.
 * This enables cross-package import resolution in dependency graphs.
 */

import { readFile } from "fs/promises";
import path from "path";
import fg from "fast-glob";

export interface WorkspaceInfo {
  /** Map of package name (e.g., "@org/utils") to directory path relative to repo root */
  packages: Map<string, string>;
  /** Detected workspace type */
  type: "npm" | "pnpm" | "lerna" | "none";
}

/**
 * Detect workspace structure and build a package name → directory map.
 */
export async function detectWorkspaces(repoRoot: string): Promise<WorkspaceInfo> {
  // Try npm/yarn workspaces (package.json)
  try {
    const pkgJsonPath = path.join(repoRoot, "package.json");
    const pkgJson = JSON.parse(await readFile(pkgJsonPath, "utf-8"));
    const workspaceGlobs = pkgJson.workspaces;

    if (workspaceGlobs) {
      // Normalize: workspaces can be string[] or { packages: string[] }
      const globs: string[] = Array.isArray(workspaceGlobs)
        ? workspaceGlobs
        : workspaceGlobs.packages || [];

      const packages = await resolveWorkspaceGlobs(repoRoot, globs);
      if (packages.size > 0) {
        return { packages, type: "npm" };
      }
    }
  } catch {
    // No package.json or parse error — continue
  }

  // Try pnpm-workspace.yaml
  try {
    const pnpmPath = path.join(repoRoot, "pnpm-workspace.yaml");
    const content = await readFile(pnpmPath, "utf-8");
    // Simple YAML parsing for the packages field
    const packagesMatch = content.match(/packages:\s*\n((?:\s+-\s+.+\n?)*)/);
    if (packagesMatch) {
      const globs = packagesMatch[1]
        .split("\n")
        .map((line) => line.replace(/^\s*-\s*['"]?/, "").replace(/['"]?\s*$/, ""))
        .filter(Boolean);

      const packages = await resolveWorkspaceGlobs(repoRoot, globs);
      if (packages.size > 0) {
        return { packages, type: "pnpm" };
      }
    }
  } catch {
    // No pnpm-workspace.yaml — continue
  }

  // Try lerna.json
  try {
    const lernaPath = path.join(repoRoot, "lerna.json");
    const lernaJson = JSON.parse(await readFile(lernaPath, "utf-8"));
    const globs: string[] = lernaJson.packages || ["packages/*"];

    const packages = await resolveWorkspaceGlobs(repoRoot, globs);
    if (packages.size > 0) {
      return { packages, type: "lerna" };
    }
  } catch {
    // No lerna.json — continue
  }

  return { packages: new Map(), type: "none" };
}

/**
 * Resolve workspace glob patterns to a map of package name → directory path.
 */
async function resolveWorkspaceGlobs(
  repoRoot: string,
  globs: string[]
): Promise<Map<string, string>> {
  const packages = new Map<string, string>();

  // Expand glob patterns to find package directories
  const packageJsonGlobs = globs.map((g) => `${g}/package.json`);
  const matches = await fg(packageJsonGlobs, {
    cwd: repoRoot,
    onlyFiles: true,
    ignore: ["**/node_modules/**"],
  });

  for (const match of matches) {
    try {
      const fullPath = path.join(repoRoot, match);
      const pkgJson = JSON.parse(await readFile(fullPath, "utf-8"));
      const name = pkgJson.name;
      if (name) {
        // Directory path relative to repo root
        const dir = path.dirname(match);
        packages.set(name, dir);
      }
    } catch {
      // Skip packages we can't parse
    }
  }

  return packages;
}
