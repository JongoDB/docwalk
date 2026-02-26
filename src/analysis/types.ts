/**
 * DocWalk Analysis Types
 *
 * Core type definitions for the static analysis engine.
 * These types represent the intermediate representation (IR) that
 * the analysis engine produces and the generators consume.
 */

// ─── Source Symbols ─────────────────────────────────────────────────────────

export type SymbolKind =
  | "function"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "constant"
  | "variable"
  | "method"
  | "property"
  | "module"
  | "namespace"
  | "decorator"
  | "hook"
  | "component";

export type Visibility = "public" | "private" | "protected" | "internal";

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface ParameterInfo {
  name: string;
  type?: string;
  description?: string;
  defaultValue?: string;
  optional: boolean;
  rest: boolean;
}

export interface ReturnInfo {
  type?: string;
  description?: string;
}

export interface DocComment {
  summary: string;
  description?: string;
  params?: Record<string, string>;
  returns?: string;
  throws?: string[];
  examples?: string[];
  tags?: Record<string, string>;
  deprecated?: string | boolean;
  since?: string;
  see?: string[];
}

export interface Symbol {
  /** Unique identifier within the codebase */
  id: string;

  /** Human-readable name */
  name: string;

  /** What kind of symbol this is */
  kind: SymbolKind;

  /** Access visibility */
  visibility: Visibility;

  /** Source location */
  location: SourceLocation;

  /** Whether this symbol is exported */
  exported: boolean;

  /** Function/method parameters */
  parameters?: ParameterInfo[];

  /** Return type info */
  returns?: ReturnInfo;

  /** Type annotation or definition */
  typeAnnotation?: string;

  /** Parsed doc comment */
  docs?: DocComment;

  /** AI-generated summary (if enabled) */
  aiSummary?: string;

  /** Parent symbol ID (e.g., method belongs to class) */
  parentId?: string;

  /** Child symbol IDs */
  children?: string[];

  /** Symbols this one depends on */
  dependencies?: string[];

  /** Symbols that depend on this one */
  dependents?: string[];

  /** Generic type parameters */
  typeParameters?: string[];

  /** For classes: extended class */
  extends?: string;

  /** For classes/interfaces: implemented interfaces */
  implements?: string[];

  /** Decorators applied to this symbol */
  decorators?: string[];

  /** Whether this is async */
  async?: boolean;

  /** Whether this is a generator */
  generator?: boolean;

  /** Raw signature string for display */
  signature?: string;
}

// ─── Module / File Level ────────────────────────────────────────────────────

export interface ModuleInfo {
  /** Relative file path from repo root */
  filePath: string;

  /** Detected language */
  language: string;

  /** All symbols found in this file */
  symbols: Symbol[];

  /** Import statements */
  imports: ImportInfo[];

  /** Export statements */
  exports: ExportInfo[];

  /** File-level doc comment (top of file) */
  moduleDoc?: DocComment;

  /** AI-generated module summary */
  aiSummary?: string;

  /** File size in bytes */
  fileSize: number;

  /** Number of lines */
  lineCount: number;

  /** SHA of file content (for cache invalidation) */
  contentHash: string;

  /** Last analyzed timestamp */
  analyzedAt: string;
}

export interface ImportInfo {
  source: string;
  specifiers: Array<{
    name: string;
    alias?: string;
    isDefault: boolean;
    isNamespace: boolean;
  }>;
  isTypeOnly: boolean;
}

export interface ExportInfo {
  name: string;
  alias?: string;
  isDefault: boolean;
  isReExport: boolean;
  source?: string;
  symbolId?: string;
}

// ─── Dependency Graph ───────────────────────────────────────────────────────

export interface DependencyEdge {
  from: string; // file path
  to: string; // file path
  imports: string[]; // symbol names
  isTypeOnly: boolean;
}

export interface DependencyGraph {
  nodes: string[]; // all file paths
  edges: DependencyEdge[];
}

// ─── Analysis Manifest ──────────────────────────────────────────────────────

export interface AnalysisManifest {
  /** DocWalk version that produced this manifest */
  docwalkVersion: string;

  /** Repository identifier */
  repo: string;

  /** Branch that was analyzed */
  branch: string;

  /** Commit SHA at time of analysis */
  commitSha: string;

  /** When the analysis was performed */
  analyzedAt: string;

  /** All analyzed modules */
  modules: ModuleInfo[];

  /** Cross-file dependency graph */
  dependencyGraph: DependencyGraph;

  /** Detected project metadata */
  projectMeta: ProjectMeta;

  /** Analysis statistics */
  stats: AnalysisStats;

  /** Cached AI summaries keyed by content hash */
  summaryCache?: Array<{
    contentHash: string;
    summary: string;
    generatedAt: string;
  }>;
}

export interface ProjectMeta {
  name: string;
  version?: string;
  description?: string;
  languages: Array<{ name: string; fileCount: number; percentage: number }>;
  entryPoints: string[];
  packageManager?: string;
  framework?: string;
  license?: string;
  repository?: string;
}

export interface AnalysisStats {
  totalFiles: number;
  totalSymbols: number;
  totalLines: number;
  byLanguage: Record<string, { files: number; symbols: number; lines: number }>;
  byKind: Record<SymbolKind, number>;
  analysisTime: number; // milliseconds
  skippedFiles: number;
}

// ─── Diff / Sync Types ─────────────────────────────────────────────────────

export type DiffStatus = "added" | "modified" | "deleted" | "renamed";

export interface FileDiff {
  path: string;
  oldPath?: string; // for renames
  status: DiffStatus;
}

export interface SyncState {
  lastCommitSha: string;
  lastSyncedAt: string;
  manifestPath: string;
  totalPages: number;
}

export interface SyncResult {
  diffs: FileDiff[];
  modulesReanalyzed: number;
  pagesRebuilt: number;
  pagesCreated: number;
  pagesDeleted: number;
  impactedModules: string[];
  duration: number;
  previousCommit: string;
  currentCommit: string;
}

// ─── Generator Types ────────────────────────────────────────────────────────

export interface GeneratedPage {
  /** Output path relative to docs/ directory */
  path: string;

  /** Page title */
  title: string;

  /** Markdown content */
  content: string;

  /** Navigation group */
  navGroup: string;

  /** Navigation order weight */
  navOrder: number;
}

export interface NavigationItem {
  title: string;
  path?: string;
  children?: NavigationItem[];
}

export interface GenerationResult {
  pages: GeneratedPage[];
  navigation: NavigationItem[];
  mkdocsConfig: Record<string, unknown>;
}
