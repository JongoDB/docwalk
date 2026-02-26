/**
 * TypeScript / JavaScript Parser
 *
 * Uses tree-sitter-typescript to parse TS/JS source files and
 * extract functions, classes, interfaces, types, exports, imports,
 * and JSDoc/TSDoc comments.
 *
 * This is the reference parser implementation — other language parsers
 * follow the same pattern.
 */

import type { LanguageParser, ParserResult } from "./index.js";
import type {
  Symbol,
  ImportInfo,
  ExportInfo,
  DocComment,
  SymbolKind,
  Visibility,
  ParameterInfo,
  SourceLocation,
} from "../types.js";
import type { LanguageId } from "../language-detect.js";

export class TypeScriptParser implements LanguageParser {
  language: LanguageId = "typescript";

  async parse(content: string, filePath: string): Promise<ParserResult> {
    const symbols: Symbol[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    let moduleDoc: DocComment | undefined;

    const lines = content.split("\n");

    // ── Extract imports ───────────────────────────────────────────────────
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // import { foo, bar } from './module'
      const importMatch = line.match(
        /^import\s+(?:type\s+)?(\{[^}]+\}|[\w*]+(?:\s+as\s+\w+)?)\s+from\s+['"]([^'"]+)['"]/
      );
      if (importMatch) {
        const isTypeOnly = line.startsWith("import type");
        const specifierStr = importMatch[1];
        const source = importMatch[2];

        const specifiers = parseImportSpecifiers(specifierStr);
        imports.push({ source, specifiers, isTypeOnly });
        continue;
      }

      // import './side-effect'
      const sideEffectMatch = line.match(
        /^import\s+['"]([^'"]+)['"]/
      );
      if (sideEffectMatch) {
        imports.push({
          source: sideEffectMatch[1],
          specifiers: [],
          isTypeOnly: false,
        });
      }
    }

    // ── Extract top-level symbols ─────────────────────────────────────────
    // This is a simplified regex-based extraction.
    // The full implementation will use tree-sitter AST for accuracy.
    // This serves as the working skeleton for Claude Code to enhance.

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Collect JSDoc if present above this line
      const docs = extractJSDoc(lines, i);

      // ── export function / async function ────────────────────────────────
      const funcMatch = trimmed.match(
        /^(export\s+)?(export\s+default\s+)?(async\s+)?function\s*\*?\s+(\w+)/
      );
      if (funcMatch) {
        const isExported = !!(funcMatch[1] || funcMatch[2]);
        const isDefault = !!funcMatch[2];
        const isAsync = !!funcMatch[3];
        const name = funcMatch[4];

        const symbol: Symbol = {
          id: `${filePath}:${name}`,
          name,
          kind: "function",
          visibility: isExported ? "public" : "private",
          location: { file: filePath, line: i + 1, column: 0 },
          exported: isExported,
          async: isAsync,
          docs,
          signature: extractSignature(lines, i),
        };
        symbols.push(symbol);

        if (isExported) {
          exports.push({
            name,
            isDefault,
            isReExport: false,
            symbolId: symbol.id,
          });
        }
        continue;
      }

      // ── export class ───────────────────────────────────────────────────
      const classMatch = trimmed.match(
        /^(export\s+)?(export\s+default\s+)?(abstract\s+)?class\s+(\w+)/
      );
      if (classMatch) {
        const isExported = !!(classMatch[1] || classMatch[2]);
        const isDefault = !!classMatch[2];
        const name = classMatch[4];

        const extendsMatch = trimmed.match(/extends\s+(\w+)/);
        const implementsMatch = trimmed.match(/implements\s+([\w,\s]+)/);

        const symbol: Symbol = {
          id: `${filePath}:${name}`,
          name,
          kind: "class",
          visibility: isExported ? "public" : "private",
          location: { file: filePath, line: i + 1, column: 0 },
          exported: isExported,
          extends: extendsMatch?.[1],
          implements: implementsMatch?.[1]
            ?.split(",")
            .map((s) => s.trim()),
          docs,
        };
        symbols.push(symbol);

        if (isExported) {
          exports.push({
            name,
            isDefault,
            isReExport: false,
            symbolId: symbol.id,
          });
        }
        continue;
      }

      // ── export interface ───────────────────────────────────────────────
      const ifaceMatch = trimmed.match(
        /^(export\s+)?interface\s+(\w+)/
      );
      if (ifaceMatch) {
        const isExported = !!ifaceMatch[1];
        const name = ifaceMatch[2];

        const symbol: Symbol = {
          id: `${filePath}:${name}`,
          name,
          kind: "interface",
          visibility: isExported ? "public" : "private",
          location: { file: filePath, line: i + 1, column: 0 },
          exported: isExported,
          docs,
        };
        symbols.push(symbol);

        if (isExported) {
          exports.push({
            name,
            isDefault: false,
            isReExport: false,
            symbolId: symbol.id,
          });
        }
        continue;
      }

      // ── export type ────────────────────────────────────────────────────
      const typeMatch = trimmed.match(
        /^(export\s+)?type\s+(\w+)/
      );
      if (typeMatch) {
        const isExported = !!typeMatch[1];
        const name = typeMatch[2];

        const symbol: Symbol = {
          id: `${filePath}:${name}`,
          name,
          kind: "type",
          visibility: isExported ? "public" : "private",
          location: { file: filePath, line: i + 1, column: 0 },
          exported: isExported,
          docs,
        };
        symbols.push(symbol);

        if (isExported) {
          exports.push({
            name,
            isDefault: false,
            isReExport: false,
            symbolId: symbol.id,
          });
        }
        continue;
      }

      // ── export const / let / var ───────────────────────────────────────
      const constMatch = trimmed.match(
        /^(export\s+)?(const|let|var)\s+(\w+)/
      );
      if (constMatch) {
        const isExported = !!constMatch[1];
        const name = constMatch[3];

        // Check if it's an arrow function
        const isArrowFunc =
          trimmed.includes("=>") || trimmed.includes("= (");
        const kind: SymbolKind = isArrowFunc ? "function" : "constant";

        const symbol: Symbol = {
          id: `${filePath}:${name}`,
          name,
          kind,
          visibility: isExported ? "public" : "private",
          location: { file: filePath, line: i + 1, column: 0 },
          exported: isExported,
          docs,
        };
        symbols.push(symbol);

        if (isExported) {
          exports.push({
            name,
            isDefault: false,
            isReExport: false,
            symbolId: symbol.id,
          });
        }
        continue;
      }

      // ── export enum ────────────────────────────────────────────────────
      const enumMatch = trimmed.match(
        /^(export\s+)?(const\s+)?enum\s+(\w+)/
      );
      if (enumMatch) {
        const isExported = !!enumMatch[1];
        const name = enumMatch[3];

        const symbol: Symbol = {
          id: `${filePath}:${name}`,
          name,
          kind: "enum",
          visibility: isExported ? "public" : "private",
          location: { file: filePath, line: i + 1, column: 0 },
          exported: isExported,
          docs,
        };
        symbols.push(symbol);

        if (isExported) {
          exports.push({
            name,
            isDefault: false,
            isReExport: false,
            symbolId: symbol.id,
          });
        }
      }
    }

    // ── Module-level doc comment (first JSDoc in file) ────────────────────
    moduleDoc = extractJSDoc(lines, findFirstNonCommentLine(lines));

    return { symbols, imports, exports, moduleDoc };
  }
}

// ─── JSDoc Extraction ───────────────────────────────────────────────────────

function extractJSDoc(
  lines: string[],
  declarationLine: number
): DocComment | undefined {
  // Walk backwards from the declaration to find a JSDoc block
  let endLine = declarationLine - 1;
  while (endLine >= 0 && lines[endLine].trim() === "") {
    endLine--;
  }

  if (endLine < 0 || !lines[endLine].trim().endsWith("*/")) {
    return undefined;
  }

  let startLine = endLine;
  while (startLine >= 0 && !lines[startLine].trim().startsWith("/**")) {
    startLine--;
  }

  if (startLine < 0) return undefined;

  const docBlock = lines
    .slice(startLine, endLine + 1)
    .map((l) => l.trim().replace(/^\/\*\*\s?/, "").replace(/\s?\*\/$/, "").replace(/^\*\s?/, ""))
    .filter((l) => l !== "")
    .join("\n");

  const summary = docBlock.split("\n")[0] || "";
  const params: Record<string, string> = {};
  let returns: string | undefined;
  const tags: Record<string, string> = {};

  const paramRegex = /@param\s+(?:\{[^}]+\}\s+)?(\w+)\s*[-–]?\s*(.*)/g;
  let match;
  while ((match = paramRegex.exec(docBlock)) !== null) {
    params[match[1]] = match[2];
  }

  const returnMatch = docBlock.match(/@returns?\s+(.*)/);
  if (returnMatch) returns = returnMatch[1];

  const deprecatedMatch = docBlock.match(/@deprecated\s*(.*)/);
  const sinceMatch = docBlock.match(/@since\s+(.*)/);

  return {
    summary,
    description: docBlock.includes("\n") ? docBlock : undefined,
    params: Object.keys(params).length > 0 ? params : undefined,
    returns,
    deprecated: deprecatedMatch ? deprecatedMatch[1] || true : undefined,
    since: sinceMatch?.[1],
    tags,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseImportSpecifiers(
  specifierStr: string
): ImportInfo["specifiers"] {
  if (specifierStr.startsWith("{")) {
    const inner = specifierStr.slice(1, -1);
    return inner.split(",").map((s) => {
      const parts = s.trim().split(/\s+as\s+/);
      return {
        name: parts[0].trim(),
        alias: parts[1]?.trim(),
        isDefault: false,
        isNamespace: false,
      };
    });
  }

  if (specifierStr.startsWith("*")) {
    const parts = specifierStr.split(/\s+as\s+/);
    return [
      {
        name: "*",
        alias: parts[1]?.trim(),
        isDefault: false,
        isNamespace: true,
      },
    ];
  }

  return [
    {
      name: specifierStr.trim(),
      alias: undefined,
      isDefault: true,
      isNamespace: false,
    },
  ];
}

function extractSignature(lines: string[], lineIndex: number): string {
  let sig = lines[lineIndex].trim();
  // Extend to closing paren if multi-line
  let depth = 0;
  let i = lineIndex;
  while (i < lines.length) {
    for (const char of lines[i]) {
      if (char === "(") depth++;
      if (char === ")") depth--;
    }
    if (depth <= 0 && i > lineIndex) break;
    if (i > lineIndex) sig += " " + lines[i].trim();
    i++;
  }
  // Trim to just the signature (up to opening brace)
  const braceIndex = sig.indexOf("{");
  if (braceIndex > 0) sig = sig.slice(0, braceIndex).trim();
  return sig;
}

function findFirstNonCommentLine(lines: string[]): number {
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("/*")) inBlock = true;
    if (inBlock) {
      if (trimmed.endsWith("*/")) inBlock = false;
      continue;
    }
    if (trimmed.startsWith("//") || trimmed === "") continue;
    return i;
  }
  return 0;
}
