/**
 * SQL Parser
 *
 * Lightweight regex-based parser for .sql files.
 * Extracts CREATE TABLE, CREATE VIEW, CREATE FUNCTION,
 * CREATE PROCEDURE, and CREATE INDEX statements.
 */

import type { LanguageParser, ParserResult } from "./index.js";
import type { Symbol, SymbolKind } from "../types.js";
import type { LanguageId } from "../language-detect.js";

export class SqlParser implements LanguageParser {
  language: LanguageId = "sql" as LanguageId;

  async parse(content: string, filePath: string): Promise<ParserResult> {
    const symbols: Symbol[] = [];
    const lines = content.split("\n");

    // Patterns for CREATE statements (case-insensitive)
    const createPattern = /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP(?:ORARY)?\s+)?(TABLE|VIEW|(?:MATERIALIZED\s+)?VIEW|FUNCTION|PROCEDURE|TRIGGER|INDEX|TYPE|SCHEMA|SEQUENCE|ENUM)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|')?([a-zA-Z_][a-zA-Z0-9_.]*?)(?:`|"|')?\s*(?:\(|AS|;|\s)/i;

    // ALTER TABLE pattern
    const alterPattern = /^\s*ALTER\s+TABLE\s+(?:`|"|')?([a-zA-Z_][a-zA-Z0-9_.]*?)(?:`|"|')?\s/i;

    const kindMap: Record<string, SymbolKind> = {
      table: "class",
      view: "interface",
      "materialized view": "interface",
      function: "function",
      procedure: "function",
      trigger: "function",
      index: "property",
      type: "type",
      schema: "namespace",
      sequence: "variable",
      enum: "enum",
    };

    let lineNum = 0;
    let prevComment = "";

    for (const line of lines) {
      lineNum++;
      const trimmed = line.trim();

      // Track SQL comments
      if (trimmed.startsWith("--")) {
        prevComment = trimmed.replace(/^--\s*/, "");
        continue;
      }

      const match = trimmed.match(createPattern);
      if (match) {
        const objType = match[1].toLowerCase();
        const objName = match[2];

        symbols.push({
          id: `${filePath}:${objName}`,
          name: objName,
          kind: kindMap[objType] || "property",
          visibility: "public",
          location: { file: filePath, line: lineNum, column: 0 },
          exported: true,
          typeAnnotation: objType.toUpperCase(),
          docs: prevComment ? { summary: prevComment } : undefined,
        });
        prevComment = "";
        continue;
      }

      if (trimmed !== "" && !trimmed.startsWith("/*")) {
        prevComment = "";
      }
    }

    // Summary
    const tableCount = symbols.filter(s => s.typeAnnotation === "TABLE").length;
    const funcCount = symbols.filter(s => s.kind === "function").length;
    let summary = "SQL file";
    if (tableCount > 0 && funcCount > 0) {
      summary = `SQL schema (${tableCount} tables, ${funcCount} functions)`;
    } else if (tableCount > 0) {
      summary = `SQL schema (${tableCount} tables)`;
    } else if (funcCount > 0) {
      summary = `SQL functions (${funcCount} functions)`;
    } else if (symbols.length > 0) {
      summary = `SQL definitions (${symbols.length} objects)`;
    }

    const basename = filePath.split("/").pop()?.toLowerCase() || "";
    if (basename.includes("migration") || basename.includes("migrate")) {
      summary = `Database migration — ${summary}`;
    } else if (basename.includes("seed")) {
      summary = "Database seed data";
    }

    return {
      symbols,
      imports: [],
      exports: [],
      moduleDoc: { summary },
    };
  }
}
