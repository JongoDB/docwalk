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
  it("has four built-in free presets", () => {
    const ids = Object.keys(THEME_PRESETS);
    expect(ids).toHaveLength(4);
    expect(ids.sort()).toEqual(["corporate", "developer", "minimal", "startup"]);
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

  // ── Free vs Premium Tier Tests ──

  it("FREE_PRESET_IDS contains only free presets", () => {
    expect([...FREE_PRESET_IDS].sort()).toEqual(["corporate", "developer", "minimal", "startup"]);
  });

  it("PREMIUM_PRESET_IDS lists premium preset names", () => {
    expect([...PREMIUM_PRESET_IDS].sort()).toEqual(["api-reference", "knowledge-base"]);
  });

  it("getFreePresetIds returns free presets", () => {
    expect(getFreePresetIds().sort()).toEqual(["corporate", "developer", "minimal", "startup"]);
  });

  it("isPremiumPreset identifies free presets as non-premium", () => {
    expect(isPremiumPreset("developer")).toBe(false);
    expect(isPremiumPreset("corporate")).toBe(false);
    expect(isPremiumPreset("startup")).toBe(false);
    expect(isPremiumPreset("minimal")).toBe(false);
  });

  it("isPremiumPreset identifies premium preset IDs", () => {
    // These IDs are premium even though the presets are not bundled in OSS
    expect(isPremiumPreset("api-reference")).toBe(true);
    expect(isPremiumPreset("knowledge-base")).toBe(true);
  });

  it("premium presets are not bundled in OSS THEME_PRESETS", () => {
    expect(THEME_PRESETS["api-reference"]).toBeUndefined();
    expect(THEME_PRESETS["knowledge-base"]).toBeUndefined();
  });

  it("resolvePreset returns undefined for unregistered premium presets", () => {
    // Before premium package is loaded, these return undefined
    expect(resolvePreset("api-reference")).toBeUndefined();
    expect(resolvePreset("knowledge-base")).toBeUndefined();
  });

  it("resolvePreset with requireLicense allows free without key", () => {
    const result = resolvePreset("developer", { requireLicense: true });
    expect(result).toBeDefined();
    expect(result!.id).toBe("developer");
  });

  it("registerPresets adds external presets that become resolvable", () => {
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

  it("getPremiumPresetIds includes registered external presets", () => {
    // test-premium was registered in the previous test
    expect(getPremiumPresetIds()).toContain("test-premium");
  });
});
