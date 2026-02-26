/**
 * JavaScript Parser
 *
 * Extends the TypeScript parser since JS is a syntactic subset.
 * Overrides the language ID so the parser registry routes JS files here.
 */

import { TypeScriptParser } from "./typescript.js";
import type { LanguageId } from "../language-detect.js";

export class JavaScriptParser extends TypeScriptParser {
  language: LanguageId = "javascript";
}
