/**
 * Tree-sitter WASM Loader
 *
 * Manages initialization and caching of web-tree-sitter parsers and
 * language grammars. Uses the WASM build for cross-platform compatibility.
 */

import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);

/** Minimal tree-sitter node interface for our parser needs. */
export interface TreeSitterNode {
  type: string;
  text: string;
  isNamed: boolean;
  childCount: number;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  child(index: number): TreeSitterNode | null;
  childForFieldName(name: string): TreeSitterNode | null;
  previousSibling: TreeSitterNode | null;
  nextSibling: TreeSitterNode | null;
}

interface TreeSitterTree {
  rootNode: TreeSitterNode;
}

interface TreeSitterParser {
  parse(source: string): TreeSitterTree;
  setLanguage(lang: unknown): void;
}

interface TreeSitterModule {
  init(options?: Record<string, unknown>): Promise<void>;
  new (): TreeSitterParser;
  Language: {
    load(path: string): Promise<unknown>;
  };
}

// Map of grammar names to their WASM file names in tree-sitter-wasms
const GRAMMAR_MAP: Record<string, string> = {
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
  haskell: "tree-sitter-haskell.wasm",
};

let ParserClass: TreeSitterModule | null = null;
let initPromise: Promise<void> | null = null;
const languageCache = new Map<string, unknown>();
const parserCache = new Map<string, TreeSitterParser>();

/**
 * Initialize the web-tree-sitter runtime. Called once, subsequent
 * calls are no-ops.
 */
async function ensureInit(): Promise<TreeSitterModule> {
  if (ParserClass) return ParserClass;

  if (!initPromise) {
    initPromise = (async () => {
      // Dynamic import for ESM compatibility
      const mod = await import("web-tree-sitter");
      ParserClass = (mod.default ?? mod) as unknown as TreeSitterModule;
      await ParserClass.init();
    })();
  }

  await initPromise;
  return ParserClass!;
}

/**
 * Get a tree-sitter parser configured for the given language.
 *
 * @param language - Language identifier (e.g., "typescript", "python")
 * @returns A parser instance ready to parse source code
 */
export async function initParser(
  language: string
): Promise<TreeSitterParser> {
  if (parserCache.has(language)) {
    return parserCache.get(language)!;
  }

  const Parser = await ensureInit();

  // Load language grammar
  if (!languageCache.has(language)) {
    const wasmFile = GRAMMAR_MAP[language];
    if (!wasmFile) {
      throw new Error(
        `No tree-sitter grammar available for language: ${language}. ` +
          `Supported languages: ${Object.keys(GRAMMAR_MAP).join(", ")}`
      );
    }

    const wasmDir = path.dirname(require.resolve("tree-sitter-wasms/package.json"));
    const wasmPath = path.join(wasmDir, "out", wasmFile);
    const lang = await Parser.Language.load(wasmPath);
    languageCache.set(language, lang);
  }

  const parser = new Parser();
  parser.setLanguage(languageCache.get(language)!);
  parserCache.set(language, parser);

  return parser;
}
