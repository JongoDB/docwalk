/**
 * Java Parser
 *
 * Uses web-tree-sitter with the Java grammar to extract classes,
 * interfaces, enums, records, methods, fields, constructors,
 * Javadoc comments, and import statements.
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

export class JavaParser implements LanguageParser {
  language: LanguageId = "java";

  async parse(content: string, filePath: string): Promise<ParserResult> {
    const symbols: Symbol[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    let moduleDoc: DocComment | undefined;

    const parser = await initParser("java");
    const tree = parser.parse(content);
    const root = tree.rootNode;

    // Package-level Javadoc (before package declaration)
    moduleDoc = extractPackageDoc(root, content);

    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i)!;

      if (node.type === "import_declaration") {
        const imp = extractImport(node);
        if (imp) imports.push(imp);
        continue;
      }

      if (node.type === "class_declaration" || node.type === "interface_declaration" ||
          node.type === "enum_declaration" || node.type === "record_declaration") {
        const docs = findPrecedingJavadoc(root, i, content);
        const syms = extractTypeDeclaration(node, filePath, docs, content);
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
    }

    return { symbols, imports, exports, moduleDoc };
  }
}

// ─── Import Extraction ──────────────────────────────────────────────────────

function extractImport(node: TreeSitterNode): ImportInfo | null {
  const text = node.text;
  const isStatic = text.includes("import static");

  const match = text.match(/import\s+(?:static\s+)?([\w.]+(?:\.\*)?)\s*;/);
  if (!match) return null;

  const source = match[1];
  const parts = source.split(".");
  const lastName = parts[parts.length - 1];

  return {
    source: parts.slice(0, -1).join("."),
    specifiers: [{
      name: lastName,
      isDefault: false,
      isNamespace: lastName === "*",
    }],
    isTypeOnly: !isStatic,
  };
}

// ─── Type Declaration Extraction ────────────────────────────────────────────

function extractTypeDeclaration(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined,
  content: string
): Symbol[] {
  const results: Symbol[] = [];

  const nameNode = findChild(node, "identifier");
  if (!nameNode) return results;

  const name = nameNode.text;
  const isPublic = hasModifier(node, "public");

  let kind: SymbolKind = "class";
  if (node.type === "interface_declaration") kind = "interface";
  else if (node.type === "enum_declaration") kind = "enum";
  else if (node.type === "record_declaration") kind = "class";

  // Check for extends/implements
  let extendsName: string | undefined;
  const implementsList: string[] = [];
  const superclass = findChild(node, "superclass");
  if (superclass) {
    const typeNode = findChild(superclass, "type_identifier");
    extendsName = typeNode?.text;
  }
  const interfaces = findChild(node, "super_interfaces");
  if (interfaces) {
    const typeList = findChild(interfaces, "type_list");
    if (typeList) {
      for (let i = 0; i < typeList.childCount; i++) {
        const child = typeList.child(i)!;
        if (child.type === "type_identifier") {
          implementsList.push(child.text);
        }
      }
    }
  }

  const children: string[] = [];

  // Extract class body members
  const body = findChild(node, "class_body") ||
    findChild(node, "interface_body") ||
    findChild(node, "enum_body");

  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i)!;

      if (member.type === "method_declaration" || member.type === "constructor_declaration") {
        const memberDocs = findPrecedingJavadocInner(body, i, content);
        const memberName = findChild(member, "identifier");
        if (!memberName) continue;

        const mName = memberName.text;
        const mIsPublic = hasModifier(member, "public");
        const params = extractMethodParams(member);
        const returnType = extractMethodReturnType(member);

        const methodSym: Symbol = {
          id: `${filePath}:${name}.${mName}`,
          name: mName,
          kind: member.type === "constructor_declaration" ? "method" : "method",
          visibility: mIsPublic ? "public" : hasModifier(member, "protected") ? "protected" : "private",
          location: {
            file: filePath,
            line: member.startPosition.row + 1,
            column: member.startPosition.column,
            endLine: member.endPosition.row + 1,
            endColumn: member.endPosition.column,
          },
          exported: mIsPublic,
          parameters: params.length > 0 ? params : undefined,
          returns: returnType ? { type: returnType } : undefined,
          parentId: `${filePath}:${name}`,
          docs: memberDocs,
          signature: buildSignature(member),
        };
        results.push(methodSym);
        children.push(methodSym.id);
      }

      if (member.type === "field_declaration") {
        const fieldName = findChild(member, "variable_declarator");
        if (fieldName) {
          const fName = findChild(fieldName, "identifier");
          if (fName) {
            children.push(`${filePath}:${name}.${fName.text}`);
          }
        }
      }
    }
  }

  const typeSym: Symbol = {
    id: `${filePath}:${name}`,
    name,
    kind,
    visibility: isPublic ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported: isPublic,
    extends: extendsName,
    implements: implementsList.length > 0 ? implementsList : undefined,
    children: children.length > 0 ? children : undefined,
    docs,
    signature: buildTypeSignature(node, name, kind),
  };

  results.unshift(typeSym);
  return results;
}

// ─── Parameter Extraction ───────────────────────────────────────────────────

function extractMethodParams(node: TreeSitterNode): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  const formalParams = findChild(node, "formal_parameters");
  if (!formalParams) return params;

  for (let i = 0; i < formalParams.childCount; i++) {
    const child = formalParams.child(i)!;
    if (child.type === "formal_parameter" || child.type === "spread_parameter") {
      const nameNode = findChild(child, "identifier");
      const typeNode = child.childCount > 0 ? child.child(0) : null;
      let typeName = "";
      // Get the type part (everything before the identifier)
      for (let j = 0; j < child.childCount; j++) {
        const part = child.child(j)!;
        if (part.type === "identifier") break;
        if (part.isNamed) typeName = part.text;
      }

      if (nameNode) {
        params.push({
          name: nameNode.text,
          type: typeName || undefined,
          optional: false,
          rest: child.type === "spread_parameter",
        });
      }
    }
  }

  return params;
}

function extractMethodReturnType(node: TreeSitterNode): string | undefined {
  // In Java tree-sitter, return type appears before method name
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type === "identifier" || child.type === "formal_parameters") break;
    if (child.type === "void_type" || child.type === "type_identifier" ||
        child.type === "generic_type" || child.type === "array_type" ||
        child.type === "integral_type" || child.type === "floating_point_type" ||
        child.type === "boolean_type") {
      return child.text;
    }
  }
  return undefined;
}

// ─── Javadoc Extraction ─────────────────────────────────────────────────────

function extractPackageDoc(root: TreeSitterNode, content: string): DocComment | undefined {
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i)!;
    if (node.type === "package_declaration") {
      return findPrecedingJavadoc(root, i, content);
    }
  }
  return undefined;
}

function findPrecedingJavadoc(
  root: TreeSitterNode,
  nodeIndex: number,
  content: string
): DocComment | undefined {
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = root.child(i);
    if (!prev) break;

    if (prev.type === "block_comment" || prev.type === "comment") {
      return parseJavadoc(prev.text);
    } else if (prev.type === "marker_annotation" || prev.type === "annotation") {
      continue;
    } else {
      break;
    }
  }
  return undefined;
}

function findPrecedingJavadocInner(
  parent: TreeSitterNode,
  nodeIndex: number,
  content: string
): DocComment | undefined {
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = parent.child(i);
    if (!prev) break;

    if (prev.type === "block_comment" || prev.type === "comment") {
      return parseJavadoc(prev.text);
    } else if (prev.type === "marker_annotation" || prev.type === "annotation") {
      continue;
    } else {
      break;
    }
  }
  return undefined;
}

function parseJavadoc(text: string): DocComment | undefined {
  if (!text.startsWith("/**")) return undefined;

  const lines = text
    .replace(/^\/\*\*\s*/, "")
    .replace(/\s*\*\/$/, "")
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean);

  if (lines.length === 0) return undefined;

  // Separate description from @tags
  const descLines: string[] = [];
  const params: Record<string, string> = {};
  let returns: string | undefined;
  let deprecated: string | boolean | undefined;

  for (const line of lines) {
    if (line.startsWith("@param ")) {
      const match = line.match(/@param\s+(\w+)\s+(.*)/);
      if (match) params[match[1]] = match[2];
    } else if (line.startsWith("@return ") || line.startsWith("@returns ")) {
      returns = line.replace(/@returns?\s+/, "");
    } else if (line.startsWith("@deprecated")) {
      deprecated = line.replace(/@deprecated\s*/, "") || true;
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

function hasModifier(node: TreeSitterNode, modifier: string): boolean {
  const modifiers = findChild(node, "modifiers");
  if (modifiers) {
    return modifiers.text.includes(modifier);
  }
  // Also check direct text
  const text = node.text;
  const firstLine = text.split("\n")[0];
  return firstLine.includes(modifier);
}

function buildSignature(node: TreeSitterNode): string {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return text.split("\n")[0].trim();
}

function buildTypeSignature(node: TreeSitterNode, name: string, kind: SymbolKind): string {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return `${kind} ${name}`;
}
