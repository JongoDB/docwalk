export { analyzeCodebase } from "./engine.js";
export type { AnalysisOptions } from "./engine.js";

export { detectLanguage, getSupportedLanguages, getLanguageDisplayName } from "./language-detect.js";
export type { LanguageId } from "./language-detect.js";

export { discoverFiles } from "./file-discovery.js";

export { getParser, registerParser, getRegisteredLanguages } from "./parsers/index.js";
export type { LanguageParser, ParserResult } from "./parsers/index.js";

export type {
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
} from "./types.js";
