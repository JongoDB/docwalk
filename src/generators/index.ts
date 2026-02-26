export { generateDocs } from "./mkdocs.js";
export type { GenerateOptions } from "./mkdocs.js";
export {
  resolvePreset,
  getPresetIds,
  getFreePresetIds,
  getPremiumPresetIds,
  isPremiumPreset,
  registerPresets,
  loadPremiumPresets,
  FREE_PRESET_IDS,
  PREMIUM_PRESET_IDS,
} from "./theme-presets.js";
export type { ThemePreset } from "./theme-presets.js";
