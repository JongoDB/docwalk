import {
  executeHooks
} from "./chunk-W5SRVZUR.js";
import {
  detectLanguage,
  getSupportedExtensions
} from "./chunk-KPWUZIKC.js";
import {
  computeFileHash
} from "./chunk-BAPW5PUT.js";
import {
  log
} from "./chunk-YQ34VMHP.js";

// src/analysis/parsers/tree-sitter-loader.ts
import { createRequire } from "module";
import path from "path";
var require2 = createRequire(import.meta.url);
var GRAMMAR_MAP = {
  typescript: "tree-sitter-typescript.wasm",
  javascript: "tree-sitter-javascript.wasm",
  python: "tree-sitter-python.wasm",
  go: "tree-sitter-go.wasm",
  rust: "tree-sitter-rust.wasm",
  java: "tree-sitter-java.wasm",
  csharp: "tree-sitter-c_sharp.wasm",
  ruby: "tree-sitter-ruby.wasm",
  php: "tree-sitter-php.wasm",
  c: "tree-sitter-c.wasm",
  cpp: "tree-sitter-cpp.wasm",
  swift: "tree-sitter-swift.wasm",
  kotlin: "tree-sitter-kotlin.wasm",
  scala: "tree-sitter-scala.wasm",
  elixir: "tree-sitter-elixir.wasm",
  dart: "tree-sitter-dart.wasm",
  lua: "tree-sitter-lua.wasm",
  zig: "tree-sitter-zig.wasm",
  haskell: "tree-sitter-haskell.wasm"
};
var ParserClass = null;
var initPromise = null;
var languageCache = /* @__PURE__ */ new Map();
var parserCache = /* @__PURE__ */ new Map();
async function ensureInit() {
  if (ParserClass) return ParserClass;
  if (!initPromise) {
    initPromise = (async () => {
      const mod = await import("web-tree-sitter");
      ParserClass = mod.default ?? mod;
      await ParserClass.init();
    })();
  }
  await initPromise;
  return ParserClass;
}
async function initParser(language) {
  if (parserCache.has(language)) {
    return parserCache.get(language);
  }
  const Parser = await ensureInit();
  if (!languageCache.has(language)) {
    const wasmFile = GRAMMAR_MAP[language];
    if (!wasmFile) {
      throw new Error(
        `No tree-sitter grammar available for language: ${language}. Supported languages: ${Object.keys(GRAMMAR_MAP).join(", ")}`
      );
    }
    const wasmDir = path.dirname(require2.resolve("tree-sitter-wasms/package.json"));
    const wasmPath = path.join(wasmDir, "out", wasmFile);
    const lang = await Parser.Language.load(wasmPath);
    languageCache.set(language, lang);
  }
  const parser = new Parser();
  parser.setLanguage(languageCache.get(language));
  parserCache.set(language, parser);
  return parser;
}

// src/analysis/parsers/typescript.ts
var TypeScriptParser = class {
  language = "typescript";
  async parse(content, filePath) {
    const symbols = [];
    const imports = [];
    const exports = [];
    let moduleDoc;
    const parser = await initParser("typescript");
    const tree = parser.parse(content);
    const root = tree.rootNode;
    moduleDoc = extractModuleDoc(root);
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type === "import_statement") {
        const imp = extractImport(node);
        if (imp) imports.push(imp);
        continue;
      }
      if (node.type === "export_statement") {
        processExportStatement(node, filePath, symbols, exports, root, i);
        continue;
      }
      const sym = extractDeclaration(node, filePath, false, false, root, i);
      if (sym) symbols.push(sym);
    }
    return { symbols, imports, exports, moduleDoc };
  }
};
function extractImport(node) {
  const sourceNode = node.childForFieldName("source");
  if (!sourceNode) return null;
  const source = stripQuotes(sourceNode.text);
  const isTypeOnly = node.text.startsWith("import type");
  const clause = findChild(node, "import_clause");
  if (!clause) {
    return { source, specifiers: [], isTypeOnly: false };
  }
  const specifiers = [];
  for (let i = 0; i < clause.childCount; i++) {
    const child = clause.child(i);
    if (child.type === "identifier") {
      specifiers.push({
        name: child.text,
        isDefault: true,
        isNamespace: false
      });
    } else if (child.type === "namespace_import") {
      const alias = findChild(child, "identifier");
      specifiers.push({
        name: "*",
        alias: alias?.text,
        isDefault: false,
        isNamespace: true
      });
    } else if (child.type === "named_imports") {
      for (let j = 0; j < child.childCount; j++) {
        const spec = child.child(j);
        if (spec.type === "import_specifier") {
          const nameNode = spec.childForFieldName("name");
          const aliasNode = spec.childForFieldName("alias");
          specifiers.push({
            name: nameNode?.text ?? spec.text,
            alias: aliasNode?.text,
            isDefault: false,
            isNamespace: false
          });
        }
      }
    }
  }
  return { source, specifiers, isTypeOnly };
}
function processExportStatement(node, filePath, symbols, exports, root, nodeIndex) {
  const isDefault = node.text.includes("export default");
  const sourceNode = node.childForFieldName("source");
  if (sourceNode) {
    const source = stripQuotes(sourceNode.text);
    const exportClause2 = findChild(node, "export_clause");
    if (exportClause2) {
      for (let i = 0; i < exportClause2.childCount; i++) {
        const spec = exportClause2.child(i);
        if (spec.type === "export_specifier") {
          const nameNode = spec.childForFieldName("name");
          const aliasNode = spec.childForFieldName("alias");
          exports.push({
            name: aliasNode?.text ?? nameNode?.text ?? spec.text,
            alias: aliasNode?.text,
            isDefault: false,
            isReExport: true,
            source
          });
        }
      }
    } else {
      exports.push({
        name: "*",
        isDefault: false,
        isReExport: true,
        source
      });
    }
    return;
  }
  const exportClause = findChild(node, "export_clause");
  if (exportClause) {
    for (let i = 0; i < exportClause.childCount; i++) {
      const spec = exportClause.child(i);
      if (spec.type === "export_specifier") {
        const nameNode = spec.childForFieldName("name");
        const aliasNode = spec.childForFieldName("alias");
        exports.push({
          name: aliasNode?.text ?? nameNode?.text ?? spec.text,
          alias: aliasNode?.text,
          isDefault: false,
          isReExport: false
        });
      }
    }
    return;
  }
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
        symbolId: sym.id
      });
    }
    return;
  }
  if (isDefault) {
    const expr = findChild(node, "identifier") ?? findChild(node, "call_expression") ?? findChild(node, "new_expression");
    if (expr) {
      const name = expr.type === "identifier" ? expr.text : "default";
      exports.push({
        name,
        isDefault: true,
        isReExport: false
      });
    }
  }
}
function extractDeclaration(node, filePath, exported, isDefault, root, nodeIndex) {
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
function extractFunction(node, filePath, exported, docs) {
  const nameNode = node.childForFieldName("name");
  const name = nameNode?.text ?? "anonymous";
  const isAsync = node.text.startsWith("async ");
  const isGenerator = node.type === "generator_function_declaration" || node.text.includes("function*");
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
      endColumn: node.endPosition.column
    },
    exported,
    async: isAsync,
    generator: isGenerator,
    parameters: params,
    returns: returnType ? { type: returnType } : void 0,
    typeParameters: typeParams.length > 0 ? typeParams : void 0,
    docs,
    signature: sig
  };
}
function extractClass(node, filePath, exported, docs) {
  const nameNode = node.childForFieldName("name");
  const name = nameNode?.text ?? "anonymous";
  const isAbstract = node.type === "abstract_class_declaration" || node.text.startsWith("abstract ");
  let extendsClause;
  const implementsList = [];
  const typeParams = extractTypeParameters(node);
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "class_heritage") {
      for (let j = 0; j < child.childCount; j++) {
        const clause = child.child(j);
        if (clause.type === "extends_clause") {
          const typeNode = findChild(clause, "identifier") ?? findChild(clause, "member_expression");
          if (typeNode) extendsClause = typeNode.text;
        }
        if (clause.type === "implements_clause") {
          for (let k = 0; k < clause.childCount; k++) {
            const impl = clause.child(k);
            if (impl.isNamed && impl.type !== "implements") {
              implementsList.push(impl.text);
            }
          }
        }
      }
    }
    if (child.type === "extends_clause") {
      const typeNode = findChild(child, "identifier") ?? findChild(child, "member_expression");
      if (typeNode) extendsClause = typeNode.text;
    }
    if (child.type === "implements_clause") {
      for (let k = 0; k < child.childCount; k++) {
        const impl = child.child(k);
        if (impl.isNamed && impl.type !== "implements") {
          implementsList.push(impl.text);
        }
      }
    }
  }
  const children = [];
  const body = findChild(node, "class_body");
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i);
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
      endColumn: node.endPosition.column
    },
    exported,
    extends: extendsClause,
    implements: implementsList.length > 0 ? implementsList : void 0,
    typeParameters: typeParams.length > 0 ? typeParams : void 0,
    docs,
    children: children.length > 0 ? children : void 0
  };
}
function extractClassMember(node, filePath, className) {
  if (node.type === "method_definition" || node.type === "public_field_definition" || node.type === "property_definition") {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return null;
    const name = nameNode.text;
    const isMethod = node.type === "method_definition";
    return {
      id: `${filePath}:${className}.${name}`,
      name,
      kind: isMethod ? "method" : "property",
      visibility: getVisibility(node),
      location: {
        file: filePath,
        line: node.startPosition.row + 1,
        column: node.startPosition.column
      },
      exported: false,
      parentId: `${filePath}:${className}`
    };
  }
  return null;
}
function extractInterface(node, filePath, exported, docs) {
  const nameNode = node.childForFieldName("name");
  const name = nameNode?.text ?? "anonymous";
  const typeParams = extractTypeParameters(node);
  let extendsClause;
  const extendsNode = findChild(node, "extends_type_clause") ?? findChild(node, "extends_clause");
  if (extendsNode) {
    const typeNode = findChild(extendsNode, "identifier") ?? findChild(extendsNode, "type_identifier");
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
      endColumn: node.endPosition.column
    },
    exported,
    extends: extendsClause,
    typeParameters: typeParams.length > 0 ? typeParams : void 0,
    docs,
    signature: node.text.split("{")[0]?.trim()
  };
}
function extractTypeAlias(node, filePath, exported, docs) {
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
      endColumn: node.endPosition.column
    },
    exported,
    typeAnnotation: valueNode?.text,
    typeParameters: typeParams.length > 0 ? typeParams : void 0,
    docs,
    signature: node.text.replace(/;$/, "").trim()
  };
}
function extractEnum(node, filePath, exported, docs) {
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
      endColumn: node.endPosition.column
    },
    exported,
    docs
  };
}
function extractLexicalDeclaration(node, filePath, exported, docs) {
  const declarator = findChild(node, "variable_declarator");
  if (!declarator) return null;
  const nameNode = declarator.childForFieldName("name");
  if (!nameNode) return null;
  const name = nameNode.text;
  const value = declarator.childForFieldName("value");
  const isArrowFunc = value?.type === "arrow_function";
  const isFuncExpr = value?.type === "function_expression" || value?.type === "function";
  const kind = isArrowFunc || isFuncExpr ? "function" : "constant";
  let params;
  let returnType;
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
      endColumn: node.endPosition.column
    },
    exported,
    async: isAsync || void 0,
    parameters: params,
    returns: returnType ? { type: returnType } : void 0,
    docs,
    signature: sig
  };
}
function extractParameters(node) {
  const params = [];
  const paramsNode = node.childForFieldName("parameters") ?? findChild(node, "formal_parameters");
  if (!paramsNode) return params;
  for (let i = 0; i < paramsNode.childCount; i++) {
    const param = paramsNode.child(i);
    if (param.type === "required_parameter" || param.type === "optional_parameter" || param.type === "rest_parameter") {
      const patternNode = param.childForFieldName("pattern") ?? findChild(param, "identifier");
      const typeNode = param.childForFieldName("type") ?? findChild(param, "type_annotation");
      const defaultNode = param.childForFieldName("value");
      const name = patternNode?.text ?? param.text;
      const isRest = param.type === "rest_parameter";
      const isOptional = param.type === "optional_parameter";
      let typeText;
      if (typeNode) {
        typeText = typeNode.text.replace(/^:\s*/, "");
      }
      params.push({
        name: isRest ? name.replace(/^\.\.\./, "") : name,
        type: typeText,
        optional: isOptional,
        rest: isRest,
        defaultValue: defaultNode?.text
      });
    } else if (param.type === "identifier") {
      params.push({
        name: param.text,
        optional: false,
        rest: false
      });
    }
  }
  return params;
}
function extractReturnType(node) {
  const returnType = node.childForFieldName("return_type") ?? findChild(node, "type_annotation");
  if (!returnType) return void 0;
  return returnType.text.replace(/^:\s*/, "");
}
function extractTypeParameters(node) {
  const typeParams = findChild(node, "type_parameters");
  if (!typeParams) return [];
  const params = [];
  for (let i = 0; i < typeParams.childCount; i++) {
    const child = typeParams.child(i);
    if (child.type === "type_parameter") {
      params.push(child.text);
    }
  }
  return params;
}
function findPrecedingJSDoc(root, nodeIndex) {
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = root.child(i);
    if (!prev) break;
    if (prev.type === "comment" && prev.text.startsWith("/**")) {
      return parseJSDoc(prev.text);
    }
    if (prev.type !== "comment") break;
  }
  return void 0;
}
function extractModuleDoc(root) {
  for (let i = 0; i < root.childCount; i++) {
    const child = root.child(i);
    if (child.type === "comment" && child.text.startsWith("/**")) {
      return parseJSDoc(child.text);
    }
    if (child.type !== "comment") break;
  }
  return void 0;
}
function parseJSDoc(raw) {
  const lines = raw.split("\n").map(
    (l) => l.trim().replace(/^\/\*\*\s?/, "").replace(/\s?\*\/$/, "").replace(/^\*\s?/, "")
  ).filter((l) => l !== "");
  const docBlock = lines.join("\n");
  const summaryLines = [];
  let hitTag = false;
  for (const line of lines) {
    if (line.startsWith("@")) {
      hitTag = true;
      continue;
    }
    if (!hitTag) summaryLines.push(line);
  }
  const summary = summaryLines[0] || "";
  const description = summaryLines.length > 1 ? summaryLines.join("\n") : void 0;
  const params = {};
  const paramRegex = /@param\s+(?:\{[^}]+\}\s+)?(\w+)\s*[-–]?\s*(.*)/g;
  let match;
  while ((match = paramRegex.exec(docBlock)) !== null) {
    params[match[1]] = match[2];
  }
  const returnMatch = docBlock.match(/@returns?\s+(.*)/);
  const deprecatedMatch = docBlock.match(/@deprecated\s*(.*)/);
  const sinceMatch = docBlock.match(/@since\s+(.*)/);
  const throwsMatches = [];
  const throwsRegex = /@throws?\s+(?:\{[^}]+\}\s+)?(.*)/g;
  while ((match = throwsRegex.exec(docBlock)) !== null) {
    throwsMatches.push(match[1]);
  }
  const examples = [];
  const exampleRegex = /@example\s*([\s\S]*?)(?=@\w|$)/g;
  while ((match = exampleRegex.exec(docBlock)) !== null) {
    examples.push(match[1].trim());
  }
  const tags = {};
  const tagRegex = /@(\w+)\s+(.*)/g;
  while ((match = tagRegex.exec(docBlock)) !== null) {
    const tagName = match[1];
    if (!["param", "returns", "return", "deprecated", "since", "throws", "example", "see"].includes(
      tagName
    )) {
      tags[tagName] = match[2];
    }
  }
  return {
    summary,
    description,
    params: Object.keys(params).length > 0 ? params : void 0,
    returns: returnMatch?.[1],
    deprecated: deprecatedMatch ? deprecatedMatch[1] || true : void 0,
    since: sinceMatch?.[1],
    throws: throwsMatches.length > 0 ? throwsMatches : void 0,
    examples: examples.length > 0 ? examples : void 0,
    tags: Object.keys(tags).length > 0 ? tags : void 0
  };
}
function findChild(node, type) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === type) return child;
  }
  return null;
}
function findDeclarationChild(node) {
  const declTypes = [
    "function_declaration",
    "generator_function_declaration",
    "class_declaration",
    "abstract_class_declaration",
    "interface_declaration",
    "type_alias_declaration",
    "enum_declaration",
    "lexical_declaration"
  ];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (declTypes.includes(child.type)) return child;
  }
  return null;
}
function getVisibility(node) {
  const text = node.text;
  if (text.startsWith("private ") || text.includes(" private "))
    return "private";
  if (text.startsWith("protected ") || text.includes(" protected "))
    return "protected";
  return "public";
}
function stripQuotes(s) {
  return s.replace(/^['"]|['"]$/g, "");
}
function buildSignature(node) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  const semiIndex = text.indexOf(";");
  if (semiIndex > 0) {
    return text.slice(0, semiIndex).trim();
  }
  return text.split("\n")[0].trim();
}

// src/analysis/parsers/javascript.ts
var JavaScriptParser = class extends TypeScriptParser {
  language = "javascript";
};

// src/analysis/parsers/python.ts
var PythonParser = class {
  language = "python";
  async parse(content, filePath) {
    const symbols = [];
    const imports = [];
    const exports = [];
    let moduleDoc;
    const parser = await initParser("python");
    const tree = parser.parse(content);
    const root = tree.rootNode;
    const allExports = extractAllExports(root);
    moduleDoc = extractModuleDocstring(root);
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type === "import_statement") {
        const imp = extractImport2(node);
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
        const isExported = isPublicName(nameOf(node)) && (allExports === null || allExports.includes(nameOf(node)));
        const sym = extractFunction2(node, filePath, isExported, docstring);
        if (sym) {
          symbols.push(sym);
          if (isExported) {
            exports.push({
              name: sym.name,
              isDefault: false,
              isReExport: false,
              symbolId: sym.id
            });
          }
        }
        continue;
      }
      if (node.type === "class_definition") {
        const docstring = extractDocstring(node);
        const name = nameOf(node);
        const isExported = isPublicName(name) && (allExports === null || allExports.includes(name));
        const sym = extractClass2(node, filePath, isExported, docstring);
        if (sym) {
          symbols.push(sym);
          if (isExported) {
            exports.push({
              name: sym.name,
              isDefault: false,
              isReExport: false,
              symbolId: sym.id
            });
          }
        }
        continue;
      }
      if (node.type === "expression_statement") {
        const assign = findChild2(node, "assignment");
        if (assign) {
          const sym = extractAssignment(assign, filePath, allExports);
          if (sym) {
            symbols.push(sym);
            if (sym.exported) {
              exports.push({
                name: sym.name,
                isDefault: false,
                isReExport: false,
                symbolId: sym.id
              });
            }
          }
        }
      }
    }
    return { symbols, imports, exports, moduleDoc };
  }
};
function extractImport2(node) {
  const names = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "dotted_name") {
      names.push({
        name: child.text,
        isDefault: false,
        isNamespace: false
      });
    } else if (child.type === "aliased_import") {
      const nameNode = findChild2(child, "dotted_name");
      const aliasNode = findChild2(child, "identifier");
      names.push({
        name: nameNode?.text ?? child.text,
        alias: aliasNode?.text,
        isDefault: false,
        isNamespace: false
      });
    }
  }
  if (names.length === 0) return null;
  return {
    source: names[0].name,
    specifiers: names,
    isTypeOnly: false
  };
}
function extractFromImport(node) {
  let source = "";
  const specifiers = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "dotted_name" || child.type === "relative_import") {
      if (!source) source = child.text;
      else {
        specifiers.push({
          name: child.text,
          isDefault: false,
          isNamespace: false
        });
      }
    } else if (child.type === "aliased_import") {
      const nameNode = findChild2(child, "dotted_name") ?? findChild2(child, "identifier");
      const parts = child.text.split(/\s+as\s+/);
      specifiers.push({
        name: nameNode?.text ?? parts[0],
        alias: parts[1],
        isDefault: false,
        isNamespace: false
      });
    } else if (child.type === "wildcard_import") {
      specifiers.push({
        name: "*",
        isDefault: false,
        isNamespace: true
      });
    }
  }
  if (!source) return null;
  return { source, specifiers, isTypeOnly: false };
}
function extractFunction2(node, filePath, exported, docs) {
  const name = nameOf(node);
  if (!name) return null;
  const isAsync = node.text.startsWith("async ");
  const params = extractParameters2(node);
  const returnType = extractReturnType2(node);
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
      endColumn: node.endPosition.column
    },
    exported,
    async: isAsync || void 0,
    parameters: params.length > 0 ? params : void 0,
    returns: returnType ? { type: returnType } : void 0,
    decorators: decorators.length > 0 ? decorators : void 0,
    docs,
    signature: buildSignature2(node)
  };
}
function extractClass2(node, filePath, exported, docs) {
  const name = nameOf(node);
  if (!name) return null;
  const bases = [];
  const argList = findChild2(node, "argument_list");
  if (argList) {
    for (let i = 0; i < argList.childCount; i++) {
      const child = argList.child(i);
      if (child.isNamed) {
        bases.push(child.text);
      }
    }
  }
  const decorators = extractDecorators(node);
  const children = [];
  const body = findChild2(node, "block");
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i);
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
      endColumn: node.endPosition.column
    },
    exported,
    extends: bases[0],
    implements: bases.length > 1 ? bases.slice(1) : void 0,
    decorators: decorators.length > 0 ? decorators : void 0,
    children: children.length > 0 ? children : void 0,
    docs
  };
}
function extractAssignment(node, filePath, allExports) {
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
      column: node.startPosition.column
    },
    exported: isExported
  };
}
function extractDocstring(node) {
  const body = findChild2(node, "block");
  if (!body || body.childCount === 0) return void 0;
  const first = body.child(0);
  if (!first || first.type !== "expression_statement") return void 0;
  const str = findChild2(first, "string");
  if (!str) return void 0;
  return parseDocstring(str.text);
}
function extractModuleDocstring(root) {
  const first = root.child(0);
  if (!first || first.type !== "expression_statement") return void 0;
  const str = findChild2(first, "string");
  if (!str || !str.text.startsWith('"""') && !str.text.startsWith("'''"))
    return void 0;
  return parseDocstring(str.text);
}
function parseDocstring(raw) {
  let content = raw;
  if (content.startsWith('"""') || content.startsWith("'''")) {
    content = content.slice(3, -3);
  } else if (content.startsWith('"') || content.startsWith("'")) {
    content = content.slice(1, -1);
  }
  const lines = content.split("\n").map((l) => l.trim());
  const summary = lines[0] || "";
  const params = {};
  let returns;
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
        params[currentParam] = (params[currentParam] ? params[currentParam] + " " : "") + line.trim();
      }
    }
  }
  const restParamRegex = /:param\s+(\w+):\s*(.*)/g;
  let match;
  while ((match = restParamRegex.exec(content)) !== null) {
    params[match[1]] = match[2];
  }
  const restReturnMatch = content.match(/:returns?:\s*(.*)/);
  if (restReturnMatch) returns = restReturnMatch[1];
  return {
    summary,
    description: lines.length > 1 ? content.trim() : void 0,
    params: Object.keys(params).length > 0 ? params : void 0,
    returns
  };
}
function extractParameters2(node) {
  const params = [];
  const paramsNode = findChild2(node, "parameters");
  if (!paramsNode) return params;
  for (let i = 0; i < paramsNode.childCount; i++) {
    const param = paramsNode.child(i);
    if (param.type === "identifier") {
      if (param.text === "self" || param.text === "cls") continue;
      params.push({ name: param.text, optional: false, rest: false });
    } else if (param.type === "typed_parameter") {
      const nameNode = findChild2(param, "identifier");
      const typeNode = findChild2(param, "type");
      const name = nameNode?.text ?? param.text;
      if (name === "self" || name === "cls") continue;
      params.push({
        name,
        type: typeNode?.text,
        optional: false,
        rest: false
      });
    } else if (param.type === "default_parameter" || param.type === "typed_default_parameter") {
      const nameNode = param.childForFieldName("name") ?? findChild2(param, "identifier");
      const typeNode = findChild2(param, "type");
      const valueNode = param.childForFieldName("value");
      const name = nameNode?.text ?? param.text.split("=")[0].trim().split(":")[0].trim();
      if (name === "self" || name === "cls") continue;
      params.push({
        name,
        type: typeNode?.text,
        defaultValue: valueNode?.text,
        optional: true,
        rest: false
      });
    } else if (param.type === "list_splat_pattern") {
      const nameNode = findChild2(param, "identifier");
      params.push({
        name: nameNode?.text ?? param.text.replace("*", ""),
        optional: true,
        rest: true
      });
    } else if (param.type === "dictionary_splat_pattern") {
      const nameNode = findChild2(param, "identifier");
      params.push({
        name: nameNode?.text ?? param.text.replace("**", ""),
        optional: true,
        rest: true
      });
    }
  }
  return params;
}
function extractReturnType2(node) {
  const returnType = node.childForFieldName("return_type") ?? findChild2(node, "type");
  return returnType?.text;
}
function extractDecorators(node) {
  const decorators = [];
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
function extractAllExports(root) {
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i);
    if (node.type !== "expression_statement") continue;
    const assign = findChild2(node, "assignment");
    if (!assign) continue;
    const left = assign.child(0);
    if (!left || left.text !== "__all__") continue;
    const right = assign.child(assign.childCount - 1);
    if (!right) continue;
    const names = [];
    const listNode = right.type === "list" ? right : findChild2(right, "list");
    if (listNode) {
      for (let j = 0; j < listNode.childCount; j++) {
        const el = listNode.child(j);
        if (el.type === "string") {
          names.push(stripQuotes2(el.text));
        }
      }
    }
    return names;
  }
  return null;
}
function findChild2(node, type) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === type) return child;
  }
  return null;
}
function nameOf(node) {
  const nameNode = node.childForFieldName("name") ?? findChild2(node, "identifier");
  return nameNode?.text ?? "";
}
function isPublicName(name) {
  return !!name && !name.startsWith("_");
}
function stripQuotes2(s) {
  return s.replace(/^['"]|['"]$/g, "");
}
function buildSignature2(node) {
  const text = node.text;
  const colonIndex = text.indexOf(":");
  const firstLine = text.split("\n")[0];
  return firstLine.replace(/:$/, "").trim();
}

// src/analysis/parsers/go.ts
var GoParser = class {
  language = "go";
  async parse(content, filePath) {
    const symbols = [];
    const imports = [];
    const exports = [];
    let moduleDoc;
    const parser = await initParser("go");
    const tree = parser.parse(content);
    const root = tree.rootNode;
    moduleDoc = extractPackageDoc(root);
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type === "import_declaration") {
        const imps = extractImports(node);
        imports.push(...imps);
        continue;
      }
      if (node.type === "function_declaration") {
        const docs = findPrecedingComment(root, i);
        const sym = extractFunction3(node, filePath, docs);
        if (sym) {
          symbols.push(sym);
          if (sym.exported) {
            exports.push({
              name: sym.name,
              isDefault: false,
              isReExport: false,
              symbolId: sym.id
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
              symbolId: sym.id
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
              symbolId: sym.id
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
              symbolId: sym.id
            });
          }
        }
        continue;
      }
    }
    return { symbols, imports, exports, moduleDoc };
  }
};
function extractImports(node) {
  const results = [];
  const specList = findChild3(node, "import_spec_list");
  if (specList) {
    for (let i = 0; i < specList.childCount; i++) {
      const spec = specList.child(i);
      if (spec.type === "import_spec") {
        const imp = parseImportSpec(spec);
        if (imp) results.push(imp);
      }
    }
  } else {
    const spec = findChild3(node, "import_spec");
    if (spec) {
      const imp = parseImportSpec(spec);
      if (imp) results.push(imp);
    }
    const strNode = findChild3(node, "interpreted_string_literal");
    if (strNode && results.length === 0) {
      results.push({
        source: stripQuotes3(strNode.text),
        specifiers: [],
        isTypeOnly: false
      });
    }
  }
  return results;
}
function parseImportSpec(node) {
  let alias;
  let source = "";
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "package_identifier" || child.type === "dot" || child.type === "blank_identifier") {
      alias = child.text;
    }
    if (child.type === "interpreted_string_literal") {
      source = stripQuotes3(child.text);
    }
  }
  if (!source) return null;
  const pkgName = source.split("/").pop() ?? source;
  const specifiers = [
    {
      name: pkgName,
      alias,
      isDefault: false,
      isNamespace: alias === "."
    }
  ];
  return { source, specifiers, isTypeOnly: false };
}
function extractFunction3(node, filePath, docs) {
  const nameNode = node.childForFieldName("name") ?? findChild3(node, "identifier");
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
      endColumn: node.endPosition.column
    },
    exported: isExported,
    parameters: params.length > 0 ? params : void 0,
    returns: returnType ? { type: returnType } : void 0,
    docs,
    signature: buildSignature3(node)
  };
}
function extractMethod(node, filePath, docs) {
  const nameNode = findChild3(node, "field_identifier");
  if (!nameNode) return null;
  const name = nameNode.text;
  const isExported = isUpperFirst(name);
  let receiverType = "";
  const paramLists = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "parameter_list") {
      paramLists.push(child);
    }
  }
  if (paramLists.length >= 1) {
    receiverType = paramLists[0].text.replace(/^\(/, "").replace(/\)$/, "").trim();
    const parts = receiverType.split(/\s+/);
    if (parts.length > 1) receiverType = parts.slice(1).join(" ");
  }
  const params = paramLists.length >= 2 ? extractParamsFromList(paramLists[1]) : [];
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
      endColumn: node.endPosition.column
    },
    exported: isExported,
    parameters: params.length > 0 ? params : void 0,
    returns: returnType ? { type: returnType } : void 0,
    parentId: `${filePath}:${parentName}`,
    typeAnnotation: receiverType,
    docs,
    signature: buildSignature3(node)
  };
}
function extractTypeDeclaration(node, filePath, docs) {
  const results = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "type_spec") {
      const sym = extractTypeSpec(child, filePath, docs);
      if (sym) results.push(sym);
    } else if (child.type === "type_alias") {
      const sym = extractTypeAlias2(child, filePath, docs);
      if (sym) results.push(sym);
    }
  }
  return results;
}
function extractTypeSpec(node, filePath, docs) {
  const nameNode = node.childForFieldName("name") ?? findChild3(node, "type_identifier");
  if (!nameNode) return null;
  const name = nameNode.text;
  const isExported = isUpperFirst(name);
  const typeBody = node.childForFieldName("type");
  let kind = "type";
  if (typeBody) {
    if (typeBody.type === "struct_type") kind = "class";
    else if (typeBody.type === "interface_type") kind = "interface";
  }
  const children = [];
  if (typeBody?.type === "struct_type") {
    const fieldList = findChild3(typeBody, "field_declaration_list");
    if (fieldList) {
      for (let i = 0; i < fieldList.childCount; i++) {
        const field = fieldList.child(i);
        if (field.type === "field_declaration") {
          const fieldName = findChild3(field, "field_identifier");
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
      endColumn: node.endPosition.column
    },
    exported: isExported,
    children: children.length > 0 ? children : void 0,
    docs,
    signature: `type ${name} ${typeBody?.type === "struct_type" ? "struct" : typeBody?.type === "interface_type" ? "interface" : typeBody?.text ?? ""}`.trim()
  };
}
function extractTypeAlias2(node, filePath, docs) {
  const nameNode = findChild3(node, "type_identifier");
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
      column: node.startPosition.column
    },
    exported: isExported,
    docs,
    signature: `type ${node.text}`
  };
}
function extractVarConst(node, filePath, docs) {
  const results = [];
  const isConst = node.type === "const_declaration";
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "const_spec" || child.type === "var_spec") {
      const nameNode = findChild3(child, "identifier");
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
          column: child.startPosition.column
        },
        exported: isExported,
        docs
      });
    }
  }
  return results;
}
function extractParams(node) {
  const paramLists = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "parameter_list") {
      paramLists.push(child);
    }
  }
  if (paramLists.length === 0) return [];
  return extractParamsFromList(paramLists[0]);
}
function extractParamsFromList(node) {
  const params = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "parameter_declaration") {
      const nameNode = findChild3(child, "identifier");
      let typeText = "";
      let foundName = false;
      for (let j = 0; j < child.childCount; j++) {
        const part = child.child(j);
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
          type: typeText || void 0,
          optional: false,
          rest: false
        });
      }
    } else if (child.type === "variadic_parameter_declaration") {
      const nameNode = findChild3(child, "identifier");
      params.push({
        name: nameNode?.text ?? "args",
        optional: true,
        rest: true
      });
    }
  }
  return params;
}
function extractGoReturnType(node) {
  const result = node.childForFieldName("result");
  if (result) return result.text;
  let foundParams = false;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "parameter_list") {
      if (foundParams) {
        return child.text;
      }
      foundParams = true;
      continue;
    }
    if (foundParams && child.type !== "block" && child.isNamed) {
      if (child.type === "type_identifier" || child.type === "pointer_type" || child.type === "slice_type" || child.type === "map_type" || child.type === "qualified_type" || child.type === "interface_type") {
        return child.text;
      }
    }
  }
  return void 0;
}
function findPrecedingComment(root, nodeIndex) {
  const commentLines = [];
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
  if (commentLines.length === 0) return void 0;
  const summary = commentLines[0];
  const description = commentLines.length > 1 ? commentLines.join("\n") : void 0;
  return { summary, description };
}
function extractPackageDoc(root) {
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i);
    if (node.type === "package_clause") {
      return findPrecedingComment(root, i);
    }
  }
  return void 0;
}
function findChild3(node, type) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === type) return child;
  }
  return null;
}
function isUpperFirst(name) {
  if (!name) return false;
  const first = name[0];
  return first === first.toUpperCase() && first !== first.toLowerCase();
}
function stripQuotes3(s) {
  return s.replace(/^["'`]|["'`]$/g, "");
}
function buildSignature3(node) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return text.split("\n")[0].trim();
}

// src/analysis/parsers/rust.ts
var RustParser = class {
  language = "rust";
  async parse(content, filePath) {
    const symbols = [];
    const imports = [];
    const exports = [];
    let moduleDoc;
    const parser = await initParser("rust");
    const tree = parser.parse(content);
    const root = tree.rootNode;
    moduleDoc = extractModuleDoc2(root, content);
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type === "use_declaration") {
        const imp = extractUseDeclaration(node);
        if (imp) {
          imports.push(imp);
          if (isPub(node)) {
            for (const spec of imp.specifiers) {
              exports.push({
                name: spec.alias || spec.name,
                isDefault: false,
                isReExport: true,
                symbolId: `${filePath}:${spec.name}`
              });
            }
          }
        }
        continue;
      }
      if (node.type === "function_item") {
        const docs = findPrecedingDocComment(root, i, content);
        const sym = extractFunction4(node, filePath, docs);
        if (sym) {
          symbols.push(sym);
          if (sym.exported) {
            exports.push({
              name: sym.name,
              isDefault: false,
              isReExport: false,
              symbolId: sym.id
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
              symbolId: sym.id
            });
          }
        }
        continue;
      }
      if (node.type === "enum_item") {
        const docs = findPrecedingDocComment(root, i, content);
        const sym = extractEnum2(node, filePath, docs);
        if (sym) {
          symbols.push(sym);
          if (sym.exported) {
            exports.push({
              name: sym.name,
              isDefault: false,
              isReExport: false,
              symbolId: sym.id
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
              symbolId: sym.id
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
              symbolId: sym.id
            });
          }
        }
        continue;
      }
      if (node.type === "type_item") {
        const docs = findPrecedingDocComment(root, i, content);
        const sym = extractTypeAlias3(node, filePath, docs);
        if (sym) {
          symbols.push(sym);
          if (sym.exported) {
            exports.push({
              name: sym.name,
              isDefault: false,
              isReExport: false,
              symbolId: sym.id
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
              symbolId: sym.id
            });
          }
        }
        continue;
      }
    }
    return { symbols, imports, exports, moduleDoc };
  }
};
function extractUseDeclaration(node) {
  const text = node.text;
  const useMatch = text.match(/^(?:pub\s+)?use\s+(.+);$/s);
  if (!useMatch) return null;
  const usePath = useMatch[1].trim();
  const specifiers = [];
  const baseMatch = usePath.match(/^([^{]+)(?:::?\{([^}]+)\})?$/);
  if (baseMatch) {
    const base = baseMatch[1].replace(/::$/, "");
    if (baseMatch[2]) {
      const items = baseMatch[2].split(",").map((s) => s.trim());
      for (const item of items) {
        const aliasMatch = item.match(/^(\w+)\s+as\s+(\w+)$/);
        if (aliasMatch) {
          specifiers.push({
            name: aliasMatch[1],
            alias: aliasMatch[2],
            isDefault: false,
            isNamespace: false
          });
        } else if (item === "self") {
          specifiers.push({
            name: base.split("::").pop() || base,
            isDefault: false,
            isNamespace: false
          });
        } else if (item === "*") {
          specifiers.push({
            name: "*",
            isDefault: false,
            isNamespace: true
          });
        } else {
          specifiers.push({
            name: item,
            isDefault: false,
            isNamespace: false
          });
        }
      }
    } else {
      const parts = base.split("::");
      const last = parts[parts.length - 1];
      specifiers.push({
        name: last,
        isDefault: false,
        isNamespace: last === "*"
      });
    }
    return {
      source: baseMatch[2] ? baseMatch[1].replace(/::$/, "") : usePath.split("::").slice(0, -1).join("::"),
      specifiers,
      isTypeOnly: false
    };
  }
  return {
    source: usePath,
    specifiers: [],
    isTypeOnly: false
  };
}
function extractFunction4(node, filePath, docs) {
  const nameNode = findChild4(node, "identifier");
  if (!nameNode) return null;
  const name = nameNode.text;
  const isExported = isPub(node);
  const params = extractParams2(node);
  const returnType = extractReturnType3(node);
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
      endColumn: node.endPosition.column
    },
    exported: isExported,
    parameters: params.length > 0 ? params : void 0,
    returns: returnType ? { type: returnType } : void 0,
    async: isAsync,
    docs,
    signature: buildSignature4(node)
  };
}
function extractStruct(node, filePath, docs) {
  const nameNode = findChild4(node, "type_identifier");
  if (!nameNode) return null;
  const name = nameNode.text;
  const isExported = isPub(node);
  const children = [];
  const fieldList = findChild4(node, "field_declaration_list");
  if (fieldList) {
    for (let i = 0; i < fieldList.childCount; i++) {
      const field = fieldList.child(i);
      if (field.type === "field_declaration") {
        const fieldName = findChild4(field, "field_identifier");
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
      endColumn: node.endPosition.column
    },
    exported: isExported,
    children: children.length > 0 ? children : void 0,
    docs,
    signature: `struct ${name}`
  };
}
function extractEnum2(node, filePath, docs) {
  const nameNode = findChild4(node, "type_identifier");
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
      endColumn: node.endPosition.column
    },
    exported: isExported,
    docs,
    signature: `enum ${name}`
  };
}
function extractTrait(node, filePath, docs) {
  const nameNode = findChild4(node, "type_identifier");
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
      endColumn: node.endPosition.column
    },
    exported: isExported,
    docs,
    signature: `trait ${name}`
  };
}
function extractImplMethods(node, filePath, content) {
  const results = [];
  const typeNode = findChild4(node, "type_identifier");
  const typeName = typeNode?.text || "Unknown";
  const body = findChild4(node, "declaration_list");
  if (!body) return results;
  for (let i = 0; i < body.childCount; i++) {
    const child = body.child(i);
    if (child.type === "function_item") {
      const docs = findPrecedingDocCommentInner(body, i, content);
      const nameNode = findChild4(child, "identifier");
      if (!nameNode) continue;
      const name = nameNode.text;
      const isExported = isPub(child);
      const params = extractParams2(child);
      const returnType = extractReturnType3(child);
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
          endColumn: child.endPosition.column
        },
        exported: isExported,
        parameters: params.length > 0 ? params : void 0,
        returns: returnType ? { type: returnType } : void 0,
        parentId: `${filePath}:${typeName}`,
        docs,
        signature: buildSignature4(child)
      });
    }
  }
  return results;
}
function extractTypeAlias3(node, filePath, docs) {
  const nameNode = findChild4(node, "type_identifier");
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
      column: node.startPosition.column
    },
    exported: isExported,
    docs,
    signature: `type ${name}`
  };
}
function extractConstStatic(node, filePath, docs) {
  const nameNode = findChild4(node, "identifier");
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
      column: node.startPosition.column
    },
    exported: isExported,
    docs,
    signature: isConst ? `const ${name}` : `static ${name}`
  };
}
function extractParams2(node) {
  const params = [];
  const paramList = findChild4(node, "parameters");
  if (!paramList) return params;
  for (let i = 0; i < paramList.childCount; i++) {
    const child = paramList.child(i);
    if (child.type === "parameter") {
      const pattern = findChild4(child, "identifier");
      if (pattern && pattern.text !== "self") {
        const typeNode = child.childForFieldName("type");
        params.push({
          name: pattern.text,
          type: typeNode?.text || void 0,
          optional: false,
          rest: false
        });
      }
    } else if (child.type === "self_parameter") {
    }
  }
  return params;
}
function extractReturnType3(node) {
  const text = node.text;
  const arrowMatch = text.match(/->\s*([^{]+)/);
  if (arrowMatch) {
    return arrowMatch[1].trim();
  }
  return void 0;
}
function extractModuleDoc2(root, content) {
  const lines = content.split("\n");
  const docLines = [];
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
  if (docLines.length === 0) return void 0;
  return {
    summary: docLines[0],
    description: docLines.length > 1 ? docLines.join("\n") : void 0
  };
}
function findPrecedingDocComment(root, nodeIndex, content) {
  const docLines = [];
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = root.child(i);
    if (!prev) break;
    if (prev.type === "line_comment" || prev.type === "block_comment") {
      const text = prev.text;
      if (text.startsWith("///")) {
        docLines.unshift(text.replace(/^\/\/\/\s?/, ""));
      } else if (text.startsWith("/**")) {
        const cleaned = text.replace(/^\/\*\*\s*/, "").replace(/\s*\*\/$/, "").split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trim()).filter(Boolean);
        docLines.unshift(...cleaned);
      } else {
        break;
      }
    } else if (prev.type === "attribute_item") {
      continue;
    } else {
      break;
    }
  }
  if (docLines.length === 0) return void 0;
  return {
    summary: docLines[0],
    description: docLines.length > 1 ? docLines.join("\n") : void 0
  };
}
function findPrecedingDocCommentInner(parent, nodeIndex, content) {
  const docLines = [];
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
  if (docLines.length === 0) return void 0;
  return {
    summary: docLines[0],
    description: docLines.length > 1 ? docLines.join("\n") : void 0
  };
}
function findChild4(node, type) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === type) return child;
  }
  return null;
}
function isPub(node) {
  const text = node.text;
  return text.startsWith("pub ") || text.startsWith("pub(");
}
function buildSignature4(node) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return text.split("\n")[0].trim();
}

// src/analysis/parsers/java.ts
var JavaParser = class {
  language = "java";
  async parse(content, filePath) {
    const symbols = [];
    const imports = [];
    const exports = [];
    let moduleDoc;
    const parser = await initParser("java");
    const tree = parser.parse(content);
    const root = tree.rootNode;
    moduleDoc = extractPackageDoc2(root, content);
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type === "import_declaration") {
        const imp = extractImport3(node);
        if (imp) imports.push(imp);
        continue;
      }
      if (node.type === "class_declaration" || node.type === "interface_declaration" || node.type === "enum_declaration" || node.type === "record_declaration") {
        const docs = findPrecedingJavadoc(root, i, content);
        const syms = extractTypeDeclaration2(node, filePath, docs, content);
        for (const sym of syms) {
          symbols.push(sym);
          if (sym.exported) {
            exports.push({
              name: sym.name,
              isDefault: false,
              isReExport: false,
              symbolId: sym.id
            });
          }
        }
        continue;
      }
    }
    return { symbols, imports, exports, moduleDoc };
  }
};
function extractImport3(node) {
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
      isNamespace: lastName === "*"
    }],
    isTypeOnly: !isStatic
  };
}
function extractTypeDeclaration2(node, filePath, docs, content) {
  const results = [];
  const nameNode = findChild5(node, "identifier");
  if (!nameNode) return results;
  const name = nameNode.text;
  const isPublic = hasModifier(node, "public");
  let kind = "class";
  if (node.type === "interface_declaration") kind = "interface";
  else if (node.type === "enum_declaration") kind = "enum";
  else if (node.type === "record_declaration") kind = "class";
  let extendsName;
  const implementsList = [];
  const superclass = findChild5(node, "superclass");
  if (superclass) {
    const typeNode = findChild5(superclass, "type_identifier");
    extendsName = typeNode?.text;
  }
  const interfaces = findChild5(node, "super_interfaces");
  if (interfaces) {
    const typeList = findChild5(interfaces, "type_list");
    if (typeList) {
      for (let i = 0; i < typeList.childCount; i++) {
        const child = typeList.child(i);
        if (child.type === "type_identifier") {
          implementsList.push(child.text);
        }
      }
    }
  }
  const children = [];
  const body = findChild5(node, "class_body") || findChild5(node, "interface_body") || findChild5(node, "enum_body");
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i);
      if (member.type === "method_declaration" || member.type === "constructor_declaration") {
        const memberDocs = findPrecedingJavadocInner(body, i, content);
        const memberName = findChild5(member, "identifier");
        if (!memberName) continue;
        const mName = memberName.text;
        const mIsPublic = hasModifier(member, "public");
        const params = extractMethodParams(member);
        const returnType = extractMethodReturnType(member);
        const methodSym = {
          id: `${filePath}:${name}.${mName}`,
          name: mName,
          kind: member.type === "constructor_declaration" ? "method" : "method",
          visibility: mIsPublic ? "public" : hasModifier(member, "protected") ? "protected" : "private",
          location: {
            file: filePath,
            line: member.startPosition.row + 1,
            column: member.startPosition.column,
            endLine: member.endPosition.row + 1,
            endColumn: member.endPosition.column
          },
          exported: mIsPublic,
          parameters: params.length > 0 ? params : void 0,
          returns: returnType ? { type: returnType } : void 0,
          parentId: `${filePath}:${name}`,
          docs: memberDocs,
          signature: buildSignature5(member)
        };
        results.push(methodSym);
        children.push(methodSym.id);
      }
      if (member.type === "field_declaration") {
        const fieldName = findChild5(member, "variable_declarator");
        if (fieldName) {
          const fName = findChild5(fieldName, "identifier");
          if (fName) {
            children.push(`${filePath}:${name}.${fName.text}`);
          }
        }
      }
    }
  }
  const typeSym = {
    id: `${filePath}:${name}`,
    name,
    kind,
    visibility: isPublic ? "public" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: isPublic,
    extends: extendsName,
    implements: implementsList.length > 0 ? implementsList : void 0,
    children: children.length > 0 ? children : void 0,
    docs,
    signature: buildTypeSignature(node, name, kind)
  };
  results.unshift(typeSym);
  return results;
}
function extractMethodParams(node) {
  const params = [];
  const formalParams = findChild5(node, "formal_parameters");
  if (!formalParams) return params;
  for (let i = 0; i < formalParams.childCount; i++) {
    const child = formalParams.child(i);
    if (child.type === "formal_parameter" || child.type === "spread_parameter") {
      const nameNode = findChild5(child, "identifier");
      const typeNode = child.childCount > 0 ? child.child(0) : null;
      let typeName = "";
      for (let j = 0; j < child.childCount; j++) {
        const part = child.child(j);
        if (part.type === "identifier") break;
        if (part.isNamed) typeName = part.text;
      }
      if (nameNode) {
        params.push({
          name: nameNode.text,
          type: typeName || void 0,
          optional: false,
          rest: child.type === "spread_parameter"
        });
      }
    }
  }
  return params;
}
function extractMethodReturnType(node) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "identifier" || child.type === "formal_parameters") break;
    if (child.type === "void_type" || child.type === "type_identifier" || child.type === "generic_type" || child.type === "array_type" || child.type === "integral_type" || child.type === "floating_point_type" || child.type === "boolean_type") {
      return child.text;
    }
  }
  return void 0;
}
function extractPackageDoc2(root, content) {
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i);
    if (node.type === "package_declaration") {
      return findPrecedingJavadoc(root, i, content);
    }
  }
  return void 0;
}
function findPrecedingJavadoc(root, nodeIndex, content) {
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
  return void 0;
}
function findPrecedingJavadocInner(parent, nodeIndex, content) {
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
  return void 0;
}
function parseJavadoc(text) {
  if (!text.startsWith("/**")) return void 0;
  const lines = text.replace(/^\/\*\*\s*/, "").replace(/\s*\*\/$/, "").split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trim()).filter(Boolean);
  if (lines.length === 0) return void 0;
  const descLines = [];
  const params = {};
  let returns;
  let deprecated;
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
  const description = descLines.length > 1 ? descLines.join("\n") : void 0;
  return {
    summary,
    description,
    params: Object.keys(params).length > 0 ? params : void 0,
    returns,
    deprecated
  };
}
function findChild5(node, type) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === type) return child;
  }
  return null;
}
function hasModifier(node, modifier) {
  const modifiers = findChild5(node, "modifiers");
  if (modifiers) {
    return modifiers.text.includes(modifier);
  }
  const text = node.text;
  const firstLine = text.split("\n")[0];
  return firstLine.includes(modifier);
}
function buildSignature5(node) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return text.split("\n")[0].trim();
}
function buildTypeSignature(node, name, kind) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return `${kind} ${name}`;
}

// src/analysis/parsers/csharp.ts
var CSharpParser = class {
  language = "csharp";
  async parse(content, filePath) {
    const symbols = [];
    const imports = [];
    const exports = [];
    let moduleDoc;
    const parser = await initParser("csharp");
    const tree = parser.parse(content);
    const root = tree.rootNode;
    this.walkNode(root, filePath, content, symbols, imports, exports);
    moduleDoc = extractFileDoc(content);
    return { symbols, imports, exports, moduleDoc };
  }
  walkNode(node, filePath, content, symbols, imports, exports) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "using_directive") {
        const imp = extractUsing(child);
        if (imp) imports.push(imp);
        continue;
      }
      if (child.type === "namespace_declaration" || child.type === "file_scoped_namespace_declaration") {
        const body = findChild6(child, "declaration_list");
        if (body) {
          this.walkNode(body, filePath, content, symbols, imports, exports);
        }
        continue;
      }
      if (child.type === "class_declaration" || child.type === "interface_declaration" || child.type === "struct_declaration" || child.type === "enum_declaration" || child.type === "record_declaration") {
        const docs = findPrecedingXmlDoc(node, i, content);
        const syms = extractTypeDeclaration3(child, filePath, docs, content);
        for (const sym of syms) {
          symbols.push(sym);
          if (sym.exported) {
            exports.push({
              name: sym.name,
              isDefault: false,
              isReExport: false,
              symbolId: sym.id
            });
          }
        }
        continue;
      }
    }
  }
};
function extractUsing(node) {
  const text = node.text;
  const match = text.match(/using\s+(?:static\s+)?([\w.]+)\s*;/);
  if (!match) return null;
  const source = match[1];
  const parts = source.split(".");
  const lastName = parts[parts.length - 1];
  return {
    source,
    specifiers: [{
      name: lastName,
      isDefault: false,
      isNamespace: !text.includes("static")
    }],
    isTypeOnly: !text.includes("static")
  };
}
function extractTypeDeclaration3(node, filePath, docs, content) {
  const results = [];
  const nameNode = findChild6(node, "identifier");
  if (!nameNode) return results;
  const name = nameNode.text;
  const isPublic = hasModifier2(node, "public");
  const isInternal = hasModifier2(node, "internal");
  let kind = "class";
  if (node.type === "interface_declaration") kind = "interface";
  else if (node.type === "struct_declaration") kind = "class";
  else if (node.type === "enum_declaration") kind = "enum";
  else if (node.type === "record_declaration") kind = "class";
  const baseList = findChild6(node, "base_list");
  let extendsName;
  const implementsList = [];
  if (baseList) {
    for (let i = 0; i < baseList.childCount; i++) {
      const child = baseList.child(i);
      if (child.isNamed) {
        const typeName = child.text;
        if (!extendsName && kind === "class") {
          extendsName = typeName;
        } else {
          implementsList.push(typeName);
        }
      }
    }
  }
  const children = [];
  const body = findChild6(node, "declaration_list");
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i);
      if (member.type === "method_declaration" || member.type === "constructor_declaration") {
        const memberDocs = findPrecedingXmlDocInner(body, i, content);
        const memberName = findChild6(member, "identifier");
        if (!memberName) continue;
        const mName = memberName.text;
        const mIsPublic = hasModifier2(member, "public");
        const params = extractMethodParams2(member);
        const returnType = extractReturnType4(member);
        const methodSym = {
          id: `${filePath}:${name}.${mName}`,
          name: mName,
          kind: "method",
          visibility: mIsPublic ? "public" : hasModifier2(member, "protected") ? "protected" : hasModifier2(member, "internal") ? "internal" : "private",
          location: {
            file: filePath,
            line: member.startPosition.row + 1,
            column: member.startPosition.column,
            endLine: member.endPosition.row + 1,
            endColumn: member.endPosition.column
          },
          exported: mIsPublic || hasModifier2(member, "internal"),
          parameters: params.length > 0 ? params : void 0,
          returns: returnType ? { type: returnType } : void 0,
          parentId: `${filePath}:${name}`,
          docs: memberDocs,
          signature: buildSignature6(member)
        };
        results.push(methodSym);
        children.push(methodSym.id);
      }
      if (member.type === "property_declaration") {
        const memberDocs = findPrecedingXmlDocInner(body, i, content);
        const propName = findChild6(member, "identifier");
        if (propName) {
          const mIsPublic = hasModifier2(member, "public");
          const propSym = {
            id: `${filePath}:${name}.${propName.text}`,
            name: propName.text,
            kind: "property",
            visibility: mIsPublic ? "public" : "private",
            location: {
              file: filePath,
              line: member.startPosition.row + 1,
              column: member.startPosition.column
            },
            exported: mIsPublic,
            parentId: `${filePath}:${name}`,
            docs: memberDocs,
            signature: buildSignature6(member)
          };
          results.push(propSym);
          children.push(propSym.id);
        }
      }
    }
  }
  const typeSym = {
    id: `${filePath}:${name}`,
    name,
    kind,
    visibility: isPublic ? "public" : isInternal ? "internal" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: isPublic || isInternal,
    extends: extendsName,
    implements: implementsList.length > 0 ? implementsList : void 0,
    children: children.length > 0 ? children : void 0,
    docs,
    signature: buildTypeSignature2(node, name, kind)
  };
  results.unshift(typeSym);
  return results;
}
function extractMethodParams2(node) {
  const params = [];
  const paramList = findChild6(node, "parameter_list");
  if (!paramList) return params;
  for (let i = 0; i < paramList.childCount; i++) {
    const child = paramList.child(i);
    if (child.type === "parameter") {
      const nameNode = findChild6(child, "identifier");
      let typeName = "";
      for (let j = 0; j < child.childCount; j++) {
        const part = child.child(j);
        if (part.type === "identifier") break;
        if (part.isNamed && part.type !== "modifier") typeName = part.text;
      }
      if (nameNode) {
        params.push({
          name: nameNode.text,
          type: typeName || void 0,
          optional: child.text.includes("="),
          rest: child.text.startsWith("params")
        });
      }
    }
  }
  return params;
}
function extractReturnType4(node) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === "identifier" || child.type === "parameter_list") break;
    if (child.type === "predefined_type" || child.type === "identifier" || child.type === "generic_name" || child.type === "nullable_type" || child.type === "array_type" || child.type === "void_keyword") {
      return child.text;
    }
  }
  return void 0;
}
function extractFileDoc(content) {
  const lines = content.split("\n");
  const docLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("///")) {
      const xmlContent = trimmed.replace(/^\/\/\/\s?/, "");
      docLines.push(xmlContent);
    } else if (trimmed === "" && docLines.length === 0) {
      continue;
    } else {
      break;
    }
  }
  return parseXmlDocLines(docLines);
}
function findPrecedingXmlDoc(root, nodeIndex, content) {
  const docLines = [];
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = root.child(i);
    if (!prev) break;
    if (prev.type === "comment") {
      const text = prev.text.trim();
      if (text.startsWith("///")) {
        docLines.unshift(text.replace(/^\/\/\/\s?/, ""));
      } else {
        break;
      }
    } else if (prev.type === "attribute_list") {
      continue;
    } else {
      break;
    }
  }
  return parseXmlDocLines(docLines);
}
function findPrecedingXmlDocInner(parent, nodeIndex, content) {
  const docLines = [];
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = parent.child(i);
    if (!prev) break;
    if (prev.type === "comment") {
      const text = prev.text.trim();
      if (text.startsWith("///")) {
        docLines.unshift(text.replace(/^\/\/\/\s?/, ""));
      } else {
        break;
      }
    } else if (prev.type === "attribute_list") {
      continue;
    } else {
      break;
    }
  }
  return parseXmlDocLines(docLines);
}
function parseXmlDocLines(lines) {
  if (lines.length === 0) return void 0;
  const fullText = lines.join("\n");
  const summaryMatch = fullText.match(/<summary>\s*([\s\S]*?)\s*<\/summary>/);
  const summary = summaryMatch ? summaryMatch[1].replace(/\s+/g, " ").trim() : lines[0].replace(/<[^>]+>/g, "").trim();
  if (!summary) return void 0;
  const params = {};
  const paramRegex = /<param\s+name="(\w+)">(.*?)<\/param>/g;
  let match;
  while ((match = paramRegex.exec(fullText)) !== null) {
    params[match[1]] = match[2].trim();
  }
  const returnsMatch = fullText.match(/<returns>(.*?)<\/returns>/);
  const returns = returnsMatch ? returnsMatch[1].trim() : void 0;
  return {
    summary,
    description: lines.length > 1 ? fullText.replace(/<[^>]+>/g, "").trim() : void 0,
    params: Object.keys(params).length > 0 ? params : void 0,
    returns
  };
}
function findChild6(node, type) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === type) return child;
  }
  return null;
}
function hasModifier2(node, modifier) {
  const text = node.text;
  const firstLine = text.split("{")[0] || text.split("\n")[0];
  return new RegExp(`\\b${modifier}\\b`).test(firstLine);
}
function buildSignature6(node) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return text.split("\n")[0].trim();
}
function buildTypeSignature2(node, name, kind) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return `${kind} ${name}`;
}

// src/analysis/parsers/ruby.ts
var RubyParser = class {
  language = "ruby";
  async parse(content, filePath) {
    const symbols = [];
    const imports = [];
    const exports = [];
    let moduleDoc;
    const parser = await initParser("ruby");
    const tree = parser.parse(content);
    const root = tree.rootNode;
    const privateMethodNames = /* @__PURE__ */ new Set();
    const protectedMethodNames = /* @__PURE__ */ new Set();
    extractVisibilityBlocks(root, content, privateMethodNames, protectedMethodNames);
    moduleDoc = findFirstDocComment(root, content);
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type === "call" || node.type === "command") {
        const imp = extractRequire(node);
        if (imp) {
          imports.push(imp);
          continue;
        }
      }
      if (node.type === "class") {
        const docs = findPrecedingComment2(root, i, content);
        const syms = extractClass3(node, filePath, docs, content, privateMethodNames, protectedMethodNames);
        for (const sym of syms) {
          symbols.push(sym);
          if (sym.exported) {
            exports.push({
              name: sym.name,
              isDefault: false,
              isReExport: false,
              symbolId: sym.id
            });
          }
        }
        continue;
      }
      if (node.type === "module") {
        const docs = findPrecedingComment2(root, i, content);
        const sym = extractModule(node, filePath, docs);
        if (sym) {
          symbols.push(sym);
          exports.push({
            name: sym.name,
            isDefault: false,
            isReExport: false,
            symbolId: sym.id
          });
        }
        continue;
      }
      if (node.type === "method") {
        const docs = findPrecedingComment2(root, i, content);
        const sym = extractMethod2(node, filePath, docs, privateMethodNames, protectedMethodNames);
        if (sym) {
          symbols.push(sym);
          if (sym.exported) {
            exports.push({
              name: sym.name,
              isDefault: false,
              isReExport: false,
              symbolId: sym.id
            });
          }
        }
        continue;
      }
      if (node.type === "assignment") {
        const sym = extractConstant(node, filePath);
        if (sym) {
          symbols.push(sym);
          exports.push({
            name: sym.name,
            isDefault: false,
            isReExport: false,
            symbolId: sym.id
          });
        }
        continue;
      }
    }
    return { symbols, imports, exports, moduleDoc };
  }
};
function extractRequire(node) {
  const text = node.text;
  const match = text.match(/^(require|require_relative)\s+["']([^"']+)["']/);
  if (!match) return null;
  return {
    source: match[2],
    specifiers: [{
      name: match[2].split("/").pop() || match[2],
      isDefault: true,
      isNamespace: false
    }],
    isTypeOnly: false
  };
}
function extractClass3(node, filePath, docs, content, privateMethodNames, protectedMethodNames) {
  const results = [];
  const nameNode = findChild7(node, "constant") || findChild7(node, "scope_resolution");
  if (!nameNode) return results;
  const name = nameNode.text;
  const superclass = findChild7(node, "superclass");
  const extendsName = superclass ? superclass.text.replace(/^<\s*/, "") : void 0;
  const children = [];
  const body = findChild7(node, "body_statement");
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i);
      if (member.type === "method") {
        const memberDocs = findPrecedingComment2(body, i, content);
        const sym = extractMethod2(member, filePath, memberDocs, privateMethodNames, protectedMethodNames, name);
        if (sym) {
          results.push(sym);
          children.push(sym.id);
        }
      }
    }
  }
  const classSym = {
    id: `${filePath}:${name}`,
    name,
    kind: "class",
    visibility: "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: true,
    extends: extendsName,
    children: children.length > 0 ? children : void 0,
    docs,
    signature: `class ${name}${extendsName ? ` < ${extendsName}` : ""}`
  };
  results.unshift(classSym);
  return results;
}
function extractModule(node, filePath, docs) {
  const nameNode = findChild7(node, "constant") || findChild7(node, "scope_resolution");
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
      endColumn: node.endPosition.column
    },
    exported: true,
    docs,
    signature: `module ${name}`
  };
}
function extractMethod2(node, filePath, docs, privateMethodNames, protectedMethodNames, parentName) {
  const nameNode = findChild7(node, "identifier");
  if (!nameNode) return null;
  const name = nameNode.text;
  const isPrivate = privateMethodNames.has(name);
  const isProtected = protectedMethodNames.has(name);
  const visibility = isPrivate ? "private" : isProtected ? "protected" : "public";
  const params = extractParams3(node);
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
      endColumn: node.endPosition.column
    },
    exported: !isPrivate,
    parameters: params.length > 0 ? params : void 0,
    parentId: parentName ? `${filePath}:${parentName}` : void 0,
    docs,
    signature: buildSignature7(node)
  };
}
function extractConstant(node, filePath) {
  const text = node.text;
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
      column: node.startPosition.column
    },
    exported: true
  };
}
function extractParams3(node) {
  const params = [];
  const paramList = findChild7(node, "method_parameters");
  if (!paramList) return params;
  for (let i = 0; i < paramList.childCount; i++) {
    const child = paramList.child(i);
    if (child.type === "identifier") {
      params.push({
        name: child.text,
        optional: false,
        rest: false
      });
    } else if (child.type === "optional_parameter") {
      const nameNode = findChild7(child, "identifier");
      if (nameNode) {
        params.push({
          name: nameNode.text,
          optional: true,
          rest: false
        });
      }
    } else if (child.type === "splat_parameter") {
      const nameNode = findChild7(child, "identifier");
      params.push({
        name: nameNode?.text ?? "args",
        optional: true,
        rest: true
      });
    } else if (child.type === "keyword_parameter") {
      const nameNode = findChild7(child, "identifier");
      if (nameNode) {
        params.push({
          name: nameNode.text,
          optional: true,
          rest: false
        });
      }
    }
  }
  return params;
}
function extractVisibilityBlocks(root, content, privateNames, protectedNames) {
  const lines = content.split("\n");
  let currentVisibility = "public";
  let inBody = false;
  for (const line of lines) {
    const trimmed = line.trim();
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
function findFirstDocComment(root, content) {
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i);
    if (node.type === "comment") {
      const text = node.text.replace(/^#\s?/, "").trim();
      if (text) {
        return { summary: text };
      }
    } else if (node.type !== "call" && node.type !== "command") {
      break;
    }
  }
  return void 0;
}
function findPrecedingComment2(root, nodeIndex, content) {
  const commentLines = [];
  const params = {};
  let returns;
  for (let i = nodeIndex - 1; i >= 0; i--) {
    const prev = root.child(i);
    if (!prev) break;
    if (prev.type === "comment") {
      const text = prev.text.replace(/^#\s?/, "").trim();
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
  if (commentLines.length === 0 && Object.keys(params).length === 0) return void 0;
  return {
    summary: commentLines[0] || "",
    description: commentLines.length > 1 ? commentLines.join("\n") : void 0,
    params: Object.keys(params).length > 0 ? params : void 0,
    returns
  };
}
function findChild7(node, type) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === type) return child;
  }
  return null;
}
function buildSignature7(node) {
  const text = node.text;
  const lines = text.split("\n");
  return lines[0].trim();
}

// src/analysis/parsers/php.ts
var PhpParser = class {
  language = "php";
  async parse(content, filePath) {
    const symbols = [];
    const imports = [];
    const exports = [];
    let moduleDoc;
    const parser = await initParser("php");
    const tree = parser.parse(content);
    const root = tree.rootNode;
    const program = root.type === "program" ? root : root;
    moduleDoc = findFileDoc(program, content);
    this.walkNode(program, filePath, content, symbols, imports, exports);
    return { symbols, imports, exports, moduleDoc };
  }
  walkNode(node, filePath, content, symbols, imports, exports) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "namespace_use_declaration") {
        const imps = extractUseDeclaration2(child);
        imports.push(...imps);
        continue;
      }
      if (child.type === "namespace_definition") {
        const body = findChild8(child, "compound_statement") || findChild8(child, "declaration_list");
        if (body) {
          this.walkNode(body, filePath, content, symbols, imports, exports);
        }
        continue;
      }
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
              symbolId: sym.id
            });
          }
        }
        continue;
      }
      if (child.type === "interface_declaration") {
        const docs = findPrecedingPhpDoc(node, i, content);
        const sym = extractInterfaceOrTrait(child, filePath, docs, "interface");
        if (sym) {
          symbols.push(sym);
          exports.push({
            name: sym.name,
            isDefault: false,
            isReExport: false,
            symbolId: sym.id
          });
        }
        continue;
      }
      if (child.type === "trait_declaration") {
        const docs = findPrecedingPhpDoc(node, i, content);
        const sym = extractInterfaceOrTrait(child, filePath, docs, "class");
        if (sym) {
          symbols.push(sym);
          exports.push({
            name: sym.name,
            isDefault: false,
            isReExport: false,
            symbolId: sym.id
          });
        }
        continue;
      }
      if (child.type === "enum_declaration") {
        const docs = findPrecedingPhpDoc(node, i, content);
        const sym = extractInterfaceOrTrait(child, filePath, docs, "enum");
        if (sym) {
          symbols.push(sym);
          exports.push({
            name: sym.name,
            isDefault: false,
            isReExport: false,
            symbolId: sym.id
          });
        }
        continue;
      }
      if (child.type === "function_definition") {
        const docs = findPrecedingPhpDoc(node, i, content);
        const sym = extractFunction5(child, filePath, docs);
        if (sym) {
          symbols.push(sym);
          exports.push({
            name: sym.name,
            isDefault: false,
            isReExport: false,
            symbolId: sym.id
          });
        }
        continue;
      }
    }
  }
};
function extractUseDeclaration2(node) {
  const results = [];
  const text = node.text;
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
          alias: aliasMatch ? aliasMatch[2] : void 0,
          isDefault: false,
          isNamespace: false
        }],
        isTypeOnly: false
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
        isNamespace: false
      }],
      isTypeOnly: false
    });
  }
  return results;
}
function extractClassDeclaration(node, filePath, docs, content) {
  const results = [];
  const nameNode = findChild8(node, "name");
  if (!nameNode) return results;
  const name = nameNode.text;
  const baseClause = findChild8(node, "base_clause");
  const extendsName = baseClause?.text.replace(/extends\s+/, "").trim();
  const interfaceClause = findChild8(node, "class_interface_clause");
  const implementsList = [];
  if (interfaceClause) {
    const text = interfaceClause.text.replace(/implements\s+/, "");
    implementsList.push(...text.split(",").map((s) => s.trim()).filter(Boolean));
  }
  const children = [];
  const body = findChild8(node, "declaration_list");
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i);
      if (member.type === "method_declaration") {
        const memberDocs = findPrecedingPhpDoc(body, i, content);
        const nameNode2 = findChild8(member, "name");
        if (!nameNode2) continue;
        const mName = nameNode2.text;
        const isPublic = hasVisibility(member, "public") || !hasAnyVisibility(member);
        const params = extractMethodParams3(member);
        const returnType = extractReturnType5(member);
        const methodSym = {
          id: `${filePath}:${name}.${mName}`,
          name: mName,
          kind: "method",
          visibility: isPublic ? "public" : hasVisibility(member, "protected") ? "protected" : "private",
          location: {
            file: filePath,
            line: member.startPosition.row + 1,
            column: member.startPosition.column,
            endLine: member.endPosition.row + 1,
            endColumn: member.endPosition.column
          },
          exported: isPublic,
          parameters: params.length > 0 ? params : void 0,
          returns: returnType ? { type: returnType } : void 0,
          parentId: `${filePath}:${name}`,
          docs: memberDocs,
          signature: buildSignature8(member)
        };
        results.push(methodSym);
        children.push(methodSym.id);
      }
      if (member.type === "property_declaration") {
        const propName = findChild8(member, "property_element");
        if (propName) {
          const varNode = findChild8(propName, "variable_name");
          if (varNode) {
            children.push(`${filePath}:${name}.${varNode.text}`);
          }
        }
      }
    }
  }
  const classSym = {
    id: `${filePath}:${name}`,
    name,
    kind: "class",
    visibility: "public",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    },
    exported: true,
    extends: extendsName,
    implements: implementsList.length > 0 ? implementsList : void 0,
    children: children.length > 0 ? children : void 0,
    docs,
    signature: buildTypeSignature3(node, name)
  };
  results.unshift(classSym);
  return results;
}
function extractInterfaceOrTrait(node, filePath, docs, kind) {
  const nameNode = findChild8(node, "name");
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
      endColumn: node.endPosition.column
    },
    exported: true,
    docs,
    signature: `${node.type.replace("_declaration", "")} ${name}`
  };
}
function extractFunction5(node, filePath, docs) {
  const nameNode = findChild8(node, "name");
  if (!nameNode) return null;
  const name = nameNode.text;
  const params = extractMethodParams3(node);
  const returnType = extractReturnType5(node);
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
      endColumn: node.endPosition.column
    },
    exported: true,
    parameters: params.length > 0 ? params : void 0,
    returns: returnType ? { type: returnType } : void 0,
    docs,
    signature: buildSignature8(node)
  };
}
function extractMethodParams3(node) {
  const params = [];
  const paramList = findChild8(node, "formal_parameters");
  if (!paramList) return params;
  for (let i = 0; i < paramList.childCount; i++) {
    const child = paramList.child(i);
    if (child.type === "simple_parameter" || child.type === "property_promotion_parameter") {
      const varNode = findChild8(child, "variable_name");
      const typeNode = findChild8(child, "type_list") || findChild8(child, "named_type") || findChild8(child, "primitive_type");
      if (varNode) {
        params.push({
          name: varNode.text.replace(/^\$/, ""),
          type: typeNode?.text || void 0,
          optional: child.text.includes("="),
          rest: false
        });
      }
    } else if (child.type === "variadic_parameter") {
      const varNode = findChild8(child, "variable_name");
      params.push({
        name: varNode?.text.replace(/^\$/, "") ?? "args",
        optional: true,
        rest: true
      });
    }
  }
  return params;
}
function extractReturnType5(node) {
  const text = node.text;
  const match = text.match(/\)\s*:\s*([\w|\\?]+)/);
  if (match) return match[1];
  return void 0;
}
function findFileDoc(root, content) {
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i);
    if (node.type === "comment") {
      return parsePhpDoc(node.text);
    } else if (node.type === "php_tag" || node.type === "text") {
      continue;
    } else {
      break;
    }
  }
  return void 0;
}
function findPrecedingPhpDoc(parent, nodeIndex, content) {
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
  return void 0;
}
function parsePhpDoc(text) {
  if (!text.startsWith("/**")) return void 0;
  const lines = text.replace(/^\/\*\*\s*/, "").replace(/\s*\*\/$/, "").split("\n").map((l) => l.replace(/^\s*\*\s?/, "").trim()).filter(Boolean);
  if (lines.length === 0) return void 0;
  const descLines = [];
  const params = {};
  let returns;
  let deprecated;
  for (const line of lines) {
    if (line.startsWith("@param")) {
      const match = line.match(/@param\s+\S+\s+\$(\w+)\s*(.*)/);
      if (match) params[match[1]] = match[2];
    } else if (line.startsWith("@return")) {
      returns = line.replace(/@returns?\s+\S+\s*/, "");
    } else if (line.startsWith("@deprecated")) {
      deprecated = line.replace(/@deprecated\s*/, "") || true;
    } else if (line.startsWith("@throws")) {
    } else if (!line.startsWith("@")) {
      descLines.push(line);
    }
  }
  const summary = descLines[0] || "";
  const description = descLines.length > 1 ? descLines.join("\n") : void 0;
  return {
    summary,
    description,
    params: Object.keys(params).length > 0 ? params : void 0,
    returns,
    deprecated
  };
}
function findChild8(node, type) {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type === type) return child;
  }
  return null;
}
function hasVisibility(node, visibility) {
  const text = node.text;
  const firstLine = text.split("{")[0] || text.split("\n")[0];
  return new RegExp(`\\b${visibility}\\b`).test(firstLine);
}
function hasAnyVisibility(node) {
  return hasVisibility(node, "public") || hasVisibility(node, "protected") || hasVisibility(node, "private");
}
function buildSignature8(node) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return text.split("\n")[0].trim();
}
function buildTypeSignature3(node, name) {
  const text = node.text;
  const braceIndex = text.indexOf("{");
  if (braceIndex > 0) {
    return text.slice(0, braceIndex).trim();
  }
  return `class ${name}`;
}

// src/analysis/parsers/text.ts
var TextParser = class {
  language;
  constructor(language) {
    this.language = language;
  }
  async parse(content, filePath) {
    const lines = content.split("\n");
    let summary = "";
    const commentPatterns = [
      /^\s*#\s*(.+)$/,
      // Shell/Python/YAML/TOML comments
      /^\s*\/\/\s*(.+)$/,
      // C-style line comments
      /^\s*\/\*\*?\s*(.+)$/,
      // C-style block comments start
      /^\s*--\s*(.+)$/,
      // SQL comments
      /^\s*<!--\s*(.+)$/
      // XML/HTML comments
    ];
    for (const line of lines.slice(0, 10)) {
      if (line.trim() === "") continue;
      for (const pattern of commentPatterns) {
        const match = line.match(pattern);
        if (match) {
          summary = match[1].trim();
          break;
        }
      }
      if (summary) break;
      break;
    }
    return {
      symbols: [],
      imports: [],
      exports: [],
      moduleDoc: summary ? { summary } : void 0
    };
  }
};

// src/analysis/parsers/yaml.ts
var YamlParser = class {
  language = "yaml";
  async parse(content, filePath) {
    const symbols = [];
    const lines = content.split("\n");
    const topLevelKeyPattern = /^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/;
    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      const match = line.match(topLevelKeyPattern);
      if (match) {
        symbols.push({
          id: `${filePath}:${match[1]}`,
          name: match[1],
          kind: "property",
          visibility: "public",
          location: { file: filePath, line: lineNum, column: 0 },
          exported: true
        });
      }
    }
    const summary = detectYamlPurpose(content, filePath);
    return {
      symbols,
      imports: [],
      exports: [],
      moduleDoc: summary ? { summary } : void 0
    };
  }
};
function detectYamlPurpose(content, filePath) {
  const lower = content.toLowerCase();
  const basename = filePath.split("/").pop()?.toLowerCase() || "";
  if (lower.includes("hosts:") && lower.includes("tasks:")) {
    return "Ansible playbook";
  }
  if (lower.includes("- role:") || lower.includes("ansible.builtin")) {
    return "Ansible role configuration";
  }
  if (lower.includes("services:") && (lower.includes("image:") || lower.includes("build:"))) {
    return "Docker Compose file";
  }
  if (lower.includes("apiversion:") && lower.includes("kind:")) {
    const kindMatch = content.match(/kind:\s*(\S+)/i);
    const kind = kindMatch ? kindMatch[1] : "resource";
    return `Kubernetes ${kind}`;
  }
  if ((lower.includes("on:") || lower.includes("'on':")) && lower.includes("jobs:")) {
    return "GitHub Actions workflow";
  }
  if (basename === "chart.yaml" || basename === "chart.yml") {
    return "Helm chart definition";
  }
  if (basename === "values.yaml" || basename === "values.yml") {
    return "Helm values configuration";
  }
  if (basename === ".gitlab-ci.yml") {
    return "GitLab CI/CD configuration";
  }
  if (basename === ".travis.yml") {
    return "Travis CI configuration";
  }
  if (basename.endsWith(".yml") || basename.endsWith(".yaml")) {
    return "YAML configuration file";
  }
  return "";
}

// src/analysis/parsers/shell.ts
var ShellParser = class {
  language = "shell";
  async parse(content, filePath) {
    const symbols = [];
    const lines = content.split("\n");
    let shellType = "shell";
    if (lines[0]?.startsWith("#!")) {
      const shebang = lines[0];
      if (shebang.includes("bash")) shellType = "bash";
      else if (shebang.includes("zsh")) shellType = "zsh";
      else if (shebang.includes("sh")) shellType = "sh";
    }
    const funcPattern1 = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\)\s*\{?/;
    const funcPattern2 = /^function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\(\))?\s*\{?/;
    const exportPattern = /^export\s+([A-Z_][A-Z0-9_]*)=/;
    const readonlyPattern = /^(?:readonly|declare\s+-r)\s+([A-Z_][A-Z0-9_]*)=/;
    let lineNum = 0;
    let prevComment = "";
    for (const line of lines) {
      lineNum++;
      const trimmed = line.trim();
      if (trimmed.startsWith("#") && !trimmed.startsWith("#!")) {
        prevComment = trimmed.replace(/^#\s*/, "");
        continue;
      }
      let match;
      match = trimmed.match(funcPattern1) || trimmed.match(funcPattern2);
      if (match) {
        symbols.push({
          id: `${filePath}:${match[1]}`,
          name: match[1],
          kind: "function",
          visibility: "public",
          location: { file: filePath, line: lineNum, column: 0 },
          exported: true,
          docs: prevComment ? { summary: prevComment } : void 0
        });
        prevComment = "";
        continue;
      }
      match = trimmed.match(exportPattern);
      if (match) {
        symbols.push({
          id: `${filePath}:${match[1]}`,
          name: match[1],
          kind: "variable",
          visibility: "public",
          location: { file: filePath, line: lineNum, column: 0 },
          exported: true,
          docs: prevComment ? { summary: prevComment } : void 0
        });
        prevComment = "";
        continue;
      }
      match = trimmed.match(readonlyPattern);
      if (match) {
        symbols.push({
          id: `${filePath}:${match[1]}`,
          name: match[1],
          kind: "constant",
          visibility: "public",
          location: { file: filePath, line: lineNum, column: 0 },
          exported: true,
          docs: prevComment ? { summary: prevComment } : void 0
        });
        prevComment = "";
        continue;
      }
      if (trimmed !== "") {
        prevComment = "";
      }
    }
    let summary = `${shellType.charAt(0).toUpperCase() + shellType.slice(1)} script`;
    const firstCommentLines = [];
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
      moduleDoc: { summary }
    };
  }
};

// src/analysis/parsers/hcl.ts
var HclParser = class {
  language = "hcl";
  async parse(content, filePath) {
    const symbols = [];
    const lines = content.split("\n");
    const blockPattern = /^(resource|data|variable|output|module|provider|terraform|locals)\s+(?:"([^"]+)"\s+)?(?:"([^"]+)"\s*)?\{/;
    const kindMap = {
      resource: "class",
      data: "property",
      variable: "variable",
      output: "property",
      module: "module",
      provider: "namespace",
      terraform: "namespace",
      locals: "namespace"
    };
    let lineNum = 0;
    let prevComment = "";
    for (const line of lines) {
      lineNum++;
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || trimmed.startsWith("//")) {
        prevComment = trimmed.replace(/^[#/]+\s*/, "");
        continue;
      }
      const match = trimmed.match(blockPattern);
      if (match) {
        const blockType = match[1];
        const type = match[2] || "";
        const name = match[3] || match[2] || blockType;
        const displayName = type && match[3] ? `${blockType}.${type}.${match[3]}` : type ? `${blockType}.${type}` : blockType;
        symbols.push({
          id: `${filePath}:${displayName}`,
          name: displayName,
          kind: kindMap[blockType] || "property",
          visibility: "public",
          location: { file: filePath, line: lineNum, column: 0 },
          exported: true,
          typeAnnotation: blockType,
          docs: prevComment ? { summary: prevComment } : void 0
        });
        prevComment = "";
        continue;
      }
      if (trimmed !== "") {
        prevComment = "";
      }
    }
    const basename = filePath.split("/").pop() || "";
    let summary = "Terraform configuration";
    if (basename === "main.tf") summary = "Main Terraform configuration";
    else if (basename === "variables.tf") summary = "Terraform variable definitions";
    else if (basename === "outputs.tf") summary = "Terraform output definitions";
    else if (basename === "providers.tf") summary = "Terraform provider configuration";
    else if (basename === "versions.tf") summary = "Terraform version constraints";
    else if (basename === "backend.tf") summary = "Terraform backend configuration";
    else if (basename.endsWith(".hcl")) summary = "HCL configuration";
    return {
      symbols,
      imports: [],
      exports: [],
      moduleDoc: { summary }
    };
  }
};

// src/analysis/parsers/sql.ts
var SqlParser = class {
  language = "sql";
  async parse(content, filePath) {
    const symbols = [];
    const lines = content.split("\n");
    const createPattern = /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP(?:ORARY)?\s+)?(TABLE|VIEW|(?:MATERIALIZED\s+)?VIEW|FUNCTION|PROCEDURE|TRIGGER|INDEX|TYPE|SCHEMA|SEQUENCE|ENUM)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:`|"|')?([a-zA-Z_][a-zA-Z0-9_.]*?)(?:`|"|')?\s*(?:\(|AS|;|\s)/i;
    const alterPattern = /^\s*ALTER\s+TABLE\s+(?:`|"|')?([a-zA-Z_][a-zA-Z0-9_.]*?)(?:`|"|')?\s/i;
    const kindMap = {
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
      enum: "enum"
    };
    let lineNum = 0;
    let prevComment = "";
    for (const line of lines) {
      lineNum++;
      const trimmed = line.trim();
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
          docs: prevComment ? { summary: prevComment } : void 0
        });
        prevComment = "";
        continue;
      }
      if (trimmed !== "" && !trimmed.startsWith("/*")) {
        prevComment = "";
      }
    }
    const tableCount = symbols.filter((s) => s.typeAnnotation === "TABLE").length;
    const funcCount = symbols.filter((s) => s.kind === "function").length;
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
      summary = `Database migration \u2014 ${summary}`;
    } else if (basename.includes("seed")) {
      summary = "Database seed data";
    }
    return {
      symbols,
      imports: [],
      exports: [],
      moduleDoc: { summary }
    };
  }
};

// src/analysis/parsers/markdown.ts
var MarkdownParser = class {
  language = "markdown";
  async parse(content, filePath) {
    const symbols = [];
    const lines = content.split("\n");
    const headingPattern = /^(#{1,6})\s+(.+)$/;
    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      const match = line.match(headingPattern);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim().replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/`([^`]*)`/g, "$1").replace(/\*\*([^*]*)\*\*/g, "$1").replace(/\*([^*]*)\*/g, "$1").trim();
        symbols.push({
          id: `${filePath}:${text}`,
          name: text,
          kind: "property",
          visibility: "public",
          location: { file: filePath, line: lineNum, column: 0 },
          exported: true,
          typeAnnotation: `h${level}`
        });
      }
    }
    let summary = "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "") continue;
      const headingMatch = trimmed.match(headingPattern);
      if (headingMatch) {
        summary = headingMatch[2].trim();
      } else if (!trimmed.startsWith("---") && !trimmed.startsWith("```")) {
        if (!summary) summary = trimmed.slice(0, 120);
      }
      if (summary) break;
    }
    const basename = filePath.split("/").pop()?.toLowerCase() || "";
    if (basename === "readme.md") summary = summary || "Project README";
    else if (basename === "contributing.md") summary = summary || "Contributing guide";
    else if (basename === "changelog.md") summary = summary || "Project changelog";
    else if (basename === "license.md") summary = summary || "License information";
    return {
      symbols,
      imports: [],
      exports: [],
      moduleDoc: summary ? { summary } : void 0
    };
  }
};

// src/analysis/parsers/index.ts
var parsers = /* @__PURE__ */ new Map();
function registerParser(parser) {
  parsers.set(parser.language, parser);
}
function getParser(language) {
  return parsers.get(language);
}
function getRegisteredLanguages() {
  return [...parsers.keys()];
}
registerParser(new TypeScriptParser());
registerParser(new JavaScriptParser());
registerParser(new PythonParser());
registerParser(new GoParser());
registerParser(new RustParser());
registerParser(new JavaParser());
registerParser(new CSharpParser());
registerParser(new RubyParser());
registerParser(new PhpParser());
registerParser(new YamlParser());
registerParser(new ShellParser());
registerParser(new HclParser());
registerParser(new SqlParser());
registerParser(new MarkdownParser());
for (const lang of [
  "swift",
  "kotlin",
  "scala",
  "elixir",
  "dart",
  "lua",
  "zig",
  "haskell",
  "c",
  "cpp",
  "dockerfile",
  "toml",
  "json",
  "xml"
]) {
  if (!parsers.has(lang)) {
    registerParser(new TextParser(lang));
  }
}

// src/analysis/file-discovery.ts
import fg from "fast-glob";
async function discoverFiles(repoRoot, source) {
  const files = await fg(source.include, {
    cwd: repoRoot,
    ignore: source.exclude,
    dot: false,
    onlyFiles: true,
    followSymbolicLinks: false,
    absolute: false
  });
  return files.sort();
}

// src/analysis/engine.ts
import { readFile as readFile2, stat } from "fs/promises";
import path3 from "path";
import fg3 from "fast-glob";

// src/analysis/workspace-resolver.ts
import { readFile } from "fs/promises";
import path2 from "path";
import fg2 from "fast-glob";
async function detectWorkspaces(repoRoot) {
  try {
    const pkgJsonPath = path2.join(repoRoot, "package.json");
    const pkgJson = JSON.parse(await readFile(pkgJsonPath, "utf-8"));
    const workspaceGlobs = pkgJson.workspaces;
    if (workspaceGlobs) {
      const globs = Array.isArray(workspaceGlobs) ? workspaceGlobs : workspaceGlobs.packages || [];
      const packages = await resolveWorkspaceGlobs(repoRoot, globs);
      if (packages.size > 0) {
        return { packages, type: "npm" };
      }
    }
  } catch {
  }
  try {
    const pnpmPath = path2.join(repoRoot, "pnpm-workspace.yaml");
    const content = await readFile(pnpmPath, "utf-8");
    const packagesMatch = content.match(/packages:\s*\n((?:\s+-\s+.+\n?)*)/);
    if (packagesMatch) {
      const globs = packagesMatch[1].split("\n").map((line) => line.replace(/^\s*-\s*['"]?/, "").replace(/['"]?\s*$/, "")).filter(Boolean);
      const packages = await resolveWorkspaceGlobs(repoRoot, globs);
      if (packages.size > 0) {
        return { packages, type: "pnpm" };
      }
    }
  } catch {
  }
  try {
    const lernaPath = path2.join(repoRoot, "lerna.json");
    const lernaJson = JSON.parse(await readFile(lernaPath, "utf-8"));
    const globs = lernaJson.packages || ["packages/*"];
    const packages = await resolveWorkspaceGlobs(repoRoot, globs);
    if (packages.size > 0) {
      return { packages, type: "lerna" };
    }
  } catch {
  }
  return { packages: /* @__PURE__ */ new Map(), type: "none" };
}
async function resolveWorkspaceGlobs(repoRoot, globs) {
  const packages = /* @__PURE__ */ new Map();
  const packageJsonGlobs = globs.map((g) => `${g}/package.json`);
  const matches = await fg2(packageJsonGlobs, {
    cwd: repoRoot,
    onlyFiles: true,
    ignore: ["**/node_modules/**"]
  });
  for (const match of matches) {
    try {
      const fullPath = path2.join(repoRoot, match);
      const pkgJson = JSON.parse(await readFile(fullPath, "utf-8"));
      const name = pkgJson.name;
      if (name) {
        const dir = path2.dirname(match);
        packages.set(name, dir);
      }
    } catch {
    }
  }
  return packages;
}

// src/analysis/engine.ts
async function analyzeCodebase(options) {
  const startTime = Date.now();
  const {
    source,
    analysis,
    repoRoot,
    commitSha,
    targetFiles,
    previousManifest,
    onProgress,
    previousSummaryCache,
    onAIProgress,
    hooks
  } = options;
  await executeHooks("pre_analyze", hooks, { cwd: repoRoot });
  const files = targetFiles ?? await discoverFiles(repoRoot, source);
  let workspaceInfo;
  if (analysis.monorepo !== false) {
    try {
      workspaceInfo = await detectWorkspaces(repoRoot);
      if (workspaceInfo.type !== "none") {
        log("info", `Detected ${workspaceInfo.type} workspace with ${workspaceInfo.packages.size} packages`);
      }
    } catch {
    }
  }
  if (files.length === 0) {
    log("warn", "No source files found matching include patterns. Check your docwalk.config.yml include/exclude settings.");
    log("info", `Supported extensions: ${getSupportedExtensions().join(", ")}`);
    try {
      const allFiles = await fg3("**/*", {
        cwd: repoRoot,
        ignore: [".git/**", "node_modules/**"],
        dot: false,
        onlyFiles: true,
        deep: 3
      });
      const extCounts = {};
      for (const f of allFiles) {
        const ext = path3.extname(f) || "(no extension)";
        extCounts[ext] = (extCounts[ext] || 0) + 1;
      }
      const topExts = Object.entries(extCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([ext, count]) => `${ext} (${count})`).join(", ");
      log("info", `Detected files in repo: ${topExts}`);
    } catch {
    }
  }
  const modules = [];
  let skippedFiles = 0;
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const absolutePath = path3.resolve(repoRoot, filePath);
    onProgress?.(i + 1, files.length, filePath);
    try {
      const fileStat = await stat(absolutePath);
      if (fileStat.size > analysis.max_file_size) {
        log("debug", `Skipped ${filePath}: exceeds ${analysis.max_file_size} byte limit (${fileStat.size} bytes)`);
        skippedFiles++;
        continue;
      }
      const content = await readFile2(absolutePath, "utf-8");
      const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
      const language = detectLanguage(filePath);
      if (!language) {
        log("debug", `Skipped ${filePath}: unrecognized language for extension ${ext}`);
        skippedFiles++;
        continue;
      }
      const parser = getParser(language);
      if (!parser) {
        log("debug", `Skipped ${filePath}: no parser for ${language}`);
        skippedFiles++;
        continue;
      }
      const parseResult = await parser.parse(content, filePath);
      const moduleInfo = {
        filePath,
        language,
        symbols: parseResult.symbols,
        imports: parseResult.imports,
        exports: parseResult.exports,
        moduleDoc: parseResult.moduleDoc,
        fileSize: fileStat.size,
        lineCount: content.split("\n").length,
        contentHash: computeFileHash(content),
        analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      modules.push(moduleInfo);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      log("debug", `Skipped ${filePath}: parse error \u2014 ${errMsg}`);
      skippedFiles++;
    }
  }
  if (modules.length === 0 && files.length > 0) {
    log("warn", `Found ${files.length} files but all were skipped during parsing. Run with -v to see skip reasons.`);
  }
  log("info", `Analyzed ${modules.length} files, skipped ${skippedFiles} (run with -v for details)`);
  const allModules = mergeModules(modules, previousManifest, targetFiles);
  const dependencyGraph = buildDependencyGraph(allModules, workspaceInfo);
  let finalModules = allModules;
  let summaryCache = previousSummaryCache || [];
  if (analysis.ai_summaries && analysis.ai_provider) {
    const { summarizeModules } = await import("./ai-summarizer-A33M3KNS.js");
    const result = await summarizeModules({
      providerConfig: analysis.ai_provider,
      modules: allModules,
      readFile: async (filePath) => {
        const absolutePath = path3.resolve(repoRoot, filePath);
        return readFile2(absolutePath, "utf-8");
      },
      previousCache: previousSummaryCache,
      onProgress: onAIProgress
    });
    finalModules = result.modules;
    summaryCache = result.cache;
  }
  log("info", "Building dependency graph and computing stats...");
  const projectMeta = computeProjectMeta(finalModules, repoRoot, source);
  const stats = computeStats(finalModules, skippedFiles, startTime);
  log("info", "Running static code analysis...");
  let insights;
  try {
    const { runStaticInsights } = await import("./insights-R4UTJF7H.js");
    const tempManifest = {
      modules: finalModules,
      dependencyGraph,
      projectMeta
    };
    insights = runStaticInsights(tempManifest);
    if (insights?.length) {
      log("info", `Found ${insights.length} code insights`);
    }
  } catch {
  }
  if (insights?.length && analysis.insights_ai && analysis.ai_provider) {
    try {
      const { createProvider } = await import("./providers-BMYE4QLG.js");
      const { enhanceInsightsWithAI } = await import("./ai-insights-EZM4JOGP.js");
      const provider = createProvider(analysis.ai_provider);
      if (provider) {
        insights = await enhanceInsightsWithAI({
          insights,
          aiProvider: provider,
          readFile: async (filePath) => {
            const absolutePath = path3.resolve(repoRoot, filePath);
            return readFile2(absolutePath, "utf-8");
          },
          onProgress: onAIProgress ? (current, total, message) => onAIProgress(current, total, message) : void 0
        });
      }
    } catch {
    }
  }
  const manifest = {
    docwalkVersion: "0.1.0",
    repo: source.repo,
    branch: source.branch,
    commitSha,
    analyzedAt: (/* @__PURE__ */ new Date()).toISOString(),
    modules: finalModules,
    dependencyGraph,
    projectMeta,
    stats,
    summaryCache,
    insights
  };
  await executeHooks("post_analyze", hooks, { cwd: repoRoot });
  return manifest;
}
function mergeModules(newModules, previousManifest, targetFiles) {
  if (!previousManifest || !targetFiles) {
    return newModules;
  }
  const newFilePaths = new Set(newModules.map((m) => m.filePath));
  const targetSet = new Set(targetFiles);
  const preserved = previousManifest.modules.filter(
    (m) => !targetSet.has(m.filePath)
  );
  return [...preserved, ...newModules];
}
function buildDependencyGraph(modules, workspaceInfo) {
  const nodes = modules.map((m) => m.filePath);
  const edges = [];
  const exportMap = /* @__PURE__ */ new Map();
  for (const mod of modules) {
    for (const exp of mod.exports) {
      exportMap.set(`${mod.filePath}:${exp.name}`, mod.filePath);
    }
  }
  for (const mod of modules) {
    for (const imp of mod.imports) {
      const resolvedTarget = resolveImportSource(
        imp.source,
        mod.filePath,
        nodes,
        workspaceInfo
      );
      if (resolvedTarget) {
        edges.push({
          from: mod.filePath,
          to: resolvedTarget,
          imports: imp.specifiers.map((s) => s.name),
          isTypeOnly: imp.isTypeOnly
        });
      }
    }
  }
  return { nodes, edges };
}
function resolveImportSource(source, fromFile, knownFiles, workspaceInfo) {
  if (source.startsWith(".") || source.startsWith("@/")) {
    const dir = path3.dirname(fromFile);
    let resolved = source.startsWith("@/") ? source.replace("@/", "src/") : path3.join(dir, source);
    const strippedExt = resolved.replace(/\.(m|c)?js$/, "");
    const candidates = [
      resolved,
      strippedExt,
      `${resolved}.ts`,
      `${resolved}.tsx`,
      `${resolved}.js`,
      `${resolved}.jsx`,
      `${strippedExt}.ts`,
      `${strippedExt}.tsx`,
      `${strippedExt}.js`,
      `${strippedExt}.jsx`,
      `${resolved}/index.ts`,
      `${resolved}/index.tsx`,
      `${resolved}/index.js`,
      `${resolved}/index.jsx`,
      `${strippedExt}/index.ts`,
      `${strippedExt}/index.tsx`,
      `${strippedExt}/index.js`,
      `${strippedExt}/index.jsx`
    ].map((c) => path3.normalize(c));
    return knownFiles.find((f) => candidates.includes(path3.normalize(f)));
  }
  if (workspaceInfo && workspaceInfo.packages.size > 0) {
    for (const [pkgName, pkgDir] of workspaceInfo.packages) {
      if (source === pkgName || source.startsWith(`${pkgName}/`)) {
        const subpath = source === pkgName ? "" : source.slice(pkgName.length + 1);
        const basePath = subpath ? `${pkgDir}/src/${subpath}` : pkgDir;
        const candidates = subpath ? [
          `${basePath}.ts`,
          `${basePath}.tsx`,
          `${basePath}.js`,
          `${basePath}.jsx`,
          `${basePath}/index.ts`,
          `${basePath}/index.tsx`,
          `${basePath}/index.js`,
          `${basePath}/index.jsx`
        ] : [
          `${pkgDir}/src/index.ts`,
          `${pkgDir}/src/index.tsx`,
          `${pkgDir}/src/index.js`,
          `${pkgDir}/src/index.jsx`,
          `${pkgDir}/index.ts`,
          `${pkgDir}/index.tsx`,
          `${pkgDir}/index.js`,
          `${pkgDir}/index.jsx`,
          `${pkgDir}/lib/index.ts`,
          `${pkgDir}/lib/index.js`
        ];
        const match = knownFiles.find(
          (f) => candidates.some((c) => path3.normalize(f) === path3.normalize(c))
        );
        if (match) return match;
      }
    }
  }
  return void 0;
}
function computeProjectMeta(modules, repoRoot, source) {
  const langCounts = {};
  for (const mod of modules) {
    langCounts[mod.language] = (langCounts[mod.language] || 0) + 1;
  }
  const totalFiles = modules.length;
  const languages = Object.entries(langCounts).map(([name2, fileCount]) => ({
    name: name2,
    fileCount,
    percentage: Math.round(fileCount / totalFiles * 100)
  })).sort((a, b) => b.fileCount - a.fileCount);
  const entryPoints = modules.filter(
    (m) => m.filePath.includes("index.") || m.filePath.includes("main.") || m.filePath.includes("app.")
  ).map((m) => m.filePath);
  const rawName = source.repo.split("/").pop() || source.repo;
  const name = rawName === "." ? path3.basename(repoRoot) : rawName;
  let readmeDescription;
  const readmeMod = modules.find(
    (m) => path3.basename(m.filePath).toLowerCase() === "readme.md"
  );
  if (readmeMod?.moduleDoc?.summary) {
    readmeDescription = readmeMod.moduleDoc.summary;
  }
  return {
    name,
    readmeDescription,
    languages,
    entryPoints,
    repository: source.repo
  };
}
function computeStats(modules, skippedFiles, startTime) {
  const byLanguage = {};
  const byKind = {};
  let totalSymbols = 0;
  let totalLines = 0;
  for (const mod of modules) {
    if (!byLanguage[mod.language]) {
      byLanguage[mod.language] = { files: 0, symbols: 0, lines: 0 };
    }
    byLanguage[mod.language].files++;
    byLanguage[mod.language].symbols += mod.symbols.length;
    byLanguage[mod.language].lines += mod.lineCount;
    for (const sym of mod.symbols) {
      byKind[sym.kind] = (byKind[sym.kind] || 0) + 1;
      totalSymbols++;
    }
    totalLines += mod.lineCount;
  }
  return {
    totalFiles: modules.length,
    totalSymbols,
    totalLines,
    byLanguage,
    byKind,
    analysisTime: Date.now() - startTime,
    skippedFiles
  };
}

export {
  registerParser,
  getParser,
  getRegisteredLanguages,
  discoverFiles,
  analyzeCodebase
};
