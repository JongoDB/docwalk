/**
 * TypeScript / JavaScript Parser
 *
 * Uses web-tree-sitter with the TypeScript grammar to parse TS/JS source
 * files and extract functions, classes, interfaces, types, exports, imports,
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
  ParameterInfo,
} from "../types.js";
import type { LanguageId } from "../language-detect.js";
import { initParser, type TreeSitterNode } from "./tree-sitter-loader.js";

export class TypeScriptParser implements LanguageParser {
  language: LanguageId = "typescript";

  async parse(content: string, filePath: string): Promise<ParserResult> {
    const symbols: Symbol[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    let moduleDoc: DocComment | undefined;

    const parser = await initParser("typescript");
    const tree = parser.parse(content);
    const root = tree.rootNode;

    // Extract module-level doc comment (first comment in file if it's JSDoc)
    moduleDoc = extractModuleDoc(root);

    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i)!;

      if (node.type === "import_statement") {
        const imp = extractImport(node);
        if (imp) imports.push(imp);
        continue;
      }

      if (node.type === "export_statement") {
        processExportStatement(node, filePath, symbols, exports, root, i);
        continue;
      }

      // Top-level non-exported declarations
      const sym = extractDeclaration(node, filePath, false, false, root, i);
      if (sym) symbols.push(sym);
    }

    return { symbols, imports, exports, moduleDoc };
  }
}

// ─── Import Extraction ──────────────────────────────────────────────────────

function extractImport(node: TreeSitterNode): ImportInfo | null {
  const sourceNode = node.childForFieldName("source");
  if (!sourceNode) return null;

  const source = stripQuotes(sourceNode.text);
  const isTypeOnly = node.text.startsWith("import type");

  // Side-effect import: import 'module'
  const clause = findChild(node, "import_clause");
  if (!clause) {
    return { source, specifiers: [], isTypeOnly: false };
  }

  const specifiers: ImportInfo["specifiers"] = [];

  for (let i = 0; i < clause.childCount; i++) {
    const child = clause.child(i)!;

    if (child.type === "identifier") {
      // Default import: import foo from 'x'
      specifiers.push({
        name: child.text,
        isDefault: true,
        isNamespace: false,
      });
    } else if (child.type === "namespace_import") {
      // Namespace import: import * as ns from 'x'
      const alias = findChild(child, "identifier");
      specifiers.push({
        name: "*",
        alias: alias?.text,
        isDefault: false,
        isNamespace: true,
      });
    } else if (child.type === "named_imports") {
      // Named imports: import { a, b as c } from 'x'
      for (let j = 0; j < child.childCount; j++) {
        const spec = child.child(j)!;
        if (spec.type === "import_specifier") {
          const nameNode = spec.childForFieldName("name");
          const aliasNode = spec.childForFieldName("alias");
          specifiers.push({
            name: nameNode?.text ?? spec.text,
            alias: aliasNode?.text,
            isDefault: false,
            isNamespace: false,
          });
        }
      }
    }
  }

  return { source, specifiers, isTypeOnly };
}

// ─── Export Statement Processing ────────────────────────────────────────────

function processExportStatement(
  node: TreeSitterNode,
  filePath: string,
  symbols: Symbol[],
  exports: ExportInfo[],
  root: TreeSitterNode,
  nodeIndex: number
): void {
  const isDefault = node.text.includes("export default");

  // Re-export: export { foo } from './module' or export * from './module'
  const sourceNode = node.childForFieldName("source");
  if (sourceNode) {
    const source = stripQuotes(sourceNode.text);
    const exportClause = findChild(node, "export_clause");

    if (exportClause) {
      // export { foo, bar as baz } from './module'
      for (let i = 0; i < exportClause.childCount; i++) {
        const spec = exportClause.child(i)!;
        if (spec.type === "export_specifier") {
          const nameNode = spec.childForFieldName("name");
          const aliasNode = spec.childForFieldName("alias");
          exports.push({
            name: aliasNode?.text ?? nameNode?.text ?? spec.text,
            alias: aliasNode?.text,
            isDefault: false,
            isReExport: true,
            source,
          });
        }
      }
    } else {
      // export * from './module'
      exports.push({
        name: "*",
        isDefault: false,
        isReExport: true,
        source,
      });
    }
    return;
  }

  // export { foo, bar } (local re-export without source)
  const exportClause = findChild(node, "export_clause");
  if (exportClause) {
    for (let i = 0; i < exportClause.childCount; i++) {
      const spec = exportClause.child(i)!;
      if (spec.type === "export_specifier") {
        const nameNode = spec.childForFieldName("name");
        const aliasNode = spec.childForFieldName("alias");
        exports.push({
          name: aliasNode?.text ?? nameNode?.text ?? spec.text,
          alias: aliasNode?.text,
          isDefault: false,
          isReExport: false,
        });
      }
    }
    return;
  }

  // Exported declaration: export function foo(), export class Bar, etc.
  const declaration = findDeclarationChild(node);
  if (declaration) {
    const sym = extractDeclaration(
      declaration,
      filePath,
      true,
      isDefault,
      root,
      nodeIndex
    );
    if (sym) {
      symbols.push(sym);
      exports.push({
        name: sym.name,
        isDefault,
        isReExport: false,
        symbolId: sym.id,
      });
    }
    return;
  }

  // export default <expression>
  if (isDefault) {
    const expr = findChild(node, "identifier") ??
      findChild(node, "call_expression") ??
      findChild(node, "new_expression");
    if (expr) {
      const name = expr.type === "identifier" ? expr.text : "default";
      exports.push({
        name,
        isDefault: true,
        isReExport: false,
      });
    }
  }
}

// ─── Declaration Extraction ─────────────────────────────────────────────────

function extractDeclaration(
  node: TreeSitterNode,
  filePath: string,
  exported: boolean,
  isDefault: boolean,
  root: TreeSitterNode,
  nodeIndex: number
): Symbol | null {
  const docs = findPrecedingJSDoc(root, nodeIndex);

  switch (node.type) {
    case "function_declaration":
    case "generator_function_declaration":
      return extractFunction(node, filePath, exported, docs);

    case "class_declaration":
    case "abstract_class_declaration":
      return extractClass(node, filePath, exported, docs);

    case "interface_declaration":
      return extractInterface(node, filePath, exported, docs);

    case "type_alias_declaration":
      return extractTypeAlias(node, filePath, exported, docs);

    case "enum_declaration":
      return extractEnum(node, filePath, exported, docs);

    case "lexical_declaration":
      return extractLexicalDeclaration(node, filePath, exported, docs);

    default:
      return null;
  }
}

function extractFunction(
  node: TreeSitterNode,
  filePath: string,
  exported: boolean,
  docs: DocComment | undefined
): Symbol {
  const nameNode = node.childForFieldName("name");
  const name = nameNode?.text ?? "anonymous";
  const isAsync = node.text.startsWith("async ");
  const isGenerator = node.type === "generator_function_declaration" ||
    node.text.includes("function*");
  const params = extractParameters(node);
  const returnType = extractReturnType(node);
  const typeParams = extractTypeParameters(node);
  const sig = buildSignature(node);

  return {
    id: `${filePath}:${name}`,
    name,
    kind: "function",
    visibility: exported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported,
    async: isAsync,
    generator: isGenerator,
    parameters: params,
    returns: returnType ? { type: returnType } : undefined,
    typeParameters: typeParams.length > 0 ? typeParams : undefined,
    docs,
    signature: sig,
  };
}

function extractClass(
  node: TreeSitterNode,
  filePath: string,
  exported: boolean,
  docs: DocComment | undefined
): Symbol {
  const nameNode = node.childForFieldName("name");
  const name = nameNode?.text ?? "anonymous";
  const isAbstract = node.type === "abstract_class_declaration" ||
    node.text.startsWith("abstract ");

  // Heritage: extends and implements
  let extendsClause: string | undefined;
  const implementsList: string[] = [];
  const typeParams = extractTypeParameters(node);

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type === "class_heritage") {
      for (let j = 0; j < child.childCount; j++) {
        const clause = child.child(j)!;
        if (clause.type === "extends_clause") {
          const typeNode = findChild(clause, "identifier") ??
            findChild(clause, "member_expression");
          if (typeNode) extendsClause = typeNode.text;
        }
        if (clause.type === "implements_clause") {
          for (let k = 0; k < clause.childCount; k++) {
            const impl = clause.child(k)!;
            if (impl.isNamed && impl.type !== "implements") {
              implementsList.push(impl.text);
            }
          }
        }
      }
    }
    // Some grammars put extends/implements at the node level
    if (child.type === "extends_clause") {
      const typeNode = findChild(child, "identifier") ??
        findChild(child, "member_expression");
      if (typeNode) extendsClause = typeNode.text;
    }
    if (child.type === "implements_clause") {
      for (let k = 0; k < child.childCount; k++) {
        const impl = child.child(k)!;
        if (impl.isNamed && impl.type !== "implements") {
          implementsList.push(impl.text);
        }
      }
    }
  }

  // Extract class body members
  const children: string[] = [];
  const body = findChild(node, "class_body");
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i)!;
      const memberSym = extractClassMember(member, filePath, name);
      if (memberSym) {
        children.push(memberSym.id);
      }
    }
  }

  return {
    id: `${filePath}:${name}`,
    name,
    kind: "class",
    visibility: exported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported,
    extends: extendsClause,
    implements: implementsList.length > 0 ? implementsList : undefined,
    typeParameters: typeParams.length > 0 ? typeParams : undefined,
    docs,
    children: children.length > 0 ? children : undefined,
  };
}

function extractClassMember(
  node: TreeSitterNode,
  filePath: string,
  className: string
): Symbol | null {
  if (
    node.type === "method_definition" ||
    node.type === "public_field_definition" ||
    node.type === "property_definition"
  ) {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return null;
    const name = nameNode.text;
    const isMethod =
      node.type === "method_definition";

    return {
      id: `${filePath}:${className}.${name}`,
      name,
      kind: isMethod ? "method" : "property",
      visibility: getVisibility(node),
      location: {
        file: filePath,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
      },
      exported: false,
      parentId: `${filePath}:${className}`,
    };
  }
  return null;
}

function extractInterface(
  node: TreeSitterNode,
  filePath: string,
  exported: boolean,
  docs: DocComment | undefined
): Symbol {
  const nameNode = node.childForFieldName("name");
  const name = nameNode?.text ?? "anonymous";
  const typeParams = extractTypeParameters(node);

  // Extract extends
  let extendsClause: string | undefined;
  const extendsNode = findChild(node, "extends_type_clause") ??
    findChild(node, "extends_clause");
  if (extendsNode) {
    const typeNode = findChild(extendsNode, "identifier") ??
      findChild(extendsNode, "type_identifier");
    if (typeNode) extendsClause = typeNode.text;
  }

  return {
    id: `${filePath}:${name}`,
    name,
    kind: "interface",
    visibility: exported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported,
    extends: extendsClause,
    typeParameters: typeParams.length > 0 ? typeParams : undefined,
    docs,
    signature: node.text.split("{")[0]?.trim(),
  };
}

function extractTypeAlias(
  node: TreeSitterNode,
  filePath: string,
  exported: boolean,
  docs: DocComment | undefined
): Symbol {
  const nameNode = node.childForFieldName("name");
  const name = nameNode?.text ?? "anonymous";
  const typeParams = extractTypeParameters(node);
  const valueNode = node.childForFieldName("value");

  return {
    id: `${filePath}:${name}`,
    name,
    kind: "type",
    visibility: exported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported,
    typeAnnotation: valueNode?.text,
    typeParameters: typeParams.length > 0 ? typeParams : undefined,
    docs,
    signature: node.text.replace(/;$/, "").trim(),
  };
}

function extractEnum(
  node: TreeSitterNode,
  filePath: string,
  exported: boolean,
  docs: DocComment | undefined
): Symbol {
  const nameNode = node.childForFieldName("name");
  const name = nameNode?.text ?? "anonymous";

  return {
    id: `${filePath}:${name}`,
    name,
    kind: "enum",
    visibility: exported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported,
    docs,
  };
}

function extractLexicalDeclaration(
  node: TreeSitterNode,
  filePath: string,
  exported: boolean,
  docs: DocComment | undefined
): Symbol | null {
  // Find the first variable declarator
  const declarator = findChild(node, "variable_declarator");
  if (!declarator) return null;

  const nameNode = declarator.childForFieldName("name");
  if (!nameNode) return null;
  const name = nameNode.text;

  // Determine if it's an arrow function or regular constant
  const value = declarator.childForFieldName("value");
  const isArrowFunc = value?.type === "arrow_function";
  const isFuncExpr = value?.type === "function_expression" || value?.type === "function";
  const kind: SymbolKind = isArrowFunc || isFuncExpr ? "function" : "constant";

  let params: ParameterInfo[] | undefined;
  let returnType: string | undefined;
  let isAsync = false;

  if (isArrowFunc && value) {
    isAsync = value.text.startsWith("async ");
    params = extractParameters(value);
    returnType = extractReturnType(value);
  }

  const sig = buildSignature(node);

  return {
    id: `${filePath}:${name}`,
    name,
    kind,
    visibility: exported ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported,
    async: isAsync || undefined,
    parameters: params,
    returns: returnType ? { type: returnType } : undefined,
    docs,
    signature: sig,
  };
}

// ─── Parameter Extraction ───────────────────────────────────────────────────

function extractParameters(node: TreeSitterNode): ParameterInfo[] {
  const params: ParameterInfo[] = [];
  const paramsNode = node.childForFieldName("parameters") ??
    findChild(node, "formal_parameters");

  if (!paramsNode) return params;

  for (let i = 0; i < paramsNode.childCount; i++) {
    const param = paramsNode.child(i)!;
    if (
      param.type === "required_parameter" ||
      param.type === "optional_parameter" ||
      param.type === "rest_parameter"
    ) {
      const patternNode = param.childForFieldName("pattern") ??
        findChild(param, "identifier");
      const typeNode = param.childForFieldName("type") ??
        findChild(param, "type_annotation");
      const defaultNode = param.childForFieldName("value");

      const name = patternNode?.text ?? param.text;
      const isRest = param.type === "rest_parameter";
      const isOptional = param.type === "optional_parameter";

      let typeText: string | undefined;
      if (typeNode) {
        typeText = typeNode.text.replace(/^:\s*/, "");
      }

      params.push({
        name: isRest ? name.replace(/^\.\.\./, "") : name,
        type: typeText,
        optional: isOptional,
        rest: isRest,
        defaultValue: defaultNode?.text,
      });
    } else if (param.type === "identifier") {
      // Simple parameter without type annotation
      params.push({
        name: param.text,
        optional: false,
        rest: false,
      });
    }
  }

  return params;
}

function extractReturnType(node: TreeSitterNode): string | undefined {
  const returnType = node.childForFieldName("return_type") ??
    findChild(node, "type_annotation");

  if (!returnType) return undefined;
  return returnType.text.replace(/^:\s*/, "");
}

function extractTypeParameters(node: TreeSitterNode): string[] {
  const typeParams = findChild(node, "type_parameters");
  if (!typeParams) return [];

  const params: string[] = [];
  for (let i = 0; i < typeParams.childCount; i++) {
    const child = typeParams.child(i)!;
    if (child.type === "type_parameter") {
      params.push(child.text);
    }
  }
  return params;
}

// ─── JSDoc Extraction ───────────────────────────────────────────────────────

function findPrecedingJSDoc(
  root: TreeSitterNode,
  nodeIndex: number
): DocComment | undefined {
  // Look backwards from the current node for a comment node
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = root.child(i);
    if (!prev) break;

    if (prev.type === "comment" && prev.text.startsWith("/**")) {
      return parseJSDoc(prev.text);
    }

    // Stop if we hit a non-comment node
    if (prev.type !== "comment") break;
  }
  return undefined;
}

function extractModuleDoc(root: TreeSitterNode): DocComment | undefined {
  // The first child that's a JSDoc comment is the module doc
  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i)!;
    if (child.type === "comment" && child.text.startsWith("/**")) {
      return parseJSDoc(child.text);
    }
    // Stop at the first non-comment node
    if (child.type !== "comment") break;
  }
  return undefined;
}

function parseJSDoc(raw: string): DocComment {
  const lines = raw
    .split("\n")
    .map((l) =>
      l
        .trim()
        .replace(/^\/\*\*\s?/, "")
        .replace(/\s?\*\/$/, "")
        .replace(/^\*\s?/, "")
    )
    .filter((l) => l !== "");

  const docBlock = lines.join("\n");

  // Separate summary from tag lines
  const summaryLines: string[] = [];
  let hitTag = false;
  for (const line of lines) {
    if (line.startsWith("@")) {
      hitTag = true;
      continue;
    }
    if (!hitTag) summaryLines.push(line);
  }

  const summary = summaryLines[0] || "";
  const description =
    summaryLines.length > 1 ? summaryLines.join("\n") : undefined;

  const params: Record<string, string> = {};
  const paramRegex = /@param\s+(?:\{[^}]+\}\s+)?(\w+)\s*[-–]?\s*(.*)/g;
  let match;
  while ((match = paramRegex.exec(docBlock)) !== null) {
    params[match[1]] = match[2];
  }

  const returnMatch = docBlock.match(/@returns?\s+(.*)/);
  const deprecatedMatch = docBlock.match(/@deprecated\s*(.*)/);
  const sinceMatch = docBlock.match(/@since\s+(.*)/);

  const throwsMatches: string[] = [];
  const throwsRegex = /@throws?\s+(?:\{[^}]+\}\s+)?(.*)/g;
  while ((match = throwsRegex.exec(docBlock)) !== null) {
    throwsMatches.push(match[1]);
  }

  const examples: string[] = [];
  const exampleRegex = /@example\s*([\s\S]*?)(?=@\w|$)/g;
  while ((match = exampleRegex.exec(docBlock)) !== null) {
    examples.push(match[1].trim());
  }

  const tags: Record<string, string> = {};
  const tagRegex = /@(\w+)\s+(.*)/g;
  while ((match = tagRegex.exec(docBlock)) !== null) {
    const tagName = match[1];
    if (
      !["param", "returns", "return", "deprecated", "since", "throws", "example", "see"].includes(
        tagName
      )
    ) {
      tags[tagName] = match[2];
    }
  }

  return {
    summary,
    description,
    params: Object.keys(params).length > 0 ? params : undefined,
    returns: returnMatch?.[1],
    deprecated: deprecatedMatch
      ? deprecatedMatch[1] || true
      : undefined,
    since: sinceMatch?.[1],
    throws: throwsMatches.length > 0 ? throwsMatches : undefined,
    examples: examples.length > 0 ? examples : undefined,
    tags: Object.keys(tags).length > 0 ? tags : undefined,
  };
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

function findDeclarationChild(
  node: TreeSitterNode
): TreeSitterNode | null {
  const declTypes = [
    "function_declaration",
    "generator_function_declaration",
    "class_declaration",
    "abstract_class_declaration",
    "interface_declaration",
    "type_alias_declaration",
    "enum_declaration",
    "lexical_declaration",
  ];

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (declTypes.includes(child.type)) return child;
  }
  return null;
}

function getVisibility(
  node: TreeSitterNode
): "public" | "private" | "protected" {
  const text = node.text;
  if (text.startsWith("private ") || text.includes(" private "))
    return "private";
  if (text.startsWith("protected ") || text.includes(" protected "))
    return "protected";
  return "public";
}

function stripQuotes(s: string): string {
  return s.replace(/^['"]|['"]$/g, "");
}

function buildSignature(node: TreeSitterNode): string {
  const text = node.text;
  // Find the opening brace and cut there
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  // For single-line declarations without braces
  const semiIndex = text.indexOf(";");
  if (semiIndex > 0) {
    return text.slice(0, semiIndex).trim();
  }
  return text.split("\n")[0].trim();
}
