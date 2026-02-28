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
  it("has five built-in providers", () => {
    const providers = getAvailableProviders();
    expect(providers.length).toBe(5);
    expect(providers.map((p) => p.id).sort()).toEqual([
      "cloudflare",
      "gh-pages",
      "netlify",
      "s3",
      "vercel",
    ]);
  });

  it("returns undefined for unknown provider", () => {
    expect(getProvider("unknown-provider")).toBeUndefined();
  });

  it("can look up each provider by id", () => {
    for (const id of ["gh-pages", "cloudflare", "vercel", "netlify", "s3"]) {
      expect(getProvider(id)).toBeDefined();
      expect(getProvider(id)!.id).toBe(id);
    }
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
    expect(ci.content).toContain("zensical build");
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

describe("Netlify Provider", () => {
  const provider = getProvider("netlify")!;

  it("generates deploy workflow with netlify action", async () => {
    const ci = await provider.generateCIConfig(defaultDeploy, defaultDomain);
    expect(ci.path).toBe(".github/workflows/docwalk-deploy.yml");
    expect(ci.content).toContain("nwtgck/actions-netlify@v3");
    expect(ci.content).toContain("NETLIFY_AUTH_TOKEN");
    expect(ci.content).toContain("NETLIFY_SITE_ID");
    expect(ci.content).toContain("production-deploy: true");
  });

  it("generates preview workflow without production deploy", async () => {
    const ci = await provider.generatePreviewCIConfig(defaultDeploy, defaultDomain);
    expect(ci.path).toBe(".github/workflows/docwalk-preview.yml");
    expect(ci.content).toContain("pull_request:");
    expect(ci.content).toContain("production-deploy: false");
    expect(ci.content).toContain("Comment on PR");
  });
});

describe("S3 Provider", () => {
  const provider = getProvider("s3")!;

  it("generates deploy workflow with AWS credentials action", async () => {
    const ci = await provider.generateCIConfig(
      { ...defaultDeploy, project: "my-docs-bucket" },
      defaultDomain
    );
    expect(ci.path).toBe(".github/workflows/docwalk-deploy.yml");
    expect(ci.content).toContain("aws-actions/configure-aws-credentials@v4");
    expect(ci.content).toContain("AWS_ACCESS_KEY_ID");
    expect(ci.content).toContain("aws s3 sync");
    expect(ci.content).toContain("my-docs-bucket");
  });

  it("generates preview workflow with PR-specific S3 prefix", async () => {
    const ci = await provider.generatePreviewCIConfig(
      { ...defaultDeploy, project: "my-docs-bucket" },
      defaultDomain
    );
    expect(ci.path).toBe(".github/workflows/docwalk-preview.yml");
    expect(ci.content).toContain("pull_request:");
    expect(ci.content).toContain("pr-${{ github.event.pull_request.number }}");
    expect(ci.content).toContain("Comment on PR");
  });

  it("includes CloudFront invalidation when configured", async () => {
    const ci = await provider.generateCIConfig(
      {
        ...defaultDeploy,
        project: "my-docs-bucket",
        provider_config: { cloudfront_distribution_id: "EDIST123" },
      },
      defaultDomain
    );
    expect(ci.content).toContain("Invalidate CloudFront");
    expect(ci.content).toContain("EDIST123");
  });
});

describe("Workflow Common Patterns", () => {
  it("all deploy workflows install docwalk and zensical", async () => {
    for (const id of ["gh-pages", "cloudflare", "vercel", "netlify", "s3"]) {
      const provider = getProvider(id)!;
      const ci = await provider.generateCIConfig(defaultDeploy, defaultDomain);
      expect(ci.content).toContain("npm install -g docwalk");
      expect(ci.content).toContain("pip install zensical");
      expect(ci.content).toContain('node-version: "20"');
    }
  });

  it("all deploy workflows fetch full git history", async () => {
    for (const id of ["gh-pages", "cloudflare", "vercel", "netlify", "s3"]) {
      const provider = getProvider(id)!;
      const ci = await provider.generateCIConfig(defaultDeploy, defaultDomain);
      expect(ci.content).toContain("fetch-depth: 0");
    }
  });

  it("all preview workflows generate docs with --full", async () => {
    for (const id of ["gh-pages", "cloudflare", "vercel", "netlify", "s3"]) {
      const provider = getProvider(id)!;
      const ci = await provider.generatePreviewCIConfig(defaultDeploy, defaultDomain);
      expect(ci.content).toContain("docwalk generate --full");
    }
  });
});
