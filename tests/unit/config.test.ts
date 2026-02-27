import { describe, it, expect } from "vitest";
import { DocWalkConfigSchema } from "../../src/config/schema";

describe("DocWalkConfigSchema", () => {
  it("validates a minimal config", () => {
    const result = DocWalkConfigSchema.safeParse({
      source: { repo: "owner/repo" },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source.repo).toBe("owner/repo");
      expect(result.data.source.branch).toBe("main");
      expect(result.data.analysis.depth).toBe("full");
      expect(result.data.sync.trigger).toBe("on_push");
      expect(result.data.deploy.provider).toBe("gh-pages");
    }
  });

  it("validates a full config", () => {
    const result = DocWalkConfigSchema.safeParse({
      source: {
        repo: "JongoDB/CYROID",
        branch: "main",
        include: ["src/**"],
        exclude: ["node_modules/**"],
        languages: "auto",
        provider: "github",
      },
      analysis: {
        depth: "full",
        ai_summaries: true,
        ai_provider: { name: "anthropic", api_key_env: "MY_KEY" },
        dependency_graph: true,
        changelog: true,
      },
      sync: {
        trigger: "on_push",
        diff_strategy: "incremental",
        impact_analysis: true,
      },
      deploy: {
        provider: "cloudflare",
        project: "cyroid-docs",
      },
      domain: {
        custom: "docs.fightingsmartcyber.com",
        base_path: "/cyroid",
        dns_auto: true,
      },
      theme: {
        palette: "slate",
        accent: "#5de4c7",
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deploy.provider).toBe("cloudflare");
      expect(result.data.domain.custom).toBe("docs.fightingsmartcyber.com");
      expect(result.data.domain.base_path).toBe("/cyroid");
    }
  });

  it("rejects invalid provider", () => {
    const result = DocWalkConfigSchema.safeParse({
      source: { repo: "owner/repo" },
      deploy: { provider: "invalid-provider" },
    });

    expect(result.success).toBe(false);
  });

  it("applies defaults correctly", () => {
    const result = DocWalkConfigSchema.safeParse({
      source: { repo: "owner/repo" },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.analysis.concurrency).toBe(4);
      expect(result.data.analysis.max_file_size).toBe(500_000);
      expect(result.data.sync.state_file).toBe(".docwalk/state.json");
      expect(result.data.deploy.auto_ssl).toBe(true);
      expect(result.data.theme.features).toContain("search.suggest");
      expect(result.data.versioning.enabled).toBe(false);
    }
  });

  it("layout defaults to tabs", () => {
    const result = DocWalkConfigSchema.safeParse({
      source: { repo: "owner/repo" },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.theme.layout).toBe("tabs");
    }
  });

  it("new page flags default correctly", () => {
    const result = DocWalkConfigSchema.safeParse({
      source: { repo: "owner/repo" },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.analysis.types_page).toBe(true);
      expect(result.data.analysis.dependencies_page).toBe(true);
      expect(result.data.analysis.usage_guide_page).toBe(false);
      expect(result.data.analysis.config_docs).toBe(true);
    }
  });

  it("accepts new preset values", () => {
    const result = DocWalkConfigSchema.safeParse({
      source: { repo: "owner/repo" },
      theme: { preset: "api-reference" },
    });
    expect(result.success).toBe(true);

    const result2 = DocWalkConfigSchema.safeParse({
      source: { repo: "owner/repo" },
      theme: { preset: "knowledge-base" },
    });
    expect(result2.success).toBe(true);
  });

  it("accepts layout values", () => {
    for (const layout of ["tabs", "sidebar", "tabs-sticky"]) {
      const result = DocWalkConfigSchema.safeParse({
        source: { repo: "owner/repo" },
        theme: { layout },
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid layout value", () => {
    const result = DocWalkConfigSchema.safeParse({
      source: { repo: "owner/repo" },
      theme: { layout: "invalid" },
    });
    expect(result.success).toBe(false);
  });
});
