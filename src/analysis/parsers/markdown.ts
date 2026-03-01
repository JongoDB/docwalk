/**
 * Markdown Parser
 *
 * Lightweight regex-based parser for .md/.mdx files.
 * Extracts headings as symbols (kind: "section").
 * Useful for documentation-heavy repos.
 */

import type { LanguageParser, ParserResult } from "./index.js";
import type { Symbol } from "../types.js";
import type { LanguageId } from "../language-detect.js";

export class MarkdownParser implements LanguageParser {
  language: LanguageId = "markdown" as LanguageId;

  async parse(content: string, filePath: string): Promise<ParserResult> {
    const symbols: Symbol[] = [];
    const lines = content.split("\n");

    // ATX headings: # Heading, ## Heading, etc.
    const headingPattern = /^(#{1,6})\s+(.+)$/;

    let lineNum = 0;

    for (const line of lines) {
      lineNum++;
      const match = line.match(headingPattern);
      if (match) {
        const level = match[1].length;
        // Strip inline markdown: [text](url) → text, `code` → code, **bold** → bold
        const text = match[2].trim()
          .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")  // [text](url) → text
          .replace(/`([^`]*)`/g, "$1")                // `code` → code
          .replace(/\*\*([^*]*)\*\*/g, "$1")          // **bold** → bold
          .replace(/\*([^*]*)\*/g, "$1")              // *italic* → italic
          .trim();

        symbols.push({
          id: `${filePath}:${text}`,
          name: text,
          kind: "property" as const,
          visibility: "public",
          location: { file: filePath, line: lineNum, column: 0 },
          exported: true,
          typeAnnotation: `h${level}`,
        });
      }
    }

    // Extract summary from first meaningful prose paragraph
    // For READMEs with fancy headers (centered HTML, badges, etc.), skip decorative lines
    // and find the first real sentence of description text.
    let summary = "";
    let foundHeading = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "") continue;
      // Skip HTML block tags (e.g. <h1 align="center">, <div>, <p>, </h1>, <!-- -->)
      if (/^<\/?[a-z][^>]*>$/i.test(trimmed) || /^<!--/.test(trimmed)) continue;
      // Skip badge images, shield.io links, and img tags
      if (/^\[!\[/.test(trimmed) || /^<img\s/i.test(trimmed)) continue;
      // Skip lines that are just links: [text](url) • [text](url)
      if (/^(\s*<a\s|.*•.*<a\s)/i.test(trimmed)) continue;
      // Skip frontmatter and code fences
      if (trimmed.startsWith("---") || trimmed.startsWith("```")) continue;

      const headingMatch = trimmed.match(headingPattern);
      if (headingMatch) {
        foundHeading = true;
        continue; // Don't use headings as description — keep looking for prose
      }

      // Strip any inline HTML and check if there's real text
      const stripped = trimmed.replace(/<[^>]+>/g, "").trim();
      if (!stripped) continue;
      // Skip very short fragments (e.g. "Verbatim Studio" extracted from <h1> inner text)
      // We want a real sentence, not a title echo
      if (stripped.length < 20 && !stripped.includes(".")) continue;

      summary = stripped.slice(0, 200);
      break;
    }

    // Fallback: if no prose found, use the first heading
    if (!summary) {
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "") continue;
        const headingMatch = trimmed.match(headingPattern);
        if (headingMatch) {
          summary = headingMatch[2].trim();
          break;
        }
      }
    }

    // Detect purpose from filename
    const basename = filePath.split("/").pop()?.toLowerCase() || "";
    if (basename === "readme.md") summary = summary || "Project README";
    else if (basename === "contributing.md") summary = summary || "Contributing guide";
    else if (basename === "changelog.md") summary = summary || "Project changelog";
    else if (basename === "license.md") summary = summary || "License information";

    return {
      symbols,
      imports: [],
      exports: [],
      moduleDoc: summary ? { summary } : undefined,
    };
  }
}
