/**
 * Workspace Resolver Tests
 *
 * Tests monorepo workspace detection for npm, pnpm, and lerna setups.
 * Creates real temp directories to test filesystem-based detection.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import os from "os";
import { detectWorkspaces } from "../../src/analysis/workspace-resolver.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "docwalk-ws-test-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function writeJSON(filePath: string, data: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2));
}

async function createPackage(dir: string, name: string) {
  const pkgDir = path.join(tmpDir, dir);
  await mkdir(pkgDir, { recursive: true });
  await writeJSON(path.join(pkgDir, "package.json"), { name });
}

// ─── npm/yarn workspaces ─────────────────────────────────────────────────────

describe("detectWorkspaces — npm workspaces", () => {
  it("detects workspaces from array format", async () => {
    await writeJSON(path.join(tmpDir, "package.json"), {
      name: "root",
      workspaces: ["packages/*"],
    });
    await createPackage("packages/utils", "@myorg/utils");
    await createPackage("packages/core", "@myorg/core");

    const result = await detectWorkspaces(tmpDir);

    expect(result.type).toBe("npm");
    expect(result.packages.size).toBe(2);
    expect(result.packages.get("@myorg/utils")).toBe("packages/utils");
    expect(result.packages.get("@myorg/core")).toBe("packages/core");
  });

  it("detects workspaces from object format (yarn)", async () => {
    await writeJSON(path.join(tmpDir, "package.json"), {
      name: "root",
      workspaces: { packages: ["packages/*"] },
    });
    await createPackage("packages/lib", "my-lib");

    const result = await detectWorkspaces(tmpDir);

    expect(result.type).toBe("npm");
    expect(result.packages.get("my-lib")).toBe("packages/lib");
  });

  it("handles multiple glob patterns", async () => {
    await writeJSON(path.join(tmpDir, "package.json"), {
      name: "root",
      workspaces: ["packages/*", "apps/*"],
    });
    await createPackage("packages/shared", "@org/shared");
    await createPackage("apps/web", "@org/web");

    const result = await detectWorkspaces(tmpDir);

    expect(result.type).toBe("npm");
    expect(result.packages.size).toBe(2);
    expect(result.packages.has("@org/shared")).toBe(true);
    expect(result.packages.has("@org/web")).toBe(true);
  });

  it("skips packages without a name field", async () => {
    await writeJSON(path.join(tmpDir, "package.json"), {
      name: "root",
      workspaces: ["packages/*"],
    });
    await createPackage("packages/named", "named-pkg");
    // Package with no name
    const noNameDir = path.join(tmpDir, "packages/unnamed");
    await mkdir(noNameDir, { recursive: true });
    await writeJSON(path.join(noNameDir, "package.json"), { version: "1.0.0" });

    const result = await detectWorkspaces(tmpDir);

    expect(result.packages.size).toBe(1);
    expect(result.packages.has("named-pkg")).toBe(true);
  });
});

// ─── pnpm workspaces ─────────────────────────────────────────────────────────

describe("detectWorkspaces — pnpm workspaces", () => {
  it("detects pnpm-workspace.yaml", async () => {
    // No npm workspaces in package.json
    await writeJSON(path.join(tmpDir, "package.json"), { name: "root" });
    await writeFile(
      path.join(tmpDir, "pnpm-workspace.yaml"),
      `packages:\n  - packages/*\n`
    );
    await createPackage("packages/alpha", "@pnpm/alpha");

    const result = await detectWorkspaces(tmpDir);

    expect(result.type).toBe("pnpm");
    expect(result.packages.get("@pnpm/alpha")).toBe("packages/alpha");
  });

  it("handles quoted glob patterns in YAML", async () => {
    await writeJSON(path.join(tmpDir, "package.json"), { name: "root" });
    await writeFile(
      path.join(tmpDir, "pnpm-workspace.yaml"),
      `packages:\n  - 'packages/*'\n  - "apps/*"\n`
    );
    await createPackage("packages/foo", "foo");
    await createPackage("apps/bar", "bar");

    const result = await detectWorkspaces(tmpDir);

    expect(result.type).toBe("pnpm");
    expect(result.packages.size).toBe(2);
  });
});

// ─── lerna ────────────────────────────────────────────────────────────────────

describe("detectWorkspaces — lerna", () => {
  it("detects lerna.json with explicit packages", async () => {
    // No npm workspaces, no pnpm-workspace.yaml
    await writeJSON(path.join(tmpDir, "package.json"), { name: "root" });
    await writeJSON(path.join(tmpDir, "lerna.json"), {
      version: "3.0.0",
      packages: ["modules/*"],
    });
    await createPackage("modules/a", "mod-a");

    const result = await detectWorkspaces(tmpDir);

    expect(result.type).toBe("lerna");
    expect(result.packages.get("mod-a")).toBe("modules/a");
  });

  it("uses default packages/* when lerna.json has no packages field", async () => {
    await writeJSON(path.join(tmpDir, "package.json"), { name: "root" });
    await writeJSON(path.join(tmpDir, "lerna.json"), { version: "3.0.0" });
    await createPackage("packages/default-pkg", "default-pkg");

    const result = await detectWorkspaces(tmpDir);

    expect(result.type).toBe("lerna");
    expect(result.packages.get("default-pkg")).toBe("packages/default-pkg");
  });
});

// ─── No workspaces ───────────────────────────────────────────────────────────

describe("detectWorkspaces — none", () => {
  it("returns none when no workspace config exists", async () => {
    await writeJSON(path.join(tmpDir, "package.json"), { name: "solo" });

    const result = await detectWorkspaces(tmpDir);

    expect(result.type).toBe("none");
    expect(result.packages.size).toBe(0);
  });

  it("returns none when directory has no package.json at all", async () => {
    const result = await detectWorkspaces(tmpDir);

    expect(result.type).toBe("none");
    expect(result.packages.size).toBe(0);
  });

  it("returns none when workspaces array is empty", async () => {
    await writeJSON(path.join(tmpDir, "package.json"), {
      name: "root",
      workspaces: [],
    });

    const result = await detectWorkspaces(tmpDir);

    // Empty globs → no packages found → falls through to pnpm/lerna → none
    expect(result.type).toBe("none");
    expect(result.packages.size).toBe(0);
  });
});

// ─── Priority order ──────────────────────────────────────────────────────────

describe("detectWorkspaces — priority", () => {
  it("prefers npm workspaces over pnpm and lerna", async () => {
    await writeJSON(path.join(tmpDir, "package.json"), {
      name: "root",
      workspaces: ["packages/*"],
    });
    await writeFile(
      path.join(tmpDir, "pnpm-workspace.yaml"),
      `packages:\n  - packages/*\n`
    );
    await writeJSON(path.join(tmpDir, "lerna.json"), {
      packages: ["packages/*"],
    });
    await createPackage("packages/x", "pkg-x");

    const result = await detectWorkspaces(tmpDir);

    expect(result.type).toBe("npm");
  });
});
