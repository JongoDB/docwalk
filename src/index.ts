/**
 * DocWalk — Programmatic API
 *
 * This is the main entry point for using DocWalk as a library.
 * For CLI usage, see src/cli/index.ts.
 */

// ─── Configuration ──────────────────────────────────────────────────────────
export {
  DocWalkConfigSchema,
  loadConfig,
  loadConfigFile,
  ConfigNotFoundError,
  ConfigValidationError,
} from "./config/index.js";

export type {
  DocWalkConfig,
  SourceConfig,
  AnalysisConfig,
  SyncConfig,
  DeployConfig,
  DomainConfig,
  ThemeConfig,
  VersioningConfig,
  PluginConfig,
  HooksConfig,
  LoadConfigResult,
} from "./config/index.js";

// ─── Analysis ───────────────────────────────────────────────────────────────
export {
  analyzeCodebase,
  detectLanguage,
  getSupportedLanguages,
  getLanguageDisplayName,
  discoverFiles,
  getParser,
  registerParser,
  getRegisteredLanguages,
} from "./analysis/index.js";

export type {
  AnalysisOptions,
  LanguageId,
  LanguageParser,
  ParserResult,
  Symbol,
  SymbolKind,
  ModuleInfo,
  AnalysisManifest,
  DependencyGraph,
  FileDiff,
  DiffStatus,
  SyncState,
  SyncResult,
  GeneratedPage,
  NavigationItem,
  GenerationResult,
} from "./analysis/index.js";

// ─── Sync ───────────────────────────────────────────────────────────────────
export { runSync } from "./sync/index.js";
export type { SyncOptions } from "./sync/index.js";

// ─── Generator ──────────────────────────────────────────────────────────────
export { generateDocs } from "./generators/index.js";
export type { GenerateOptions } from "./generators/index.js";

// ─── Theme Presets ──────────────────────────────────────────────────────────
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
} from "./generators/index.js";
export type { ThemePreset } from "./generators/index.js";

// ─── Deploy ─────────────────────────────────────────────────────────────────
export {
  getProvider,
  registerProvider,
  getAvailableProviders,
} from "./deploy/index.js";

export type { DeployProvider, DeployResult, DNSRecord } from "./deploy/index.js";

// ─── Utils ──────────────────────────────────────────────────────────────────
export { computeFileHash } from "./utils/index.js";
