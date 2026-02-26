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
        const text = match[2].trim();

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

    // Extract summary from first heading or first paragraph
    let summary = "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "") continue;
      const headingMatch = trimmed.match(headingPattern);
      if (headingMatch) {
        summary = headingMatch[2].trim();
      } else if (!trimmed.startsWith("---") && !trimmed.startsWith("```")) {
        // First non-heading, non-frontmatter text
        if (!summary) summary = trimmed.slice(0, 120);
      }
      if (summary) break;
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
