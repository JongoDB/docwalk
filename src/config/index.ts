export { DocWalkConfigSchema } from "./schema.js";
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
} from "./schema.js";

export {
  loadConfig,
  loadConfigFile,
  ConfigNotFoundError,
  ConfigValidationError,
} from "./loader.js";
export type { LoadConfigResult } from "./loader.js";
