/**
 * Shared prompt builder for DocWalk AI-powered page generation.
 *
 * Enforces consistent quality across all narrative pages by applying
 * DeepWiki's proven prompt structure: provenance blocks, strict citations,
 * comprehensive Mermaid rules, and source-grounded content.
 */

import type { ContextChunk } from "../analysis/context-builder.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PagePromptOptions {
  /** Page title / topic */
  title: string;
  /** Project name */
  projectName: string;
  /** Assembled context chunks from context-builder */
  contextChunks: ContextChunk[];
  /** Page-specific writing instructions */
  pageInstructions: string;
  /** File paths listed in the provenance block */
  sourceFiles: string[];
  /** Optional GitHub repo URL (enables clickable source links) */
  repoUrl?: string;
  /** Optional branch name (defaults to "main") */
  branch?: string;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

/**
 * Returns the system prompt used for every page generation call.
 */
export function buildPageSystemPrompt(): string {
  return [
    "You are an expert technical writer and software architect.",
    "You produce clear, accurate, developer-focused documentation grounded exclusively in the source code provided to you.",
    "You never invent information, speculate about behaviour, or use knowledge outside the supplied context.",
    "Your writing is precise, concise, and free of marketing language.",
  ].join(" ");
}

// ---------------------------------------------------------------------------
// User prompt
// ---------------------------------------------------------------------------

/**
 * Assembles a complete user prompt for page generation.
 *
 * Structure:
 *  1. Source code context (formatted from contextChunks)
 *  2. CRITICAL STARTING INSTRUCTION -- provenance block
 *  3. Page-specific instructions
 *  4. Mermaid diagram rules
 *  5. Source citation rules
 *  6. Formatting rules
 */
export function buildPagePrompt(options: PagePromptOptions): string {
  const {
    title,
    projectName,
    contextChunks,
    pageInstructions,
    sourceFiles,
    repoUrl,
    branch = "main",
  } = options;

  const sections: string[] = [];

  // ------------------------------------------------------------------
  // 1. Source code context
  // ------------------------------------------------------------------
  sections.push(formatSourceContext(contextChunks));

  // ------------------------------------------------------------------
  // 2. Provenance block (CRITICAL -- must be the first thing emitted)
  // ------------------------------------------------------------------
  sections.push(formatProvenanceInstruction(sourceFiles, projectName, title, repoUrl, branch));

  // ------------------------------------------------------------------
  // 3. Page-specific instructions
  // ------------------------------------------------------------------
  sections.push(formatPageInstructions(title, projectName, pageInstructions));

  // ------------------------------------------------------------------
  // 4. Mermaid diagram rules
  // ------------------------------------------------------------------
  sections.push(MERMAID_RULES);

  // ------------------------------------------------------------------
  // 5. Source citation rules
  // ------------------------------------------------------------------
  sections.push(CITATION_RULES);

  // ------------------------------------------------------------------
  // 6. Formatting rules
  // ------------------------------------------------------------------
  sections.push(FORMATTING_RULES);

  return sections.join("\n\n");
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatSourceContext(chunks: ContextChunk[]): string {
  if (chunks.length === 0) {
    return "## Source Code Context\n\nNo source code context was provided.";
  }

  const formatted = chunks.map((chunk) => {
    const header = `### ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine})`;
    return `${header}\n\`\`\`\n${chunk.content}\n\`\`\``;
  });

  return `## Source Code Context\n\nBelow is the source code you MUST base your documentation on.\n\n${formatted.join("\n\n")}`;
}

function formatProvenanceInstruction(
  sourceFiles: string[],
  projectName: string,
  title: string,
  repoUrl?: string,
  branch = "main",
): string {
  const fileList = sourceFiles
    .map((f) => {
      if (repoUrl) {
        const cleanUrl = repoUrl.replace(/\/$/, "");
        return `- [\`${f}\`](${cleanUrl}/blob/${branch}/${f})`;
      }
      return `- \`${f}\``;
    })
    .join("\n");

  return [
    "## CRITICAL STARTING INSTRUCTION",
    "",
    "Your page MUST begin with the following provenance block before ANY other content:",
    "",
    "```markdown",
    "<details>",
    `<summary>Sources for "${title}" in ${projectName}</summary>`,
    "",
    fileList,
    "",
    "</details>",
    "```",
    "",
    "Do NOT omit or reformat this block. It must appear verbatim as the first element of your output.",
  ].join("\n");
}

function formatPageInstructions(
  title: string,
  projectName: string,
  pageInstructions: string,
): string {
  return [
    "## Page Instructions",
    "",
    `Write a documentation page titled **"${title}"** for the project **${projectName}**.`,
    "",
    pageInstructions,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Static rule blocks
// ---------------------------------------------------------------------------

const MERMAID_RULES = `## MERMAID DIAGRAM RULES

When including diagrams, follow these rules exactly. Broken Mermaid cannot be retried in a static site.

1. Use \`\`\`mermaid code blocks for all diagrams.
2. Always use \`flowchart TD\` (top-down). Never use \`flowchart LR\`.
3. Maximum 15 nodes per diagram. Keep labels to 3-4 words.
4. Do NOT use special characters in node labels: no parentheses, brackets, quotes, colons, or semicolons inside the label text itself.
5. Do NOT use HTML tags in labels.
6. Wrap labels in double quotes if they contain spaces: \`A["My Label"]\`.
7. Use simple arrow syntax: \`A --> B\`.
8. For labeled edges: \`A -->|"label"| B\`.
9. For subgraphs: \`subgraph Name["Display Name"] ... end\`.
10. Every node referenced in an arrow MUST be defined.
11. For sequence diagrams: use \`sequenceDiagram\`, max 6 participants, max 15 messages.
12. Solid arrows (\`->>\`) for calls, dashed arrows (\`-->>\`) for returns.
13. If a diagram would exceed these limits, split it into multiple smaller diagrams with explanatory text between them.`;

const CITATION_RULES = `## SOURCE CITATION RULES

1. For EVERY piece of significant information, cite the source file and line numbers.
2. Place citations at the end of the paragraph or directly under diagrams and tables.
3. Format for a line range: \`Sources: [filename.ext:start_line-end_line]()\`
4. Format for a single line: \`Sources: [filename.ext:line_number]()\`
5. Multiple sources: \`Sources: [file1.ext:1-10](), [file2.ext:5]()\`
6. ALL information MUST be derived SOLELY from the provided source files.
7. Do NOT infer, invent, or use external knowledge beyond what the source code shows.`;

const FORMATTING_RULES = `## FORMATTING RULES

1. Use standard Markdown headings (\`##\`, \`###\`). Do not use \`#\` (h1) -- the page title is set by MkDocs.
2. Use fenced code blocks with language identifiers for all code snippets.
3. Use tables for structured comparisons or parameter descriptions.
4. Use admonition syntax (\`!!! note\`, \`!!! warning\`, \`!!! tip\`) for callouts.
5. Do NOT start paragraphs with "This module provides..." or similar filler phrases.
6. Do NOT use marketing language, superlatives, or promotional tone.
7. Write in second person ("you") when addressing the reader.
8. Keep paragraphs short -- 2-4 sentences maximum.
9. Prefer concrete examples over abstract descriptions.`;
