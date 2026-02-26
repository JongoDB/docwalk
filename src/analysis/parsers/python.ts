/**
 * Python Parser
 *
 * Uses web-tree-sitter with the Python grammar to extract functions,
 * classes, methods, properties, decorators, type hints, docstrings,
 * imports, and __all__ exports.
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

export class PythonParser implements LanguageParser {
  language: LanguageId = "python";

  async parse(content: string, filePath: string): Promise<ParserResult> {
    const symbols: Symbol[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    let moduleDoc: DocComment | undefined;

    const parser = await initParser("python");
    const tree = parser.parse(content);
    const root = tree.rootNode;

    // __all__ defines explicit exports
    const allExports = extractAllExports(root);

    // Module docstring: first expression_statement containing a string
    moduleDoc = extractModuleDocstring(root);

    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i)!;

      if (node.type === "import_statement") {
        const imp = extractImport(node);
        if (imp) imports.push(imp);
        continue;
      }

      if (node.type === "import_from_statement") {
        const imp = extractFromImport(node);
        if (imp) imports.push(imp);
        continue;
      }

      if (node.type === "function_definition") {
        const docstring = extractDocstring(node);
        const isExported = isPublicName(nameOf(node)) &&
          (allExports === null || allExports.includes(nameOf(node)));
        const sym = extractFunction(node, filePath, isExported, docstring);
        if (sym) {
          symbols.push(sym);
          if (isExported) {
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

      if (node.type === "class_definition") {
        const docstring = extractDocstring(node);
        const name = nameOf(node);
        const isExported = isPublicName(name) &&
          (allExports === null || allExports.includes(name));
        const sym = extractClass(node, filePath, isExported, docstring);
        if (sym) {
          symbols.push(sym);
          if (isExported) {
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

      // Top-level assignments (constants)
      if (node.type === "expression_statement") {
        const assign = findChild(node, "assignment");
        if (assign) {
          const sym = extractAssignment(assign, filePath, allExports);
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
        }
      }
    }

    return { symbols, imports, exports, moduleDoc };
  }
}

// ─── Import Extraction ──────────────────────────────────────────────────────

function extractImport(node: TreeSitterNode): ImportInfo | null {
  // import os, import os.path
  const names: ImportInfo["specifiers"] = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type === "dotted_name") {
      names.push({
        name: child.text,
        isDefault: false,
        isNamespace: false,
      });
    } else if (child.type === "aliased_import") {
      const nameNode = findChild(child, "dotted_name");
      const aliasNode = findChild(child, "identifier");
      names.push({
        name: nameNode?.text ?? child.text,
        alias: aliasNode?.text,
        isDefault: false,
        isNamespace: false,
      });
    }
  }
  if (names.length === 0) return null;
  return {
    source: names[0].name,
    specifiers: names,
    isTypeOnly: false,
  };
}

function extractFromImport(node: TreeSitterNode): ImportInfo | null {
  // from X import Y, Z
  let source = "";
  const specifiers: ImportInfo["specifiers"] = [];

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type === "dotted_name" || child.type === "relative_import") {
      if (!source) source = child.text;
      else {
        specifiers.push({
          name: child.text,
          isDefault: false,
          isNamespace: false,
        });
      }
    } else if (child.type === "aliased_import") {
      const nameNode = findChild(child, "dotted_name") ??
        findChild(child, "identifier");
      const parts = child.text.split(/\s+as\s+/);
      specifiers.push({
        name: nameNode?.text ?? parts[0],
        alias: parts[1],
        isDefault: false,
        isNamespace: false,
      });
    } else if (child.type === "wildcard_import") {
      specifiers.push({
        name: "*",
        isDefault: false,
        isNamespace: true,
      });
    }
  }

  if (!source) return null;
  return { source, specifiers, isTypeOnly: false };
}

// ─── Function Extraction ────────────────────────────────────────────────────

function extractFunction(
  node: TreeSitterNode,
  filePath: string,
  exported: boolean,
  docs: DocComment | undefined
): Symbol | null {
  const name = nameOf(node);
  if (!name) return null;

  const isAsync = node.text.startsWith("async ");
  const params = extractParameters(node);
  const returnType = extractReturnType(node);
  const decorators = extractDecorators(node);

  return {
    id: `${filePath}:${name}`,
    name,
    kind: "function",
    visibility: name.startsWith("_") ? "private" : "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported,
    async: isAsync || undefined,
    parameters: params.length > 0 ? params : undefined,
    returns: returnType ? { type: returnType } : undefined,
    decorators: decorators.length > 0 ? decorators : undefined,
    docs,
    signature: buildSignature(node),
  };
}

// ─── Class Extraction ───────────────────────────────────────────────────────

function extractClass(
  node: TreeSitterNode,
  filePath: string,
  exported: boolean,
  docs: DocComment | undefined
): Symbol | null {
  const name = nameOf(node);
  if (!name) return null;

  // Base classes
  const bases: string[] = [];
  const argList = findChild(node, "argument_list");
  if (argList) {
    for (let i = 0; i < argList.childCount; i++) {
      const child = argList.child(i)!;
      if (child.isNamed) {
        bases.push(child.text);
      }
    }
  }

  const decorators = extractDecorators(node);
  const children: string[] = [];

  // Extract class body members
  const body = findChild(node, "block");
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i)!;
      if (member.type === "function_definition") {
        const methodName = nameOf(member);
        if (methodName) {
          children.push(`${filePath}:${name}.${methodName}`);
        }
      }
    }
  }

  return {
    id: `${filePath}:${name}`,
    name,
    kind: "class",
    visibility: name.startsWith("_") ? "private" : "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported,
    extends: bases[0],
    implements: bases.length > 1 ? bases.slice(1) : undefined,
    decorators: decorators.length > 0 ? decorators : undefined,
    children: children.length > 0 ? children : undefined,
    docs,
  };
}

// ─── Assignment Extraction ──────────────────────────────────────────────────

function extractAssignment(
  node: TreeSitterNode,
  filePath: string,
  allExports: string[] | null
): Symbol | null {
  // Skip __all__ itself
  const leftNode = node.child(0);
  if (!leftNode) return null;
  const name = leftNode.text;
  if (name === "__all__" || name.startsWith("_")) return null;

  const isExported = allExports === null || allExports.includes(name);
  const isUpperCase = name === name.toUpperCase() && name.length > 1;

  return {
    id: `${filePath}:${name}`,
    name,
    kind: isUpperCase ? "constant" : "variable",
    visibility: "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
    },
    exported: isExported,
  };
}

// ─── Docstring Extraction ───────────────────────────────────────────────────

function extractDocstring(node: TreeSitterNode): DocComment | undefined {
  const body = findChild(node, "block");
  if (!body || body.childCount === 0) return undefined;

  const first = body.child(0);
  if (!first || first.type !== "expression_statement") return undefined;

  const str = findChild(first, "string");
  if (!str) return undefined;

  return parseDocstring(str.text);
}

function extractModuleDocstring(root: TreeSitterNode): DocComment | undefined {
  const first = root.child(0);
  if (!first || first.type !== "expression_statement") return undefined;

  const str = findChild(first, "string");
  if (!str || !str.text.startsWith('"""') && !str.text.startsWith("'''"))
    return undefined;

  return parseDocstring(str.text);
}

function parseDocstring(raw: string): DocComment {
  // Strip triple quotes
  let content = raw;
  if (content.startsWith('"""') || content.startsWith("'''")) {
    content = content.slice(3, -3);
  } else if (content.startsWith('"') || content.startsWith("'")) {
    content = content.slice(1, -1);
  }

  const lines = content.split("\n").map((l) => l.trim());
  const summary = lines[0] || "";

  const params: Record<string, string> = {};
  let returns: string | undefined;

  // Google-style: Args: / Returns:
  let section = "";
  for (const line of lines.slice(1)) {
    if (/^Args?:/i.test(line)) {
      section = "args";
      continue;
    }
    if (/^Returns?:/i.test(line)) {
      section = "returns";
      continue;
    }
    if (/^(Raises?|Yields?|Notes?|Examples?|Attributes?|See Also|References?|Warnings?|Todo):/i.test(line)) {
      section = "other";
      continue;
    }

    if (section === "args") {
      const paramMatch = line.match(/^(\w+)\s*(?:\([^)]*\))?\s*:\s*(.*)/);
      if (paramMatch) {
        params[paramMatch[1]] = paramMatch[2];
      }
    }
    if (section === "returns" && line) {
      returns = (returns ? returns + " " : "") + line;
    }
  }

  // NumPy-style: Parameters\n----------
  const numpyParamMatch = content.match(
    /Parameters\s*\n\s*-+\s*\n([\s\S]*?)(?=\n\s*\w+\s*\n\s*-+|$)/
  );
  if (numpyParamMatch) {
    const paramLines = numpyParamMatch[1].split("\n");
    let currentParam = "";
    for (const line of paramLines) {
      const nameMatch = line.trim().match(/^(\w+)\s*:/);
      if (nameMatch) {
        currentParam = nameMatch[1];
        const desc = line.trim().slice(nameMatch[0].length).trim();
        if (desc) params[currentParam] = desc;
      } else if (currentParam && line.trim()) {
        params[currentParam] =
          (params[currentParam] ? params[currentParam] + " " : "") +
          line.trim();
      }
    }
  }

  // reST style: :param name: description
  const restParamRegex = /:param\s+(\w+):\s*(.*)/g;
  let match;
  while ((match = restParamRegex.exec(content)) !== null) {
    params[match[1]] = match[2];
  }

  const restReturnMatch = content.match(/:returns?:\s*(.*)/);
  if (restReturnMatch) returns = restReturnMatch[1];

  return {
    summary,
    description: lines.length > 1 ? content.trim() : undefined,
    params: Object.keys(params).length > 0 ? params : undefined,
    returns,
  };
}

// ─── Parameter Extraction ───────────────────────────────────────────────────

function extractParameters(node: TreeSitterNode): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  const paramsNode = findChild(node, "parameters");
  if (!paramsNode) return params;

  for (let i = 0; i < paramsNode.childCount; i++) {
    const param = paramsNode.child(i)!;

    if (param.type === "identifier") {
      if (param.text === "self" || param.text === "cls") continue;
      params.push({ name: param.text, optional: false, rest: false });
    } else if (param.type === "typed_parameter") {
      const nameNode = findChild(param, "identifier");
      const typeNode = findChild(param, "type");
      const name = nameNode?.text ?? param.text;
      if (name === "self" || name === "cls") continue;
      params.push({
        name,
        type: typeNode?.text,
        optional: false,
        rest: false,
      });
    } else if (param.type === "default_parameter" || param.type === "typed_default_parameter") {
      const nameNode = param.childForFieldName("name") ??
        findChild(param, "identifier");
      const typeNode = findChild(param, "type");
      const valueNode = param.childForFieldName("value");
      const name = nameNode?.text ?? param.text.split("=")[0].trim().split(":")[0].trim();
      if (name === "self" || name === "cls") continue;
      params.push({
        name,
        type: typeNode?.text,
        defaultValue: valueNode?.text,
        optional: true,
        rest: false,
      });
    } else if (param.type === "list_splat_pattern") {
      const nameNode = findChild(param, "identifier");
      params.push({
        name: nameNode?.text ?? param.text.replace("*", ""),
        optional: true,
        rest: true,
      });
    } else if (param.type === "dictionary_splat_pattern") {
      const nameNode = findChild(param, "identifier");
      params.push({
        name: nameNode?.text ?? param.text.replace("**", ""),
        optional: true,
        rest: true,
      });
    }
  }

  return params;
}

function extractReturnType(node: TreeSitterNode): string | undefined {
  const returnType = node.childForFieldName("return_type") ??
    findChild(node, "type");
  return returnType?.text;
}

function extractDecorators(node: TreeSitterNode): string[] {
  const decorators: string[] = [];
  // Look at preceding siblings for decorator nodes
  let sibling = node.previousSibling;
  while (sibling) {
    if (sibling.type === "decorator") {
      decorators.unshift(sibling.text.replace(/^@/, ""));
    } else if (sibling.type !== "comment") {
      break;
    }
    sibling = sibling.previousSibling;
  }
  return decorators;
}

// ─── __all__ Extraction ─────────────────────────────────────────────────────

function extractAllExports(root: TreeSitterNode): string[] | null {
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i)!;
    if (node.type !== "expression_statement") continue;

    const assign = findChild(node, "assignment");
    if (!assign) continue;

    const left = assign.child(0);
    if (!left || left.text !== "__all__") continue;

    const right = assign.child(assign.childCount - 1);
    if (!right) continue;

    const names: string[] = [];
    const listNode = right.type === "list" ? right : findChild(right, "list");
    if (listNode) {
      for (let j = 0; j < listNode.childCount; j++) {
        const el = listNode.child(j)!;
        if (el.type === "string") {
          names.push(stripQuotes(el.text));
        }
      }
    }
    return names;
  }
  return null; // No __all__ found — everything public is exported
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

function nameOf(node: TreeSitterNode): string {
  const nameNode = node.childForFieldName("name") ??
    findChild(node, "identifier");
  return nameNode?.text ?? "";
}

function isPublicName(name: string): boolean {
  return !!name && !name.startsWith("_");
}

function stripQuotes(s: string): string {
  return s.replace(/^['"]|['"]$/g, "");
}

function buildSignature(node: TreeSitterNode): string {
  const text = node.text;
  const colonIndex = text.indexOf(":");
  // For python, signature is up to the first colon that ends the def line
  const firstLine = text.split("\n")[0];
  return firstLine.replace(/:$/, "").trim();
}
