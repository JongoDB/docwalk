/**
 * Hooks System Tests
 *
 * Tests the executeHooks function: sequential execution,
 * no-op on missing/empty config, and error propagation.
 */

import { describe, it, expect } from "vitest";
import { executeHooks } from "../../src/utils/hooks.js";
import type { HooksConfig } from "../../src/config/schema.js";

describe("executeHooks", () => {
  it("no-ops when hooksConfig is undefined", async () => {
    // Should not throw
    await executeHooks("pre_build", undefined);
  });

  it("no-ops when hook array is undefined", async () => {
    const config: HooksConfig = {};
    await executeHooks("pre_build", config);
  });

  it("no-ops when hook array is empty", async () => {
    const config: HooksConfig = { pre_build: [] };
    await executeHooks("pre_build", config);
  });

  it("executes a simple echo command", async () => {
    const output: string[] = [];
    const config: HooksConfig = {
      pre_build: ["echo hello"],
    };

    await executeHooks("pre_build", config, {
      onOutput: (line) => output.push(line),
    });

    expect(output).toContain("hello");
  });

  it("executes hooks sequentially in order", async () => {
    const output: string[] = [];
    const config: HooksConfig = {
      pre_build: ["echo first", "echo second", "echo third"],
    };

    await executeHooks("pre_build", config, {
      onOutput: (line) => output.push(line),
    });

    expect(output).toEqual(["first", "second", "third"]);
  });

  it("throws on command failure with context", async () => {
    const config: HooksConfig = {
      pre_deploy: ["exit 1"],
    };

    await expect(
      executeHooks("pre_deploy", config)
    ).rejects.toThrow('Hook "pre_deploy" failed on command: exit 1');
  });

  it("stops execution on first failure", async () => {
    const output: string[] = [];
    const config: HooksConfig = {
      post_build: ["echo before", "exit 1", "echo after"],
    };

    await expect(
      executeHooks("post_build", config, {
        onOutput: (line) => output.push(line),
      })
    ).rejects.toThrow();

    expect(output).toContain("before");
    expect(output).not.toContain("after");
  });

  it("supports all six hook names", async () => {
    const hookNames = [
      "pre_analyze",
      "post_analyze",
      "pre_build",
      "post_build",
      "pre_deploy",
      "post_deploy",
    ] as const;

    for (const hookName of hookNames) {
      const config: HooksConfig = { [hookName]: ["echo test"] };
      await expect(executeHooks(hookName, config)).resolves.not.toThrow();
    }
  });
});
