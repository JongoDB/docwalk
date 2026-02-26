/**
 * Deploy Provider Tests
 *
 * Tests CI config generation (deploy + preview workflows),
 * undeploy methods, and provider registry.
 */

import { describe, it, expect } from "vitest";
import { getProvider, getAvailableProviders } from "../../src/deploy/index.js";
import type { DeployConfig, DomainConfig } from "../../src/config/schema.js";

const defaultDeploy: DeployConfig = {
  provider: "gh-pages",
  auto_ssl: true,
  output_dir: "site",
};

const defaultDomain: DomainConfig = {
  base_path: "/",
  dns_auto: true,
};

describe("Provider Registry", () => {
  it("has three built-in providers", () => {
    const providers = getAvailableProviders();
    expect(providers.length).toBe(3);
    expect(providers.map((p) => p.id).sort()).toEqual([
      "cloudflare",
      "gh-pages",
      "vercel",
    ]);
  });

  it("returns undefined for unknown provider", () => {
    expect(getProvider("netlify")).toBeUndefined();
  });
});

describe("GitHub Pages Provider", () => {
  const provider = getProvider("gh-pages")!;

  it("generates valid deploy workflow YAML", async () => {
    const ci = await provider.generateCIConfig(defaultDeploy, defaultDomain);
    expect(ci.path).toBe(".github/workflows/docwalk-deploy.yml");
    expect(ci.content).toContain("Deploy Documentation");
    expect(ci.content).toContain("actions/checkout@v4");
    expect(ci.content).toContain("actions/deploy-pages@v4");
    expect(ci.content).toContain("docwalk sync");
    expect(ci.content).toContain("mkdocs build");
  });

  it("generates valid preview workflow YAML", async () => {
    const ci = await provider.generatePreviewCIConfig(defaultDeploy, defaultDomain);
    expect(ci.path).toBe(".github/workflows/docwalk-preview.yml");
    expect(ci.content).toContain("PR Documentation Preview");
    expect(ci.content).toContain("pull_request");
    expect(ci.content).toContain("upload-artifact@v4");
    expect(ci.content).toContain("Comment on PR");
  });

  it("deploy workflow triggers on push to main", async () => {
    const ci = await provider.generateCIConfig(defaultDeploy, defaultDomain);
    expect(ci.content).toContain("branches: [main]");
    expect(ci.content).toContain("push:");
  });

  it("preview workflow triggers on pull_request", async () => {
    const ci = await provider.generatePreviewCIConfig(defaultDeploy, defaultDomain);
    expect(ci.content).toContain("pull_request:");
    expect(ci.content).not.toContain("push:");
  });
});

describe("Cloudflare Provider", () => {
  const provider = getProvider("cloudflare")!;

  it("generates deploy workflow with wrangler action", async () => {
    const ci = await provider.generateCIConfig(
      { ...defaultDeploy, project: "my-docs" },
      defaultDomain
    );
    expect(ci.content).toContain("cloudflare/wrangler-action@v3");
    expect(ci.content).toContain("CLOUDFLARE_API_TOKEN");
    expect(ci.content).toContain("my-docs");
  });

  it("generates preview workflow with branch deploy", async () => {
    const ci = await provider.generatePreviewCIConfig(
      { ...defaultDeploy, project: "my-docs" },
      defaultDomain
    );
    expect(ci.path).toBe(".github/workflows/docwalk-preview.yml");
    expect(ci.content).toContain("pull_request:");
    expect(ci.content).toContain("pr-${{ github.event.pull_request.number }}");
    expect(ci.content).toContain("Comment on PR");
  });
});

describe("Vercel Provider", () => {
  const provider = getProvider("vercel")!;

  it("generates deploy workflow with vercel action", async () => {
    const ci = await provider.generateCIConfig(defaultDeploy, defaultDomain);
    expect(ci.content).toContain("amondnet/vercel-action@v25");
    expect(ci.content).toContain("VERCEL_TOKEN");
    expect(ci.content).toContain("--prod");
  });

  it("generates preview workflow without --prod flag", async () => {
    const ci = await provider.generatePreviewCIConfig(defaultDeploy, defaultDomain);
    expect(ci.path).toBe(".github/workflows/docwalk-preview.yml");
    expect(ci.content).toContain("pull_request:");
    expect(ci.content).toContain("Comment on PR");
    // Preview should not have --prod
    expect(ci.content).not.toContain("--prod");
  });
});

describe("Workflow Common Patterns", () => {
  it("all deploy workflows install docwalk and mkdocs", async () => {
    for (const id of ["gh-pages", "cloudflare", "vercel"]) {
      const provider = getProvider(id)!;
      const ci = await provider.generateCIConfig(defaultDeploy, defaultDomain);
      expect(ci.content).toContain("npm install -g docwalk");
      expect(ci.content).toContain("pip install mkdocs-material");
      expect(ci.content).toContain('node-version: "20"');
    }
  });

  it("all deploy workflows fetch full git history", async () => {
    for (const id of ["gh-pages", "cloudflare", "vercel"]) {
      const provider = getProvider(id)!;
      const ci = await provider.generateCIConfig(defaultDeploy, defaultDomain);
      expect(ci.content).toContain("fetch-depth: 0");
    }
  });

  it("all preview workflows generate docs with --full", async () => {
    for (const id of ["gh-pages", "cloudflare", "vercel"]) {
      const provider = getProvider(id)!;
      const ci = await provider.generatePreviewCIConfig(defaultDeploy, defaultDomain);
      expect(ci.content).toContain("docwalk generate --full");
    }
  });
});
