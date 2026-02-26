/**
 * PHP Parser
 *
 * Uses web-tree-sitter with the PHP grammar to extract classes,
 * interfaces, traits, enums (8.1), functions, methods, PHPDoc
 * comments, use statements, and namespace declarations.
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

export class PhpParser implements LanguageParser {
  language: LanguageId = "php";

  async parse(content: string, filePath: string): Promise<ParserResult> {
    const symbols: Symbol[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    let moduleDoc: DocComment | undefined;

    const parser = await initParser("php");
    const tree = parser.parse(content);
    const root = tree.rootNode;

    // PHP wraps everything in a program node
    const program = root.type === "program" ? root : root;

    // First doc comment can serve as file-level doc
    moduleDoc = findFileDoc(program, content);

    this.walkNode(program, filePath, content, symbols, imports, exports);

    return { symbols, imports, exports, moduleDoc };
  }

  private walkNode(
    node: TreeSitterNode,
    filePath: string,
    content: string,
    symbols: Symbol[],
    imports: ImportInfo[],
    exports: ExportInfo[]
  ): void {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i)!;

      // namespace_use_declaration = use statements
      if (child.type === "namespace_use_declaration") {
        const imps = extractUseDeclaration(child);
        imports.push(...imps);
        continue;
      }

      // namespace_definition
      if (child.type === "namespace_definition") {
        const body = findChild(child, "compound_statement") || findChild(child, "declaration_list");
        if (body) {
          this.walkNode(body, filePath, content, symbols, imports, exports);
        }
        continue;
      }

      // Class
      if (child.type === "class_declaration") {
        const docs = findPrecedingPhpDoc(node, i, content);
        const syms = extractClassDeclaration(child, filePath, docs, content);
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

      // Interface
      if (child.type === "interface_declaration") {
        const docs = findPrecedingPhpDoc(node, i, content);
        const sym = extractInterfaceOrTrait(child, filePath, docs, "interface");
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

      // Trait
      if (child.type === "trait_declaration") {
        const docs = findPrecedingPhpDoc(node, i, content);
        const sym = extractInterfaceOrTrait(child, filePath, docs, "class");
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

      // Enum (PHP 8.1)
      if (child.type === "enum_declaration") {
        const docs = findPrecedingPhpDoc(node, i, content);
        const sym = extractInterfaceOrTrait(child, filePath, docs, "enum");
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

      // Top-level function
      if (child.type === "function_definition") {
        const docs = findPrecedingPhpDoc(node, i, content);
        const sym = extractFunction(child, filePath, docs);
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
  }
}

// ─── Import Extraction ──────────────────────────────────────────────────────

function extractUseDeclaration(node: TreeSitterNode): ImportInfo[] {
  const results: ImportInfo[] = [];
  const text = node.text;

  // Match: use Foo\Bar\Baz;  or  use Foo\Bar\{Baz, Qux};
  const groupMatch = text.match(/use\s+([\w\\]+)\\\{([^}]+)\}/);
  if (groupMatch) {
    const base = groupMatch[1];
    const items = groupMatch[2].split(",").map((s) => s.trim());
    for (const item of items) {
      const aliasMatch = item.match(/(\w+)\s+as\s+(\w+)/);
      results.push({
        source: base,
        specifiers: [{
          name: aliasMatch ? aliasMatch[1] : item,
          alias: aliasMatch ? aliasMatch[2] : undefined,
          isDefault: false,
          isNamespace: false,
        }],
        isTypeOnly: false,
      });
    }
    return results;
  }

  const singleMatch = text.match(/use\s+([\w\\]+?)(?:\s+as\s+(\w+))?;/);
  if (singleMatch) {
    const source = singleMatch[1];
    const parts = source.split("\\");
    const name = parts[parts.length - 1];
    results.push({
      source: parts.slice(0, -1).join("\\"),
      specifiers: [{
        name,
        alias: singleMatch[2],
        isDefault: false,
        isNamespace: false,
      }],
      isTypeOnly: false,
    });
  }

  return results;
}

// ─── Symbol Extraction ──────────────────────────────────────────────────────

function extractClassDeclaration(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined,
  content: string
): Symbol[] {
  const results: Symbol[] = [];

  const nameNode = findChild(node, "name");
  if (!nameNode) return results;

  const name = nameNode.text;

  // Check extends/implements
  const baseClause = findChild(node, "base_clause");
  const extendsName = baseClause?.text.replace(/extends\s+/, "").trim();

  const interfaceClause = findChild(node, "class_interface_clause");
  const implementsList: string[] = [];
  if (interfaceClause) {
    const text = interfaceClause.text.replace(/implements\s+/, "");
    implementsList.push(...text.split(",").map((s) => s.trim()).filter(Boolean));
  }

  const children: string[] = [];
  const body = findChild(node, "declaration_list");
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i)!;

      if (member.type === "method_declaration") {
        const memberDocs = findPrecedingPhpDoc(body, i, content);
        const nameNode = findChild(member, "name");
        if (!nameNode) continue;

        const mName = nameNode.text;
        const isPublic = hasVisibility(member, "public") || !hasAnyVisibility(member);
        const params = extractMethodParams(member);
        const returnType = extractReturnType(member);

        const methodSym: Symbol = {
          id: `${filePath}:${name}.${mName}`,
          name: mName,
          kind: "method",
          visibility: isPublic ? "public" : hasVisibility(member, "protected") ? "protected" : "private",
          location: {
            file: filePath,
            line: member.startPosition.row + 1,
            column: member.startPosition.column,
            endLine: member.endPosition.row + 1,
            endColumn: member.endPosition.column,
          },
          exported: isPublic,
          parameters: params.length > 0 ? params : undefined,
          returns: returnType ? { type: returnType } : undefined,
          parentId: `${filePath}:${name}`,
          docs: memberDocs,
          signature: buildSignature(member),
        };
        results.push(methodSym);
        children.push(methodSym.id);
      }

      if (member.type === "property_declaration") {
        const propName = findChild(member, "property_element");
        if (propName) {
          const varNode = findChild(propName, "variable_name");
          if (varNode) {
            children.push(`${filePath}:${name}.${varNode.text}`);
          }
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
    implements: implementsList.length > 0 ? implementsList : undefined,
    children: children.length > 0 ? children : undefined,
    docs,
    signature: buildTypeSignature(node, name),
  };

  results.unshift(classSym);
  return results;
}

function extractInterfaceOrTrait(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined,
  kind: SymbolKind
): Symbol | null {
  const nameNode = findChild(node, "name");
  if (!nameNode) return null;

  const name = nameNode.text;

  return {
    id: `${filePath}:${name}`,
    name,
    kind,
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
    signature: `${node.type.replace("_declaration", "")} ${name}`,
  };
}

function extractFunction(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined
): Symbol | null {
  const nameNode = findChild(node, "name");
  if (!nameNode) return null;

  const name = nameNode.text;
  const params = extractMethodParams(node);
  const returnType = extractReturnType(node);

  return {
    id: `${filePath}:${name}`,
    name,
    kind: "function",
    visibility: "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported: true,
    parameters: params.length > 0 ? params : undefined,
    returns: returnType ? { type: returnType } : undefined,
    docs,
    signature: buildSignature(node),
  };
}

// ─── Parameter Extraction ───────────────────────────────────────────────────

function extractMethodParams(node: TreeSitterNode): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  const paramList = findChild(node, "formal_parameters");
  if (!paramList) return params;

  for (let i = 0; i < paramList.childCount; i++) {
    const child = paramList.child(i)!;
    if (child.type === "simple_parameter" || child.type === "property_promotion_parameter") {
      const varNode = findChild(child, "variable_name");
      const typeNode = findChild(child, "type_list") || findChild(child, "named_type") || findChild(child, "primitive_type");

      if (varNode) {
        params.push({
          name: varNode.text.replace(/^\$/, ""),
          type: typeNode?.text || undefined,
          optional: child.text.includes("="),
          rest: false,
        });
      }
    } else if (child.type === "variadic_parameter") {
      const varNode = findChild(child, "variable_name");
      params.push({
        name: varNode?.text.replace(/^\$/, "") ?? "args",
        optional: true,
        rest: true,
      });
    }
  }

  return params;
}

function extractReturnType(node: TreeSitterNode): string | undefined {
  // Look for : TypeName after parameter list
  const text = node.text;
  const match = text.match(/\)\s*:\s*([\w|\\?]+)/);
  if (match) return match[1];
  return undefined;
}

// ─── PHPDoc Extraction ──────────────────────────────────────────────────────

function findFileDoc(root: TreeSitterNode, content: string): DocComment | undefined {
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i)!;
    if (node.type === "comment") {
      return parsePhpDoc(node.text);
    } else if (node.type === "php_tag" || node.type === "text") {
      continue;
    } else {
      break;
    }
  }
  return undefined;
}

function findPrecedingPhpDoc(
  parent: TreeSitterNode,
  nodeIndex: number,
  content: string
): DocComment | undefined {
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = parent.child(i);
    if (!prev) break;

    if (prev.type === "comment") {
      return parsePhpDoc(prev.text);
    } else if (prev.type === "attribute_list" || prev.type === "attribute_group") {
      continue;
    } else {
      break;
    }
  }
  return undefined;
}

function parsePhpDoc(text: string): DocComment | undefined {
  if (!text.startsWith("/**")) return undefined;

  const lines = text
    .replace(/^\/\*\*\s*/, "")
    .replace(/\s*\*\/$/, "")
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean);

  if (lines.length === 0) return undefined;

  const descLines: string[] = [];
  const params: Record<string, string> = {};
  let returns: string | undefined;
  let deprecated: string | boolean | undefined;

  for (const line of lines) {
    if (line.startsWith("@param")) {
      const match = line.match(/@param\s+\S+\s+\$(\w+)\s*(.*)/);
      if (match) params[match[1]] = match[2];
    } else if (line.startsWith("@return")) {
      returns = line.replace(/@returns?\s+\S+\s*/, "");
    } else if (line.startsWith("@deprecated")) {
      deprecated = line.replace(/@deprecated\s*/, "") || true;
    } else if (line.startsWith("@throws")) {
      // Skip for now
    } else if (!line.startsWith("@")) {
      descLines.push(line);
    }
  }

  const summary = descLines[0] || "";
  const description = descLines.length > 1 ? descLines.join("\n") : undefined;

  return {
    summary,
    description,
    params: Object.keys(params).length > 0 ? params : undefined,
    returns,
    deprecated,
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

function hasVisibility(node: TreeSitterNode, visibility: string): boolean {
  const text = node.text;
  const firstLine = text.split("{")[0] || text.split("\n")[0];
  return new RegExp(`\\b${visibility}\\b`).test(firstLine);
}

function hasAnyVisibility(node: TreeSitterNode): boolean {
  return hasVisibility(node, "public") || hasVisibility(node, "protected") || hasVisibility(node, "private");
}

function buildSignature(node: TreeSitterNode): string {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return text.split("\n")[0].trim();
}

function buildTypeSignature(node: TreeSitterNode, name: string): string {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return `class ${name}`;
}
