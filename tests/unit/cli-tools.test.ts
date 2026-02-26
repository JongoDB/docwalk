/**
 * CLI Tools Utility Tests
 *
 * Tests the ToolNotFoundError class, error detection logic,
 * and user-friendly formatting.
 */

import { describe, it, expect } from "vitest";
import {
  ToolNotFoundError,
  formatToolError,
} from "../../src/utils/cli-tools.js";

describe("ToolNotFoundError", () => {
  it("creates error with tool name and install hint", () => {
    const err = new ToolNotFoundError(
      "Wrangler (Cloudflare CLI)",
      "npm install -g wrangler",
      "https://developers.cloudflare.com"
    );

    expect(err.name).toBe("ToolNotFoundError");
    expect(err.tool).toBe("Wrangler (Cloudflare CLI)");
    expect(err.installHint).toBe("npm install -g wrangler");
    expect(err.docsUrl).toBe("https://developers.cloudflare.com");
    expect(err.message).toContain("not installed");
  });

  it("is an instance of Error", () => {
    const err = new ToolNotFoundError("test", "install test", "");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("formatToolError", () => {
  it("formats error with install instructions", () => {
    const err = new ToolNotFoundError(
      "Wrangler (Cloudflare CLI)",
      "npm install -g wrangler",
      "https://docs.example.com"
    );
    const output = formatToolError(err);

    expect(output).toContain("not installed");
    expect(output).toContain("npm install -g wrangler");
    expect(output).toContain("https://docs.example.com");
  });

  it("omits docs section when docsUrl is empty", () => {
    const err = new ToolNotFoundError("custom-tool", "install it", "");
    const output = formatToolError(err);

    expect(output).toContain("not installed");
    expect(output).toContain("install it");
    expect(output).not.toContain("Documentation:");
  });
});
