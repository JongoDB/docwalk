/**
 * Theme Preset Tests
 *
 * Verifies preset resolution, CSS generation, and integration
 * with the MkDocs config generator.
 */

import { describe, it, expect } from "vitest";
import { THEME_PRESETS, resolvePreset, getPresetIds } from "../../src/generators/theme-presets.js";

describe("Theme Presets", () => {
  it("has four built-in presets", () => {
    const ids = getPresetIds();
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
});
