/**
 * Theme Preset Tests
 *
 * Verifies preset resolution, CSS generation, and integration
 * with the MkDocs config generator.
 */

import { describe, it, expect } from "vitest";
import {
  THEME_PRESETS,
  resolvePreset,
  getPresetIds,
  getFreePresetIds,
  getPremiumPresetIds,
  isPremiumPreset,
  registerPresets,
  FREE_PRESET_IDS,
  PREMIUM_PRESET_IDS,
} from "../../src/generators/theme-presets.js";

describe("Theme Presets", () => {
  it("has six built-in presets", () => {
    const ids = getPresetIds();
    expect(ids).toHaveLength(6);
    expect(ids.sort()).toEqual(["api-reference", "corporate", "developer", "knowledge-base", "minimal", "startup"]);
  });

  it("each preset has all required fields", () => {
    for (const [id, preset] of Object.entries(THEME_PRESETS)) {
      expect(preset.id).toBe(id);
      expect(preset.name).toBeTruthy();
      expect(preset.palette.scheme).toBeTruthy();
      expect(preset.palette.primary).toMatch(/^#/);
      expect(preset.palette.accent).toMatch(/^#/);
      expect(preset.features.length).toBeGreaterThan(0);
      expect(preset.fonts.text).toBeTruthy();
      expect(preset.fonts.code).toBeTruthy();
      expect(preset.customCss.length).toBeGreaterThan(0);
    }
  });

  it("corporate preset uses navy primary", () => {
    const preset = resolvePreset("corporate")!;
    expect(preset.palette.primary).toBe("#1a237e");
    expect(preset.palette.scheme).toBe("default");
    expect(preset.fonts.text).toBe("Roboto");
  });

  it("startup preset uses purple/amber with dark toggle", () => {
    const preset = resolvePreset("startup")!;
    expect(preset.palette.primary).toBe("#7c3aed");
    expect(preset.palette.accent).toBe("#f59e0b");
    expect(preset.palette.toggleScheme).toBe("slate");
    expect(preset.fonts.text).toBe("Inter");
    expect(preset.fonts.code).toBe("Fira Code");
  });

  it("developer preset uses slate scheme with mint accent", () => {
    const preset = resolvePreset("developer")!;
    expect(preset.palette.scheme).toBe("slate");
    expect(preset.palette.primary).toBe("#5de4c7");
    expect(preset.fonts.text).toBe("Inter");
  });

  it("minimal preset uses gray tones and serif font", () => {
    const preset = resolvePreset("minimal")!;
    expect(preset.palette.scheme).toBe("default");
    expect(preset.palette.primary).toBe("#374151");
    expect(preset.fonts.text).toBe("Source Serif 4");
    expect(preset.fonts.code).toBe("Source Code Pro");
  });

  it("custom preset returns undefined", () => {
    expect(resolvePreset("custom")).toBeUndefined();
  });

  it("unknown preset returns undefined", () => {
    expect(resolvePreset("nonexistent")).toBeUndefined();
  });

  it("generated CSS contains expected custom properties", () => {
    for (const preset of Object.values(THEME_PRESETS)) {
      expect(preset.customCss).toContain("--md-primary-fg-color");
      expect(preset.customCss).toContain(preset.palette.primary);
    }
  });

  it("each preset CSS contains valid CSS syntax", () => {
    for (const preset of Object.values(THEME_PRESETS)) {
      // Should contain at least one rule block
      expect(preset.customCss).toContain("{");
      expect(preset.customCss).toContain("}");
      // Opening and closing braces should be balanced
      const opens = (preset.customCss.match(/{/g) || []).length;
      const closes = (preset.customCss.match(/}/g) || []).length;
      expect(opens).toBe(closes);
    }
  });

  it("developer preset has code-focused features", () => {
    const preset = resolvePreset("developer")!;
    expect(preset.features).toContain("content.code.copy");
    expect(preset.features).toContain("content.code.annotate");
  });

  it("minimal preset omits navigation tabs", () => {
    const preset = resolvePreset("minimal")!;
    expect(preset.features).not.toContain("navigation.tabs");
  });

  it("api-reference preset has toc.integrate and content.code.select", () => {
    const preset = resolvePreset("api-reference")!;
    expect(preset.palette.scheme).toBe("slate");
    expect(preset.palette.primary).toBe("#1e88e5");
    expect(preset.palette.accent).toBe("#82b1ff");
    expect(preset.features).toContain("toc.integrate");
    expect(preset.features).toContain("content.code.select");
    expect(preset.features).toContain("content.code.annotate");
    expect(preset.fonts.text).toBe("Inter");
    expect(preset.fonts.code).toBe("JetBrains Mono");
  });

  it("knowledge-base preset has sticky tabs, breadcrumbs, and prune", () => {
    const preset = resolvePreset("knowledge-base")!;
    expect(preset.palette.scheme).toBe("default");
    expect(preset.palette.primary).toBe("#2e7d32");
    expect(preset.palette.accent).toBe("#66bb6a");
    expect(preset.features).toContain("navigation.tabs.sticky");
    expect(preset.features).toContain("navigation.path");
    expect(preset.features).toContain("navigation.prune");
    expect(preset.features).toContain("search.share");
    expect(preset.fonts.text).toBe("Noto Sans");
    expect(preset.fonts.code).toBe("Fira Code");
  });

  // ── Free vs Premium Tier Tests ──

  it("FREE_PRESET_IDS contains only free presets", () => {
    expect([...FREE_PRESET_IDS].sort()).toEqual(["corporate", "developer", "minimal", "startup"]);
  });

  it("PREMIUM_PRESET_IDS contains only premium presets", () => {
    expect([...PREMIUM_PRESET_IDS].sort()).toEqual(["api-reference", "knowledge-base"]);
  });

  it("getFreePresetIds returns free presets", () => {
    expect(getFreePresetIds().sort()).toEqual(["corporate", "developer", "minimal", "startup"]);
  });

  it("getPremiumPresetIds returns premium presets", () => {
    expect(getPremiumPresetIds()).toContain("api-reference");
    expect(getPremiumPresetIds()).toContain("knowledge-base");
  });

  it("isPremiumPreset correctly identifies tiers", () => {
    expect(isPremiumPreset("developer")).toBe(false);
    expect(isPremiumPreset("corporate")).toBe(false);
    expect(isPremiumPreset("api-reference")).toBe(true);
    expect(isPremiumPreset("knowledge-base")).toBe(true);
  });

  it("resolvePreset with requireLicense blocks premium without key", () => {
    const result = resolvePreset("api-reference", { requireLicense: true });
    expect(result).toBeUndefined();
  });

  it("resolvePreset with requireLicense allows premium with key", () => {
    const result = resolvePreset("api-reference", { requireLicense: true, licenseKey: "test-key" });
    expect(result).toBeDefined();
    expect(result!.id).toBe("api-reference");
  });

  it("resolvePreset with requireLicense allows free without key", () => {
    const result = resolvePreset("developer", { requireLicense: true });
    expect(result).toBeDefined();
    expect(result!.id).toBe("developer");
  });

  it("registerPresets adds external presets", () => {
    const countBefore = getPresetIds().length;
    registerPresets({
      "test-premium": {
        id: "test-premium",
        name: "Test Premium",
        palette: { scheme: "slate", primary: "#ff0000", accent: "#00ff00" },
        cssVars: { "--md-primary-fg-color": "#ff0000" },
        features: ["navigation.tabs"],
        fonts: { text: "Arial", code: "monospace" },
        customCss: ":root { --md-primary-fg-color: #ff0000; }",
      },
    });
    expect(getPresetIds().length).toBe(countBefore + 1);
    expect(resolvePreset("test-premium")).toBeDefined();
    expect(isPremiumPreset("test-premium")).toBe(true);
  });
});
