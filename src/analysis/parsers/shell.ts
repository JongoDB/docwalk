/**
 * Shell Script Parser
 *
 * Lightweight regex-based parser for .sh/.bash files.
 * Extracts function definitions, exported variables, and detects
 * shebang line for shell type.
 */

import type { LanguageParser, ParserResult } from "./index.js";
import type { Symbol, DocComment } from "../types.js";
import type { LanguageId } from "../language-detect.js";

export class ShellParser implements LanguageParser {
  language: LanguageId = "shell" as LanguageId;

  async parse(content: string, filePath: string): Promise<ParserResult> {
    const symbols: Symbol[] = [];
    const lines = content.split("\n");

    // Detect shebang
    let shellType = "shell";
    if (lines[0]?.startsWith("#!")) {
      const shebang = lines[0];
      if (shebang.includes("bash")) shellType = "bash";
      else if (shebang.includes("zsh")) shellType = "zsh";
      else if (shebang.includes("sh")) shellType = "sh";
    }

    // Function patterns:
    //   function_name() {
    //   function function_name {
    //   function function_name() {
    const funcPattern1 = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\)\s*\{?/;
    const funcPattern2 = /^function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\(\))?\s*\{?/;

    // Export pattern: export VAR=
    const exportPattern = /^export\s+([A-Z_][A-Z0-9_]*)=/;

    // Readonly/constant pattern
    const readonlyPattern = /^(?:readonly|declare\s+-r)\s+([A-Z_][A-Z0-9_]*)=/;

    let lineNum = 0;
    let prevComment = "";

    for (const line of lines) {
      lineNum++;
      const trimmed = line.trim();

      // Track comments for doc extraction
      if (trimmed.startsWith("#") && !trimmed.startsWith("#!")) {
        prevComment = trimmed.replace(/^#\s*/, "");
        continue;
      }

      let match: RegExpMatchArray | null;

      // Function definitions
      match = trimmed.match(funcPattern1) || trimmed.match(funcPattern2);
      if (match) {
        symbols.push({
          id: `${filePath}:${match[1]}`,
          name: match[1],
          kind: "function",
          visibility: "public",
          location: { file: filePath, line: lineNum, column: 0 },
          exported: true,
          docs: prevComment ? { summary: prevComment } : undefined,
        });
        prevComment = "";
        continue;
      }

      // Exported variables
      match = trimmed.match(exportPattern);
      if (match) {
        symbols.push({
          id: `${filePath}:${match[1]}`,
          name: match[1],
          kind: "variable",
          visibility: "public",
          location: { file: filePath, line: lineNum, column: 0 },
          exported: true,
          docs: prevComment ? { summary: prevComment } : undefined,
        });
        prevComment = "";
        continue;
      }

      // Readonly constants
      match = trimmed.match(readonlyPattern);
      if (match) {
        symbols.push({
          id: `${filePath}:${match[1]}`,
          name: match[1],
          kind: "constant",
          visibility: "public",
          location: { file: filePath, line: lineNum, column: 0 },
          exported: true,
          docs: prevComment ? { summary: prevComment } : undefined,
        });
        prevComment = "";
        continue;
      }

      // Clear comment if a non-empty, non-comment line passes without matching
      if (trimmed !== "") {
        prevComment = "";
      }
    }

    // Module doc from shebang or first comment block
    let summary = `${shellType.charAt(0).toUpperCase() + shellType.slice(1)} script`;
    const firstCommentLines: string[] = [];
    const startLine = lines[0]?.startsWith("#!") ? 1 : 0;
    for (let i = startLine; i < Math.min(lines.length, 20); i++) {
      const l = lines[i].trim();
      if (l.startsWith("#") && !l.startsWith("#!")) {
        firstCommentLines.push(l.replace(/^#\s*/, ""));
      } else if (l === "") {
        if (firstCommentLines.length > 0) break;
      } else {
        break;
      }
    }
    if (firstCommentLines.length > 0) {
      summary = firstCommentLines[0];
    }

    return {
      symbols,
      imports: [],
      exports: [],
      moduleDoc: { summary },
    };
  }
}
