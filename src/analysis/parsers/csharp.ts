/**
 * C# Parser
 *
 * Uses web-tree-sitter with the C# grammar to extract classes,
 * interfaces, structs, enums, records, methods, properties,
 * XML doc comments, and using directives.
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

export class CSharpParser implements LanguageParser {
  language: LanguageId = "csharp";

  async parse(content: string, filePath: string): Promise<ParserResult> {
    const symbols: Symbol[] = [];
    const imports: ImportInfo[] = [];
    const exports: ExportInfo[] = [];
    let moduleDoc: DocComment | undefined;

    const parser = await initParser("csharp");
    const tree = parser.parse(content);
    const root = tree.rootNode;

    // Walk all top-level declarations
    this.walkNode(root, filePath, content, symbols, imports, exports);

    // First XML doc comment in the file can serve as module doc
    moduleDoc = extractFileDoc(content);

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

      if (child.type === "using_directive") {
        const imp = extractUsing(child);
        if (imp) imports.push(imp);
        continue;
      }

      if (child.type === "namespace_declaration" || child.type === "file_scoped_namespace_declaration") {
        // Recurse into namespace
        const body = findChild(child, "declaration_list");
        if (body) {
          this.walkNode(body, filePath, content, symbols, imports, exports);
        }
        continue;
      }

      if (child.type === "class_declaration" || child.type === "interface_declaration" ||
          child.type === "struct_declaration" || child.type === "enum_declaration" ||
          child.type === "record_declaration") {
        const docs = findPrecedingXmlDoc(node, i, content);
        const syms = extractTypeDeclaration(child, filePath, docs, content);
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
  }
}

// ─── Import Extraction ──────────────────────────────────────────────────────

function extractUsing(node: TreeSitterNode): ImportInfo | null {
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
      isNamespace: !text.includes("static"),
    }],
    isTypeOnly: !text.includes("static"),
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
  const isInternal = hasModifier(node, "internal");

  let kind: SymbolKind = "class";
  if (node.type === "interface_declaration") kind = "interface";
  else if (node.type === "struct_declaration") kind = "class";
  else if (node.type === "enum_declaration") kind = "enum";
  else if (node.type === "record_declaration") kind = "class";

  // Check for base types
  const baseList = findChild(node, "base_list");
  let extendsName: string | undefined;
  const implementsList: string[] = [];
  if (baseList) {
    for (let i = 0; i < baseList.childCount; i++) {
      const child = baseList.child(i)!;
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

  const children: string[] = [];

  // Extract members
  const body = findChild(node, "declaration_list");
  if (body) {
    for (let i = 0; i < body.childCount; i++) {
      const member = body.child(i)!;

      if (member.type === "method_declaration" || member.type === "constructor_declaration") {
        const memberDocs = findPrecedingXmlDocInner(body, i, content);
        const memberName = findChild(member, "identifier");
        if (!memberName) continue;

        const mName = memberName.text;
        const mIsPublic = hasModifier(member, "public");
        const params = extractMethodParams(member);
        const returnType = extractReturnType(member);

        const methodSym: Symbol = {
          id: `${filePath}:${name}.${mName}`,
          name: mName,
          kind: "method",
          visibility: mIsPublic ? "public" : hasModifier(member, "protected") ? "protected" : hasModifier(member, "internal") ? "internal" : "private",
          location: {
            file: filePath,
            line: member.startPosition.row + 1,
            column: member.startPosition.column,
            endLine: member.endPosition.row + 1,
            endColumn: member.endPosition.column,
          },
          exported: mIsPublic || hasModifier(member, "internal"),
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
        const memberDocs = findPrecedingXmlDocInner(body, i, content);
        const propName = findChild(member, "identifier");
        if (propName) {
          const mIsPublic = hasModifier(member, "public");
          const propSym: Symbol = {
            id: `${filePath}:${name}.${propName.text}`,
            name: propName.text,
            kind: "property",
            visibility: mIsPublic ? "public" : "private",
            location: {
              file: filePath,
              line: member.startPosition.row + 1,
              column: member.startPosition.column,
            },
            exported: mIsPublic,
            parentId: `${filePath}:${name}`,
            docs: memberDocs,
            signature: buildSignature(member),
          };
          results.push(propSym);
          children.push(propSym.id);
        }
      }
    }
  }

  const typeSym: Symbol = {
    id: `${filePath}:${name}`,
    name,
    kind,
    visibility: isPublic ? "public" : isInternal ? "internal" : "private",
    location: {
      file: filePath,
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
    },
    exported: isPublic || isInternal,
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
  const paramList = findChild(node, "parameter_list");
  if (!paramList) return params;

  for (let i = 0; i < paramList.childCount; i++) {
    const child = paramList.child(i)!;
    if (child.type === "parameter") {
      const nameNode = findChild(child, "identifier");
      // Get type
      let typeName = "";
      for (let j = 0; j < child.childCount; j++) {
        const part = child.child(j)!;
        if (part.type === "identifier") break;
        if (part.isNamed && part.type !== "modifier") typeName = part.text;
      }

      if (nameNode) {
        params.push({
          name: nameNode.text,
          type: typeName || undefined,
          optional: child.text.includes("="),
          rest: child.text.startsWith("params"),
        });
      }
    }
  }

  return params;
}

function extractReturnType(node: TreeSitterNode): string | undefined {
  // In C# tree-sitter, return type appears before method name
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!;
    if (child.type === "identifier" || child.type === "parameter_list") break;
    if (child.type === "predefined_type" || child.type === "identifier" ||
        child.type === "generic_name" || child.type === "nullable_type" ||
        child.type === "array_type" || child.type === "void_keyword") {
      return child.text;
    }
  }
  return undefined;
}

// ─── XML Doc Comment Extraction ─────────────────────────────────────────────

function extractFileDoc(content: string): DocComment | undefined {
  const lines = content.split("\n");
  const docLines: string[] = [];

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

function findPrecedingXmlDoc(
  root: TreeSitterNode,
  nodeIndex: number,
  content: string
): DocComment | undefined {
  const docLines: string[] = [];

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

function findPrecedingXmlDocInner(
  parent: TreeSitterNode,
  nodeIndex: number,
  content: string
): DocComment | undefined {
  const docLines: string[] = [];

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

function parseXmlDocLines(lines: string[]): DocComment | undefined {
  if (lines.length === 0) return undefined;

  const fullText = lines.join("\n");

  // Extract <summary>
  const summaryMatch = fullText.match(/<summary>\s*([\s\S]*?)\s*<\/summary>/);
  const summary = summaryMatch
    ? summaryMatch[1].replace(/\s+/g, " ").trim()
    : lines[0].replace(/<[^>]+>/g, "").trim();

  if (!summary) return undefined;

  // Extract <param> tags
  const params: Record<string, string> = {};
  const paramRegex = /<param\s+name="(\w+)">(.*?)<\/param>/g;
  let match;
  while ((match = paramRegex.exec(fullText)) !== null) {
    params[match[1]] = match[2].trim();
  }

  // Extract <returns>
  const returnsMatch = fullText.match(/<returns>(.*?)<\/returns>/);
  const returns = returnsMatch ? returnsMatch[1].trim() : undefined;

  return {
    summary,
    description: lines.length > 1 ? fullText.replace(/<[^>]+>/g, "").trim() : undefined,
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

function hasModifier(node: TreeSitterNode, modifier: string): boolean {
  const text = node.text;
  const firstLine = text.split("{")[0] || text.split("\n")[0];
  // Match the modifier as a whole word
  return new RegExp(`\\b${modifier}\\b`).test(firstLine);
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
