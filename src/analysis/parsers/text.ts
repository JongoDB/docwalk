/**
 * Text Parser — Fallback
 *
 * Lightweight parser for file types without a full tree-sitter parser.
 * Counts lines, extracts a basic description from the first comment block,
 * and reports the file's existence in the manifest. Does NOT attempt AST
 * symbol extraction.
 */

import type { LanguageParser, ParserResult } from "./index.js";
import type { LanguageId } from "../language-detect.js";

export class TextParser implements LanguageParser {
  language: LanguageId;

  constructor(language: LanguageId) {
    this.language = language;
  }

  async parse(content: string, filePath: string): Promise<ParserResult> {
    // Extract first comment block as a module doc
    const lines = content.split("\n");
    let summary = "";

    // Try common comment patterns for the first block
    const commentPatterns = [
      /^\s*#\s*(.+)$/,        // Shell/Python/YAML/TOML comments
      /^\s*\/\/\s*(.+)$/,     // C-style line comments
      /^\s*\/\*\*?\s*(.+)$/,  // C-style block comments start
      /^\s*--\s*(.+)$/,       // SQL comments
      /^\s*<!--\s*(.+)$/,     // XML/HTML comments
    ];

    for (const line of lines.slice(0, 10)) {
      if (line.trim() === "") continue;
      for (const pattern of commentPatterns) {
        const match = line.match(pattern);
        if (match) {
          summary = match[1].trim();
          break;
        }
      }
      if (summary) break;
      // If first non-empty line isn't a comment, stop looking
      break;
    }

    return {
      symbols: [],
      imports: [],
      exports: [],
      moduleDoc: summary ? { summary } : undefined,
    };
  }
}
