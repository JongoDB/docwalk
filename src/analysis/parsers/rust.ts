/**
 * Rust Parser
 *
 * Uses web-tree-sitter with the Rust grammar to extract functions,
 * structs, enums, traits, impl blocks, type aliases, constants,
 * statics, doc comments, and use/pub-use imports.
 */

import type { LanguageParser, ParserResult } from "./index.js";
import type {
  Symbol,
  ImportInfo,
  ExportInfo,
  DocComment,
  SymbolKind,
  ParameterInfo,
} from "../types.js";
import type { LanguageId } from "../language-detect.js";
import { initParser, type TreeSitterNode } from "./tree-sitter-loader.js";

export class RustParser implements LanguageParser {
  language: LanguageId = "rust";

  async parse(content: string, filePath: string): Promise<ParserResult> {
    const symbols: Symbol[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    let moduleDoc: DocComment | undefined;

    const parser = await initParser("rust");
    const tree = parser.parse(content);
    const root = tree.rootNode;

    // Module-level doc comment (//! at start of file)
    moduleDoc = extractModuleDoc(root, content);

    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i)!;

      if (node.type === "use_declaration") {
        const imp = extractUseDeclaration(node);
        if (imp) {
          imports.push(imp);
          // pub use = re-export
          if (isPub(node)) {
            for (const spec of imp.specifiers) {
              exports.push({
                name: spec.alias || spec.name,
                isDefault: false,
                isReExport: true,
                symbolId: `${filePath}:${spec.name}`,
              });
            }
          }
        }
        continue;
      }

      if (node.type === "function_item") {
        const docs = findPrecedingDocComment(root, i, content);
        const sym = extractFunction(node, filePath, docs);
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

      if (node.type === "struct_item") {
        const docs = findPrecedingDocComment(root, i, content);
        const sym = extractStruct(node, filePath, docs);
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

      if (node.type === "enum_item") {
        const docs = findPrecedingDocComment(root, i, content);
        const sym = extractEnum(node, filePath, docs);
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

      if (node.type === "trait_item") {
        const docs = findPrecedingDocComment(root, i, content);
        const sym = extractTrait(node, filePath, docs);
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

      if (node.type === "impl_item") {
        const methods = extractImplMethods(node, filePath, content);
        for (const sym of methods) {
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

      if (node.type === "type_item") {
        const docs = findPrecedingDocComment(root, i, content);
        const sym = extractTypeAlias(node, filePath, docs);
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

      if (node.type === "const_item" || node.type === "static_item") {
        const docs = findPrecedingDocComment(root, i, content);
        const sym = extractConstStatic(node, filePath, docs);
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
    }

    return { symbols, imports, exports, moduleDoc };
  }
}

// ─── Import Extraction ──────────────────────────────────────────────────────

function extractUseDeclaration(node: TreeSitterNode): ImportInfo | null {
  // Extract the path from use statement
  const text = node.text;
  const useMatch = text.match(/^(?:pub\s+)?use\s+(.+);$/s);
  if (!useMatch) return null;

  const usePath = useMatch[1].trim();

  // Parse specifiers from use path
  const specifiers: ImportInfo["specifiers"] = [];
  const baseMatch = usePath.match(/^([^{]+)(?:::?\{([^}]+)\})?$/);
  if (baseMatch) {
    const base = baseMatch[1].replace(/::$/, "");
    if (baseMatch[2]) {
      // use foo::{Bar, Baz as B}
      const items = baseMatch[2].split(",").map((s) => s.trim());
      for (const item of items) {
        const aliasMatch = item.match(/^(\w+)\s+as\s+(\w+)$/);
        if (aliasMatch) {
          specifiers.push({
            name: aliasMatch[1],
            alias: aliasMatch[2],
            isDefault: false,
            isNamespace: false,
          });
        } else if (item === "self") {
          specifiers.push({
            name: base.split("::").pop() || base,
            isDefault: false,
            isNamespace: false,
          });
        } else if (item === "*") {
          specifiers.push({
            name: "*",
            isDefault: false,
            isNamespace: true,
          });
        } else {
          specifiers.push({
            name: item,
            isDefault: false,
            isNamespace: false,
          });
        }
      }
    } else {
      // use foo::Bar or use foo::*
      const parts = base.split("::");
      const last = parts[parts.length - 1];
      specifiers.push({
        name: last,
        isDefault: false,
        isNamespace: last === "*",
      });
    }

    return {
      source: baseMatch[2] ? baseMatch[1].replace(/::$/, "") : usePath.split("::").slice(0, -1).join("::"),
      specifiers,
      isTypeOnly: false,
    };
  }

  return {
    source: usePath,
    specifiers: [],
    isTypeOnly: false,
  };
}

// ─── Symbol Extraction ──────────────────────────────────────────────────────

function extractFunction(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined
): Symbol | null {
  const nameNode = findChild(node, "identifier");
  if (!nameNode) return null;

  const name = nameNode.text;
  const isExported = isPub(node);
  const params = extractParams(node);
  const returnType = extractReturnType(node);
  const isAsync = node.text.startsWith("async") || node.text.includes("async fn");

  return {
    id: `${filePath}:${name}`,
    name,
    kind: "function",
    visibility: isExported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported: isExported,
    parameters: params.length > 0 ? params : undefined,
    returns: returnType ? { type: returnType } : undefined,
    async: isAsync,
    docs,
    signature: buildSignature(node),
  };
}

function extractStruct(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined
): Symbol | null {
  const nameNode = findChild(node, "type_identifier");
  if (!nameNode) return null;

  const name = nameNode.text;
  const isExported = isPub(node);

  const children: string[] = [];
  const fieldList = findChild(node, "field_declaration_list");
  if (fieldList) {
    for (let i = 0; i < fieldList.childCount; i++) {
      const field = fieldList.child(i)!;
      if (field.type === "field_declaration") {
        const fieldName = findChild(field, "field_identifier");
        if (fieldName) {
          children.push(`${filePath}:${name}.${fieldName.text}`);
        }
      }
    }
  }

  return {
    id: `${filePath}:${name}`,
    name,
    kind: "class",
    visibility: isExported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported: isExported,
    children: children.length > 0 ? children : undefined,
    docs,
    signature: `struct ${name}`,
  };
}

function extractEnum(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined
): Symbol | null {
  const nameNode = findChild(node, "type_identifier");
  if (!nameNode) return null;

  const name = nameNode.text;
  const isExported = isPub(node);

  return {
    id: `${filePath}:${name}`,
    name,
    kind: "enum",
    visibility: isExported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported: isExported,
    docs,
    signature: `enum ${name}`,
  };
}

function extractTrait(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined
): Symbol | null {
  const nameNode = findChild(node, "type_identifier");
  if (!nameNode) return null;

  const name = nameNode.text;
  const isExported = isPub(node);

  return {
    id: `${filePath}:${name}`,
    name,
    kind: "interface",
    visibility: isExported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported: isExported,
    docs,
    signature: `trait ${name}`,
  };
}

function extractImplMethods(
  node: TreeSitterNode,
  filePath: string,
  content: string
): Symbol[] {
  const results: Symbol[] = [];

  // Get the type being implemented
  const typeNode = findChild(node, "type_identifier");
  const typeName = typeNode?.text || "Unknown";

  const body = findChild(node, "declaration_list");
  if (!body) return results;

  for (let i = 0; i < body.childCount; i++) {
    const child = body.child(i)!;
    if (child.type === "function_item") {
      const docs = findPrecedingDocCommentInner(body, i, content);
      const nameNode = findChild(child, "identifier");
      if (!nameNode) continue;

      const name = nameNode.text;
      const isExported = isPub(child);
      const params = extractParams(child);
      const returnType = extractReturnType(child);

      results.push({
        id: `${filePath}:${typeName}.${name}`,
        name,
        kind: "method",
        visibility: isExported ? "public" : "private",
        location: {
          file: filePath,
          line: child.startPosition.row + 1,
          column: child.startPosition.column,
          endLine: child.endPosition.row + 1,
          endColumn: child.endPosition.column,
        },
        exported: isExported,
        parameters: params.length > 0 ? params : undefined,
        returns: returnType ? { type: returnType } : undefined,
        parentId: `${filePath}:${typeName}`,
        docs,
        signature: buildSignature(child),
      });
    }
  }

  return results;
}

function extractTypeAlias(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined
): Symbol | null {
  const nameNode = findChild(node, "type_identifier");
  if (!nameNode) return null;

  const name = nameNode.text;
  const isExported = isPub(node);

  return {
    id: `${filePath}:${name}`,
    name,
    kind: "type",
    visibility: isExported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
    },
    exported: isExported,
    docs,
    signature: `type ${name}`,
  };
}

function extractConstStatic(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined
): Symbol | null {
  const nameNode = findChild(node, "identifier");
  if (!nameNode) return null;

  const name = nameNode.text;
  const isExported = isPub(node);
  const isConst = node.type === "const_item";

  return {
    id: `${filePath}:${name}`,
    name,
    kind: "constant",
    visibility: isExported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
    },
    exported: isExported,
    docs,
    signature: isConst ? `const ${name}` : `static ${name}`,
  };
}

// ─── Parameter Extraction ───────────────────────────────────────────────────

function extractParams(node: TreeSitterNode): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  const paramList = findChild(node, "parameters");
  if (!paramList) return params;

  for (let i = 0; i < paramList.childCount; i++) {
    const child = paramList.child(i)!;
    if (child.type === "parameter") {
      const pattern = findChild(child, "identifier");
      if (pattern && pattern.text !== "self") {
        // Get type — everything after the colon
        const typeNode = child.childForFieldName("type");
        params.push({
          name: pattern.text,
          type: typeNode?.text || undefined,
          optional: false,
          rest: false,
        });
      }
    } else if (child.type === "self_parameter") {
      // Skip &self, &mut self, self
    }
  }

  return params;
}

function extractReturnType(node: TreeSitterNode): string | undefined {
  // Look for -> Type after parameters
  const text = node.text;
  const arrowMatch = text.match(/->\s*([^{]+)/);
  if (arrowMatch) {
    return arrowMatch[1].trim();
  }
  return undefined;
}

// ─── Comment Extraction ─────────────────────────────────────────────────────

function extractModuleDoc(root: TreeSitterNode, content: string): DocComment | undefined {
  const lines = content.split("\n");
  const docLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//!")) {
      docLines.push(trimmed.replace(/^\/\/!\s?/, ""));
    } else if (trimmed === "" && docLines.length > 0) {
      continue;
    } else if (docLines.length > 0) {
      break;
    } else if (trimmed !== "" && !trimmed.startsWith("//")) {
      break;
    }
  }

  if (docLines.length === 0) return undefined;

  return {
    summary: docLines[0],
    description: docLines.length > 1 ? docLines.join("\n") : undefined,
  };
}

function findPrecedingDocComment(
  root: TreeSitterNode,
  nodeIndex: number,
  content: string
): DocComment | undefined {
  const docLines: string[] = [];

  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = root.child(i);
    if (!prev) break;

    if (prev.type === "line_comment" || prev.type === "block_comment") {
      const text = prev.text;
      if (text.startsWith("///")) {
        docLines.unshift(text.replace(/^\/\/\/\s?/, ""));
      } else if (text.startsWith("/**")) {
        const cleaned = text
          .replace(/^\/\*\*\s*/, "")
          .replace(/\s*\*\/$/, "")
          .split("\n")
          .map((l) => l.replace(/^\s*\*\s?/, "").trim())
          .filter(Boolean);
        docLines.unshift(...cleaned);
      } else {
        break;
      }
    } else if (prev.type === "attribute_item") {
      // Skip #[...] attributes
      continue;
    } else {
      break;
    }
  }

  if (docLines.length === 0) return undefined;

  return {
    summary: docLines[0],
    description: docLines.length > 1 ? docLines.join("\n") : undefined,
  };
}

function findPrecedingDocCommentInner(
  parent: TreeSitterNode,
  nodeIndex: number,
  content: string
): DocComment | undefined {
  const docLines: string[] = [];

  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = parent.child(i);
    if (!prev) break;

    if (prev.type === "line_comment" || prev.type === "block_comment") {
      const text = prev.text;
      if (text.startsWith("///")) {
        docLines.unshift(text.replace(/^\/\/\/\s?/, ""));
      } else {
        break;
      }
    } else if (prev.type === "attribute_item") {
      continue;
    } else {
      break;
    }
  }

  if (docLines.length === 0) return undefined;

  return {
    summary: docLines[0],
    description: docLines.length > 1 ? docLines.join("\n") : undefined,
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

function isPub(node: TreeSitterNode): boolean {
  const text = node.text;
  return text.startsWith("pub ") || text.startsWith("pub(");
}

function buildSignature(node: TreeSitterNode): string {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return text.split("\n")[0].trim();
}
