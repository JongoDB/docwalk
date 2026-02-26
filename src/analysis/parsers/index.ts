/**
 * Parser Registry
 *
 * Defines the interface for language parsers and provides a
 * registry to look them up by language ID. Each parser uses
 * tree-sitter to parse source code and extract symbols.
 */

import type { LanguageId } from "../language-detect.js";
import type {
  Symbol,
  ImportInfo,
  ExportInfo,
  DocComment,
} from "../types.js";

// ─── Parser Interface ───────────────────────────────────────────────────────

export interface ParserResult {
  symbols: Symbol[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  moduleDoc?: DocComment;
}

export interface LanguageParser {
  /** Language this parser handles */
  language: LanguageId;

  /** Parse source code and extract structured information */
  parse(content: string, filePath: string): Promise<ParserResult>;
}

// ─── Parser Registry ────────────────────────────────────────────────────────

const parsers = new Map<LanguageId, LanguageParser>();

/**
 * Register a language parser.
 */
export function registerParser(parser: LanguageParser): void {
  parsers.set(parser.language, parser);
}

/**
 * Get the parser for a given language.
 * Returns undefined if no parser is registered.
 */
export function getParser(language: LanguageId): LanguageParser | undefined {
  return parsers.get(language);
}

/**
 * Get all registered language IDs.
 */
export function getRegisteredLanguages(): LanguageId[] {
  return [...parsers.keys()];
}

// ─── Auto-register built-in parsers ─────────────────────────────────────────

import { TypeScriptParser } from "./typescript.js";
import { JavaScriptParser } from "./javascript.js";
import { PythonParser } from "./python.js";
import { GoParser } from "./go.js";
import { RustParser } from "./rust.js";
import { JavaParser } from "./java.js";
import { CSharpParser } from "./csharp.js";
import { RubyParser } from "./ruby.js";
import { PhpParser } from "./php.js";

registerParser(new TypeScriptParser());
registerParser(new JavaScriptParser());
registerParser(new PythonParser());
registerParser(new GoParser());
registerParser(new RustParser());
registerParser(new JavaParser());
registerParser(new CSharpParser());
registerParser(new RubyParser());
registerParser(new PhpParser());
