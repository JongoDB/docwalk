/**
 * Go Parser
 *
 * Uses web-tree-sitter with the Go grammar to extract functions,
 * methods with receiver types, structs, interfaces, type definitions,
 * package-level doc comments, and import groups.
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

export class GoParser implements LanguageParser {
  language: LanguageId = "go";

  async parse(content: string, filePath: string): Promise<ParserResult> {
    const symbols: Symbol[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    let moduleDoc: DocComment | undefined;

    const parser = await initParser("go");
    const tree = parser.parse(content);
    const root = tree.rootNode;

    // Package-level doc comment
    moduleDoc = extractPackageDoc(root);

    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i)!;

      if (node.type === "import_declaration") {
        const imps = extractImports(node);
        imports.push(...imps);
        continue;
      }

      if (node.type === "function_declaration") {
        const docs = findPrecedingComment(root, i);
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

      if (node.type === "method_declaration") {
        const docs = findPrecedingComment(root, i);
        const sym = extractMethod(node, filePath, docs);
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

      if (node.type === "type_declaration") {
        const docs = findPrecedingComment(root, i);
        const syms = extractTypeDeclaration(node, filePath, docs);
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

      if (node.type === "const_declaration" || node.type === "var_declaration") {
        const docs = findPrecedingComment(root, i);
        const syms = extractVarConst(node, filePath, docs);
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

function extractImports(node: TreeSitterNode): ImportInfo[] {
  const results: ImportInfo[] = [];

  const specList = findChild(node, "import_spec_list");
  if (specList) {
    // Grouped imports: import ( "fmt" \n "os" )
    for (let i = 0; i < specList.childCount; i++) {
      const spec = specList.child(i)!;
      if (spec.type === "import_spec") {
        const imp = parseImportSpec(spec);
        if (imp) results.push(imp);
      }
    }
  } else {
    // Single import: import "fmt"
    const spec = findChild(node, "import_spec");
    if (spec) {
      const imp = parseImportSpec(spec);
      if (imp) results.push(imp);
    }
    // Fallback: look for interpreted_string_literal
    const strNode = findChild(node, "interpreted_string_literal");
    if (strNode && results.length === 0) {
      results.push({
        source: stripQuotes(strNode.text),
        specifiers: [],
        isTypeOnly: false,
      });
    }
  }

  return results;
}

function parseImportSpec(node: TreeSitterNode): ImportInfo | null {
  let alias: string | undefined;
  let source = "";

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type === "package_identifier" || child.type === "dot" || child.type === "blank_identifier") {
      alias = child.text;
    }
    if (child.type === "interpreted_string_literal") {
      source = stripQuotes(child.text);
    }
  }

  if (!source) return null;

  const pkgName = source.split("/").pop() ?? source;
  const specifiers: ImportInfo["specifiers"] = [
    {
      name: pkgName,
      alias,
      isDefault: false,
      isNamespace: alias === ".",
    },
  ];

  return { source, specifiers, isTypeOnly: false };
}

// ─── Function Extraction ────────────────────────────────────────────────────

function extractFunction(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined
): Symbol | null {
  const nameNode = node.childForFieldName("name") ??
    findChild(node, "identifier");
  if (!nameNode) return null;

  const name = nameNode.text;
  const isExported = isUpperFirst(name);
  const params = extractParams(node);
  const returnType = extractGoReturnType(node);

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
    docs,
    signature: buildSignature(node),
  };
}

// ─── Method Extraction ──────────────────────────────────────────────────────

function extractMethod(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined
): Symbol | null {
  const nameNode = findChild(node, "field_identifier");
  if (!nameNode) return null;

  const name = nameNode.text;
  const isExported = isUpperFirst(name);

  // Extract receiver type
  let receiverType = "";
  const paramLists: TreeSitterNode[] = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type === "parameter_list") {
      paramLists.push(child);
    }
  }

  // First parameter_list is the receiver, second is the method params
  if (paramLists.length >= 1) {
    receiverType = paramLists[0].text.replace(/^\(/, "").replace(/\)$/, "").trim();
    // Extract just the type from "r *Config" -> "*Config"
    const parts = receiverType.split(/\s+/);
    if (parts.length > 1) receiverType = parts.slice(1).join(" ");
  }

  const params = paramLists.length >= 2
    ? extractParamsFromList(paramLists[1])
    : [];
  const returnType = extractGoReturnType(node);

  const parentName = receiverType.replace(/^\*/, "");

  return {
    id: `${filePath}:${parentName}.${name}`,
    name,
    kind: "method",
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
    parentId: `${filePath}:${parentName}`,
    typeAnnotation: receiverType,
    docs,
    signature: buildSignature(node),
  };
}

// ─── Type Declaration Extraction ────────────────────────────────────────────

function extractTypeDeclaration(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined
): Symbol[] {
  const results: Symbol[] = [];

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;

    if (child.type === "type_spec") {
      const sym = extractTypeSpec(child, filePath, docs);
      if (sym) results.push(sym);
    } else if (child.type === "type_alias") {
      const sym = extractTypeAlias(child, filePath, docs);
      if (sym) results.push(sym);
    }
  }

  return results;
}

function extractTypeSpec(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined
): Symbol | null {
  const nameNode = node.childForFieldName("name") ??
    findChild(node, "type_identifier");
  if (!nameNode) return null;

  const name = nameNode.text;
  const isExported = isUpperFirst(name);

  // Determine kind from the type body
  const typeBody = node.childForFieldName("type");
  let kind: SymbolKind = "type";

  if (typeBody) {
    if (typeBody.type === "struct_type") kind = "class"; // structs -> class
    else if (typeBody.type === "interface_type") kind = "interface";
  }

  // Extract struct fields as children
  const children: string[] = [];
  if (typeBody?.type === "struct_type") {
    const fieldList = findChild(typeBody, "field_declaration_list");
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
  }

  return {
    id: `${filePath}:${name}`,
    name,
    kind,
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
    signature: `type ${name} ${typeBody?.type === "struct_type" ? "struct" : typeBody?.type === "interface_type" ? "interface" : typeBody?.text ?? ""}`.trim(),
  };
}

function extractTypeAlias(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined
): Symbol | null {
  const nameNode = findChild(node, "type_identifier");
  if (!nameNode) return null;

  const name = nameNode.text;
  const isExported = isUpperFirst(name);

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
    signature: `type ${node.text}`,
  };
}

// ─── Const/Var Extraction ───────────────────────────────────────────────────

function extractVarConst(
  node: TreeSitterNode,
  filePath: string,
  docs: DocComment | undefined
): Symbol[] {
  const results: Symbol[] = [];
  const isConst = node.type === "const_declaration";

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type === "const_spec" || child.type === "var_spec") {
      const nameNode = findChild(child, "identifier");
      if (!nameNode) continue;

      const name = nameNode.text;
      const isExported = isUpperFirst(name);

      results.push({
        id: `${filePath}:${name}`,
        name,
        kind: isConst ? "constant" : "variable",
        visibility: isExported ? "public" : "private",
        location: {
          file: filePath,
          line: child.startPosition.row + 1,
          column: child.startPosition.column,
        },
        exported: isExported,
        docs,
      });
    }
  }

  return results;
}

// ─── Parameter Extraction ───────────────────────────────────────────────────

function extractParams(node: TreeSitterNode): ParameterInfo[] {
  // Skip past the name/receiver to find the actual parameter list
  const paramLists: TreeSitterNode[] = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type === "parameter_list") {
      paramLists.push(child);
    }
  }

  // For functions, there's just one parameter_list
  if (paramLists.length === 0) return [];
  return extractParamsFromList(paramLists[0]);
}

function extractParamsFromList(node: TreeSitterNode): ParameterInfo[] {
  const params: ParameterInfo[] = [];

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type === "parameter_declaration") {
      const nameNode = findChild(child, "identifier");
      // Get the type — it's everything after the name
      let typeText = "";
      let foundName = false;
      for (let j = 0; j < child.childCount; j++) {
        const part = child.child(j)!;
        if (part.type === "identifier") {
          foundName = true;
          continue;
        }
        if (foundName && part.isNamed) {
          typeText = part.text;
          break;
        }
      }

      if (nameNode) {
        params.push({
          name: nameNode.text,
          type: typeText || undefined,
          optional: false,
          rest: false,
        });
      }
    } else if (child.type === "variadic_parameter_declaration") {
      const nameNode = findChild(child, "identifier");
      params.push({
        name: nameNode?.text ?? "args",
        optional: true,
        rest: true,
      });
    }
  }

  return params;
}

function extractGoReturnType(node: TreeSitterNode): string | undefined {
  const result = node.childForFieldName("result");
  if (result) return result.text;

  // Look for type nodes after parameter lists
  let foundParams = false;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type === "parameter_list") {
      if (foundParams) {
        // This is the result parameter list
        return child.text;
      }
      foundParams = true;
      continue;
    }
    if (foundParams && child.type !== "block" && child.isNamed) {
      // Could be a simple return type
      if (
        child.type === "type_identifier" ||
        child.type === "pointer_type" ||
        child.type === "slice_type" ||
        child.type === "map_type" ||
        child.type === "qualified_type" ||
        child.type === "interface_type"
      ) {
        return child.text;
      }
    }
  }

  return undefined;
}

// ─── Comment Extraction ─────────────────────────────────────────────────────

function findPrecedingComment(
  root: TreeSitterNode,
  nodeIndex: number
): DocComment | undefined {
  const commentLines: string[] = [];

  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = root.child(i);
    if (!prev) break;

    if (prev.type === "comment") {
      const text = prev.text.replace(/^\/\/\s?/, "").trim();
      commentLines.unshift(text);
    } else {
      break;
    }
  }

  if (commentLines.length === 0) return undefined;

  const summary = commentLines[0];
  const description =
    commentLines.length > 1 ? commentLines.join("\n") : undefined;

  return { summary, description };
}

function extractPackageDoc(root: TreeSitterNode): DocComment | undefined {
  // Package doc is comment(s) immediately before package_clause
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i)!;
    if (node.type === "package_clause") {
      return findPrecedingComment(root, i);
    }
  }
  return undefined;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findChild(
  node: TreeSitterNode,
  type: string
): TreeSitterNode | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type === type) return child;
  }
  return null;
}

function isUpperFirst(name: string): boolean {
  if (!name) return false;
  const first = name[0];
  return first === first.toUpperCase() && first !== first.toLowerCase();
}

function stripQuotes(s: string): string {
  return s.replace(/^["'`]|["'`]$/g, "");
}

function buildSignature(node: TreeSitterNode): string {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return text.split("\n")[0].trim();
}
