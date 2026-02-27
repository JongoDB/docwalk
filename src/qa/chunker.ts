/**
 * Content Chunker
 *
 * Splits generated page content into 200-500 token chunks
 * with semantic boundaries (headings, paragraphs).
 */

import { estimateTokens } from "../generators/utils.js";

export interface ContentChunk {
  /** Unique chunk identifier */
  id: string;
  /** Source page path */
  pagePath: string;
  /** Page title */
  pageTitle: string;
  /** Heading context (nearest parent heading) */
  heading?: string;
  /** Chunk text content */
  content: string;
  /** Estimated token count */
  tokenCount: number;
}

const MIN_CHUNK_TOKENS = 50;
const TARGET_CHUNK_TOKENS = 300;
const MAX_CHUNK_TOKENS = 500;


/**
 * Split a page's markdown content into semantic chunks.
 */
export function chunkPage(
  pagePath: string,
  pageTitle: string,
  content: string
): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  let chunkIndex = 0;

  // Strip frontmatter
  const stripped = content.replace(/^---[\s\S]*?---\n*/m, "");

  // Split by headings (keeping the heading with its content)
  const sections = splitByHeadings(stripped);

  for (const section of sections) {
    const heading = section.heading;
    const sectionContent = section.content.trim();

    if (!sectionContent) continue;

    const tokens = estimateTokens(sectionContent);

    if (tokens <= MAX_CHUNK_TOKENS) {
      // Small enough to be a single chunk
      if (tokens >= MIN_CHUNK_TOKENS) {
        chunks.push({
          id: `${pagePath}:${chunkIndex++}`,
          pagePath,
          pageTitle,
          heading,
          content: sectionContent,
          tokenCount: tokens,
        });
      }
    } else {
      // Split into paragraph-level chunks
      const paragraphs = sectionContent.split(/\n\n+/);
      let currentChunk = "";
      let currentTokens = 0;

      for (const para of paragraphs) {
        const paraTokens = estimateTokens(para);

        if (currentTokens + paraTokens > MAX_CHUNK_TOKENS && currentChunk) {
          chunks.push({
            id: `${pagePath}:${chunkIndex++}`,
            pagePath,
            pageTitle,
            heading,
            content: currentChunk.trim(),
            tokenCount: currentTokens,
          });
          currentChunk = "";
          currentTokens = 0;
        }

        currentChunk += para + "\n\n";
        currentTokens += paraTokens;

        if (currentTokens >= TARGET_CHUNK_TOKENS) {
          chunks.push({
            id: `${pagePath}:${chunkIndex++}`,
            pagePath,
            pageTitle,
            heading,
            content: currentChunk.trim(),
            tokenCount: currentTokens,
          });
          currentChunk = "";
          currentTokens = 0;
        }
      }

      // Remainder
      if (currentChunk.trim() && currentTokens >= MIN_CHUNK_TOKENS) {
        chunks.push({
          id: `${pagePath}:${chunkIndex++}`,
          pagePath,
          pageTitle,
          heading,
          content: currentChunk.trim(),
          tokenCount: currentTokens,
        });
      }
    }
  }

  return chunks;
}

interface Section {
  heading?: string;
  content: string;
}

function splitByHeadings(markdown: string): Section[] {
  const sections: Section[] = [];
  const lines = markdown.split("\n");
  let currentHeading: string | undefined;
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      // Save previous section
      if (currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n"),
        });
      }
      currentHeading = headingMatch[2];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Final section
  if (currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join("\n"),
    });
  }

  return sections;
}

/**
 * Chunk all pages in a batch.
 */
export function chunkPages(
  pages: Array<{ path: string; title: string; content: string }>
): ContentChunk[] {
  const allChunks: ContentChunk[] = [];

  for (const page of pages) {
    allChunks.push(...chunkPage(page.path, page.title, page.content));
  }

  return allChunks;
}
