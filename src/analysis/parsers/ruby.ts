/**
 * Ruby Parser
 *
 * Uses web-tree-sitter with the Ruby grammar to extract classes,
 * modules, methods, constants, attr_accessor/attr_reader,
 * RDoc/YARD comments, require statements, and visibility.
 */

import type { LanguageParser, ParserResult } from "./index.js";
import type {
  Symbol,
  ImportInfo,
  ExportInfo,
  DocComment,
  ParameterInfo,
} from "../types.js";
import type { LanguageId } from "../language-detect.js";
import { initParser, type TreeSitterNode } from "./tree-sitter-loader.js";

export class RubyParser implements LanguageParser {
  language: LanguageId = "ruby";

  async parse(content: string, filePath: string): Promise<ParserResult> {
    const symbols: Symbol[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    let moduleDoc: DocComment | undefined;

    const parser = await initParser("ruby");
    const tree = parser.parse(content);
    const root = tree.rootNode;

    // Track visibility state (Ruby uses `private`/`protected` keywords to change default)
    const privateMethodNames = new Set<string>();
    const protectedMethodNames = new Set<string>();
    extractVisibilityBlocks(root, content, privateMethodNames, protectedMethodNames);

    // Module-level doc comment
    moduleDoc = findFirstDocComment(root, content);

    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i)!;

      // require / require_relative
      if (node.type === "call" || node.type === "command") {
        const imp = extractRequire(node);
        if (imp) {
          imports.push(imp);
          continue;
        }
      }

      if (node.type === "class") {
        const docs = findPrecedingComment(root, i, content);
        const syms = extractClass(node, filePath, docs, content, privateMethodNames, protectedMethodNames);
        for (const sym of syms) {
          symbols.push(sym);
          if (sym.exported) {
            exports.push({
              name: sym.name,
              isDefault: false,
              isReExport: false,
              symbolId: sym.id,
            });
          }
        }
        continue;
      }

      if (node.type === "module") {
        const docs = findPrecedingComment(root, i, content);
        const sym = extractModule(node, filePath, docs);
        if (sym) {
          symbols.push(sym);
          exports.push({
            name: sym.name,
            isDefault: false,
            isReExport: false,
            symbolId: sym.id,
          });
        }
        continue;
      }

      if (node.type === "method") {
        const docs = findPrecedingComment(root, i, content);
        const sym = extractMethod(node, filePath, docs, privateMethodNames, protectedMethodNames);
        if (sym) {
          symbols.push(sym);
          if (sym.exported) {
            exports.push({
              name: sym.name,
              isDefault: false,
              isReExport: false,
              symbolId: sym.id,
            });
          }
        }
        continue;
      }

      // Constants (UPPER_CASE = ...)
      if (node.type === "assignment") {
        const sym = extractConstant(node, filePath);
        if (sym) {
          symbols.push(sym);
          exports.push({
            name: sym.name,
            isDefault: false,
            isReExport: false,
            symbolId: sym.id,
          });
        }
        continue;
      }
    }

    return { symbols, imports, exports, moduleDoc };
  }
}

// ─── Import Extraction ──────────────────────────────────────────────────────

function extractRequire(node: TreeSitterNode): ImportInfo | null {
  const text = node.text;

  // Match require "foo" or require_relative "foo"
  const match = text.match(/^(require|require_relative)\s+["']([^"']+)["']/);
  if (!match) return null;

  return {
    source: match[2],
    specifiers: [{
      name: match[2].split("/").pop() || match[2],
      isDefault: true,
      isNamespace: false,
    }],
    isTypeOnly: false,
  };
}

// ─── Class Extraction ───────────────────────────────────────────────────────

function extractClass(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined,
  content: string,
  privateMethodNames: Set<string>,
  protectedMethodNames: Set<string>
): Symbol[] {
  const results: Symbol[] = [];

  const nameNode = findChild(node, "constant") || findChild(node, "scope_resolution");
  if (!nameNode) return results;

  const name = nameNode.text;

  // Check for superclass
  const superclass = findChild(node, "superclass");
  const extendsName = superclass ? superclass.text.replace(/^<\s*/, "") : undefined;

  const children: string[] = [];
  const body = findChild(node, "body_statement");
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i)!;

      if (member.type === "method") {
        const memberDocs = findPrecedingComment(body, i, content);
        const sym = extractMethod(member, filePath, memberDocs, privateMethodNames, protectedMethodNames, name);
        if (sym) {
          results.push(sym);
          children.push(sym.id);
        }
      }
    }
  }

  const classSym: Symbol = {
    id: `${filePath}:${name}`,
    name,
    kind: "class",
    visibility: "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported: true,
    extends: extendsName,
    children: children.length > 0 ? children : undefined,
    docs,
    signature: `class ${name}${extendsName ? ` < ${extendsName}` : ""}`,
  };

  results.unshift(classSym);
  return results;
}

function extractModule(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined
): Symbol | null {
  const nameNode = findChild(node, "constant") || findChild(node, "scope_resolution");
  if (!nameNode) return null;

  const name = nameNode.text;

  return {
    id: `${filePath}:${name}`,
    name,
    kind: "module",
    visibility: "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported: true,
    docs,
    signature: `module ${name}`,
  };
}

// ─── Method Extraction ──────────────────────────────────────────────────────

function extractMethod(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined,
  privateMethodNames: Set<string>,
  protectedMethodNames: Set<string>,
  parentName?: string
): Symbol | null {
  const nameNode = findChild(node, "identifier");
  if (!nameNode) return null;

  const name = nameNode.text;
  const isPrivate = privateMethodNames.has(name);
  const isProtected = protectedMethodNames.has(name);
  const visibility = isPrivate ? "private" : isProtected ? "protected" : "public";

  const params = extractParams(node);

  return {
    id: parentName ? `${filePath}:${parentName}.${name}` : `${filePath}:${name}`,
    name,
    kind: "method",
    visibility,
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported: !isPrivate,
    parameters: params.length > 0 ? params : undefined,
    parentId: parentName ? `${filePath}:${parentName}` : undefined,
    docs,
    signature: buildSignature(node),
  };
}

function extractConstant(
  node: TreeSitterNode,
  filePath: string
): Symbol | null {
  const text = node.text;
  // Ruby constants start with uppercase
  const match = text.match(/^([A-Z][A-Z0-9_]*)\s*=/);
  if (!match) return null;

  const name = match[1];

  return {
    id: `${filePath}:${name}`,
    name,
    kind: "constant",
    visibility: "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
    },
    exported: true,
  };
}

// ─── Parameter Extraction ───────────────────────────────────────────────────

function extractParams(node: TreeSitterNode): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  const paramList = findChild(node, "method_parameters");
  if (!paramList) return params;

  for (let i = 0; i < paramList.childCount; i++) {
    const child = paramList.child(i)!;
    if (child.type === "identifier") {
      params.push({
        name: child.text,
        optional: false,
        rest: false,
      });
    } else if (child.type === "optional_parameter") {
      const nameNode = findChild(child, "identifier");
      if (nameNode) {
        params.push({
          name: nameNode.text,
          optional: true,
          rest: false,
        });
      }
    } else if (child.type === "splat_parameter") {
      const nameNode = findChild(child, "identifier");
      params.push({
        name: nameNode?.text ?? "args",
        optional: true,
        rest: true,
      });
    } else if (child.type === "keyword_parameter") {
      const nameNode = findChild(child, "identifier");
      if (nameNode) {
        params.push({
          name: nameNode.text,
          optional: true,
          rest: false,
        });
      }
    }
  }

  return params;
}

// ─── Visibility Extraction ──────────────────────────────────────────────────

function extractVisibilityBlocks(
  root: TreeSitterNode,
  content: string,
  privateNames: Set<string>,
  protectedNames: Set<string>
): void {
  // Look for `private :method_name` or `private` (changes default for subsequent)
  const lines = content.split("\n");

  let currentVisibility: "public" | "private" | "protected" = "public";
  let inBody = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // private :method_name, :another_method
    const explicitMatch = trimmed.match(/^(private|protected)\s+:(\w+(?:\s*,\s*:\w+)*)/);
    if (explicitMatch) {
      const vis = explicitMatch[1];
      const names = explicitMatch[2].split(",").map((n) => n.trim().replace(/^:/, ""));
      for (const name of names) {
        if (vis === "private") privateNames.add(name);
        else protectedNames.add(name);
      }
    }
  }
}

// ─── Comment Extraction ─────────────────────────────────────────────────────

function findFirstDocComment(root: TreeSitterNode, content: string): DocComment | undefined {
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i)!;
    if (node.type === "comment") {
      const text = node.text.replace(/^#\s?/, "").trim();
      if (text) {
        return { summary: text };
      }
    } else if (node.type !== "call" && node.type !== "command") {
      break;
    }
  }
  return undefined;
}

function findPrecedingComment(
  root: TreeSitterNode,
  nodeIndex: number,
  content: string
): DocComment | undefined {
  const commentLines: string[] = [];
  const params: Record<string, string> = {};
  let returns: string | undefined;

  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = root.child(i);
    if (!prev) break;

    if (prev.type === "comment") {
      const text = prev.text.replace(/^#\s?/, "").trim();

      // YARD tags: @param [Type] name description  OR  @param name description
      const paramMatch = text.match(/^@param\s+(?:\[[\w:]+\]\s+)?(\w+)\s+(.*)/);
      if (paramMatch) {
        params[paramMatch[1]] = paramMatch[2];
        continue;
      }
      const returnMatch = text.match(/^@return\s+(.*)/);
      if (returnMatch) {
        returns = returnMatch[1];
        continue;
      }

      if (!text.startsWith("@")) {
        commentLines.unshift(text);
      }
    } else {
      break;
    }
  }

  if (commentLines.length === 0 && Object.keys(params).length === 0) return undefined;

  return {
    summary: commentLines[0] || "",
    description: commentLines.length > 1 ? commentLines.join("\n") : undefined,
    params: Object.keys(params).length > 0 ? params : undefined,
    returns,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findChild(node: TreeSitterNode, type: string): TreeSitterNode | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type === type) return child;
  }
  return null;
}

function buildSignature(node: TreeSitterNode): string {
  const text = node.text;
  const lines = text.split("\n");
  return lines[0].trim();
}
