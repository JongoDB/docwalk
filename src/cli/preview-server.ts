/**
 * DocWalk — Pure Node.js Preview Server
 *
 * Serves generated markdown docs with a clean HTML template.
 * Uses CDN-hosted assets for styling (GitHub Markdown CSS + Highlight.js + Mermaid).
 * No Python, no Zensical, no external dependencies.
 */

import http from "http";
import fs from "fs/promises";
import path from "path";
import { log, blank } from "../utils/logger.js";
import chalk from "chalk";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

interface NavItem {
  title: string;
  path: string;
  children?: NavItem[];
}

/**
 * Start the preview server.
 */
export async function startPreviewServer(
  docsDir: string,
  host: string,
  port: number
): Promise<http.Server> {
  const docsRoot = path.resolve(docsDir, "docs");
  const mkdocsPath = path.resolve(docsDir, "mkdocs.yml");

  // Parse nav from mkdocs.yml
  const nav = await parseNav(mkdocsPath, docsRoot);

  // Read custom CSS if present
  let customCss = "";
  try {
    customCss = await fs.readFile(path.join(docsRoot, "stylesheets", "preset.css"), "utf-8");
  } catch {
    // No custom CSS
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${host}:${port}`);
      let pathname = decodeURIComponent(url.pathname);

      // Serve static assets
      if (pathname.startsWith("/stylesheets/") || pathname.startsWith("/javascripts/")) {
        const filePath = path.join(docsRoot, pathname);
        try {
          const content = await fs.readFile(filePath);
          const ext = path.extname(pathname);
          res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
          res.end(content);
          return;
        } catch {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
      }

      // Map URL to markdown file
      if (pathname === "/") pathname = "/index.md";
      if (!pathname.endsWith(".md") && !pathname.endsWith("/")) pathname += ".md";
      if (pathname.endsWith("/")) pathname += "index.md";
      if (!pathname.endsWith(".md")) pathname += ".md";

      const mdPath = path.join(docsRoot, pathname);
      let markdown: string;
      try {
        markdown = await fs.readFile(mdPath, "utf-8");
      } catch {
        // Try without .md extension (e.g., /api/index)
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end(renderHTML("Not Found", "<h1>Page not found</h1><p><a href='/'>Back to home</a></p>", nav, customCss, pathname));
        return;
      }

      // Strip YAML frontmatter
      const fmMatch = markdown.match(/^---\n[\s\S]*?\n---\n/);
      let title = "DocWalk Preview";
      if (fmMatch) {
        const titleMatch = fmMatch[0].match(/title:\s*(.+)/);
        if (titleMatch) title = titleMatch[1].trim();
        markdown = markdown.slice(fmMatch[0].length);
      }

      // Convert markdown to HTML (basic but covers most cases)
      const bodyHtml = markdownToHtml(markdown);

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderHTML(title, bodyHtml, nav, customCss, pathname));
    } catch (err: any) {
      res.writeHead(500);
      res.end(`Server error: ${err.message}`);
    }
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      resolve(server);
    });
  });
}

/**
 * Parse navigation structure from mkdocs.yml (basic YAML nav parsing).
 */
async function parseNav(mkdocsPath: string, docsRoot: string): Promise<NavItem[]> {
  try {
    const content = await fs.readFile(mkdocsPath, "utf-8");
    // Find the nav: section
    const navMatch = content.match(/^nav:\s*\n((?:\s+-\s+.+\n?)+)/m);
    if (!navMatch) {
      return await buildNavFromFiles(docsRoot);
    }

    const items: NavItem[] = [];
    const lines = navMatch[1].split("\n").filter((l) => l.trim());

    for (const line of lines) {
      const match = line.match(/^\s+-\s+(?:(.+?):\s+)?(.+)$/);
      if (match) {
        const title = match[1] || formatTitle(match[2]);
        const filePath = match[2].trim();
        items.push({ title, path: "/" + filePath.replace(/\.md$/, "") });
      }
    }

    return items.length > 0 ? items : await buildNavFromFiles(docsRoot);
  } catch {
    return await buildNavFromFiles(docsRoot);
  }
}

/**
 * Build navigation from the docs directory structure.
 */
async function buildNavFromFiles(docsRoot: string): Promise<NavItem[]> {
  const items: NavItem[] = [];

  try {
    const entries = await fs.readdir(docsRoot, { withFileTypes: true });

    // index.md first
    if (entries.some((e) => e.name === "index.md")) {
      items.push({ title: "Home", path: "/" });
    }

    // Markdown files
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === "index.md") continue;
      if (entry.isFile() && entry.name.endsWith(".md")) {
        const name = entry.name.replace(/\.md$/, "");
        items.push({ title: formatTitle(name), path: "/" + name });
      }
    }

    // Directories (as sections)
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "stylesheets" && entry.name !== "javascripts") {
        const children: NavItem[] = [];
        const subEntries = await fs.readdir(path.join(docsRoot, entry.name), { withFileTypes: true });
        for (const sub of subEntries.sort((a, b) => a.name.localeCompare(b.name))) {
          if (sub.isFile() && sub.name.endsWith(".md")) {
            const name = sub.name.replace(/\.md$/, "");
            children.push({
              title: formatTitle(name),
              path: `/${entry.name}/${name}`,
            });
          }
        }
        if (children.length > 0) {
          items.push({ title: formatTitle(entry.name), path: "", children });
        }
      }
    }
  } catch {
    // Empty nav
  }

  return items;
}

function formatTitle(name: string): string {
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\.md$/, "");
}

/**
 * Basic markdown → HTML conversion.
 * Handles: headings, code blocks, inline code, bold, italic, links,
 * tables, lists, blockquotes, horizontal rules, and mermaid blocks.
 */
function markdownToHtml(md: string): string {
  let html = "";
  const lines = md.split("\n");
  let i = 0;
  let inList = false;
  let listType = "";

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code blocks (including mermaid)
    if (line.match(/^```(\w*)/)) {
      const lang = line.match(/^```(\w*)/)![1];
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```

      if (lang === "mermaid") {
        html += `<div class="mermaid">${escapeHtml(codeLines.join("\n"))}</div>\n`;
      } else {
        html += `<pre><code class="language-${lang || "text"}">${escapeHtml(codeLines.join("\n"))}</code></pre>\n`;
      }
      continue;
    }

    // Close list if we're no longer in one
    if (inList && !line.match(/^\s*[-*+]\s/) && !line.match(/^\s*\d+\.\s/) && line.trim() !== "") {
      html += listType === "ul" ? "</ul>\n" : "</ol>\n";
      inList = false;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = inlineFormat(headingMatch[2]);
      const id = headingMatch[2].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      html += `<h${level} id="${id}">${text}</h${level}>\n`;
      i++;
      continue;
    }

    // Horizontal rule
    if (line.match(/^(-{3,}|_{3,}|\*{3,})\s*$/)) {
      html += "<hr>\n";
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith("> ") || lines[i].startsWith(">"))) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      html += `<blockquote>${markdownToHtml(quoteLines.join("\n"))}</blockquote>\n`;
      continue;
    }

    // Admonition blocks (!!! type "title")
    const admonMatch = line.match(/^!!!\s+(\w+)\s*(?:"([^"]*)")?/);
    if (admonMatch) {
      const type = admonMatch[1];
      const title = admonMatch[2] || type.charAt(0).toUpperCase() + type.slice(1);
      const contentLines: string[] = [];
      i++;
      while (i < lines.length && (lines[i].startsWith("    ") || lines[i].trim() === "")) {
        contentLines.push(lines[i].replace(/^    /, ""));
        i++;
      }
      html += `<div class="admonition ${type}"><p class="admonition-title">${escapeHtml(title)}</p>${markdownToHtml(contentLines.join("\n"))}</div>\n`;
      continue;
    }

    // Tables
    if (line.includes("|") && i + 1 < lines.length && lines[i + 1].match(/^\|?\s*[-:]+/)) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      html += renderTable(tableLines);
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
    if (ulMatch) {
      if (!inList) {
        html += "<ul>\n";
        inList = true;
        listType = "ul";
      }
      html += `<li>${inlineFormat(ulMatch[2])}</li>\n`;
      i++;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)/);
    if (olMatch) {
      if (!inList) {
        html += "<ol>\n";
        inList = true;
        listType = "ol";
      }
      html += `<li>${inlineFormat(olMatch[2])}</li>\n`;
      i++;
      continue;
    }

    // Skip MkDocs Material specific blocks (grid cards, etc.)
    if (line.match(/^<div\s+class=.*markdown/)) {
      // Pass through HTML blocks
      const htmlLines: string[] = [line];
      i++;
      let depth = 1;
      while (i < lines.length && depth > 0) {
        if (lines[i].includes("<div")) depth++;
        if (lines[i].includes("</div>")) depth--;
        htmlLines.push(lines[i]);
        i++;
      }
      html += htmlLines.join("\n") + "\n";
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph
    html += `<p>${inlineFormat(line)}</p>\n`;
    i++;
  }

  if (inList) {
    html += listType === "ul" ? "</ul>\n" : "</ol>\n";
  }

  return html;
}

function renderTable(lines: string[]): string {
  const parseRow = (line: string) =>
    line.split("|").map((c) => c.trim()).filter((c) => c !== "");

  const headers = parseRow(lines[0]);
  // lines[1] is the separator
  const rows = lines.slice(2).map(parseRow);

  let html = "<table><thead><tr>";
  for (const h of headers) html += `<th>${inlineFormat(h)}</th>`;
  html += "</tr></thead><tbody>";
  for (const row of rows) {
    html += "<tr>";
    for (const cell of row) html += `<td>${inlineFormat(cell)}</td>`;
    html += "</tr>";
  }
  html += "</tbody></table>\n";
  return html;
}

function inlineFormat(text: string): string {
  return text
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Material icons (:material-xxx:)
    .replace(/:material-[\w-]+:\{[^}]*\}/g, "")
    .replace(/:material-[\w-]+:/g, "");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render the full HTML page with sidebar navigation, dark theme, and CDN assets.
 */
function renderHTML(title: string, body: string, nav: NavItem[], customCss: string, currentPath: string): string {
  const sidebar = renderNav(nav, currentPath);

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — DocWalk Preview</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/github-dark.min.css">
  <style>
    :root {
      --accent: #5de4c7;
      --bg: #1e1e2e;
      --bg-sidebar: #181825;
      --bg-content: #1e1e2e;
      --text: #cdd6f4;
      --text-muted: #a6adc8;
      --border: #313244;
      --link: #5de4c7;
      --code-bg: #11111b;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      min-height: 100vh;
    }
    .sidebar {
      width: 280px;
      background: var(--bg-sidebar);
      border-right: 1px solid var(--border);
      padding: 1.5rem 0;
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      overflow-y: auto;
    }
    .sidebar-header {
      padding: 0 1.5rem 1rem;
      border-bottom: 1px solid var(--border);
      margin-bottom: 1rem;
    }
    .sidebar-header h2 {
      font-size: 1rem;
      color: var(--accent);
      font-weight: 600;
    }
    .sidebar-header span {
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .sidebar nav a {
      display: block;
      padding: 0.4rem 1.5rem;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.875rem;
      border-left: 3px solid transparent;
    }
    .sidebar nav a:hover { color: var(--text); background: var(--border); }
    .sidebar nav a.active { color: var(--accent); border-left-color: var(--accent); background: rgba(93,228,199,0.05); }
    .sidebar nav .section-title {
      padding: 0.8rem 1.5rem 0.3rem;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 600;
    }
    .content {
      margin-left: 280px;
      flex: 1;
      max-width: 900px;
      padding: 2rem 3rem;
    }
    h1 { font-size: 2rem; margin: 1.5rem 0 1rem; color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    h2 { font-size: 1.5rem; margin: 2rem 0 0.75rem; color: var(--text); }
    h3 { font-size: 1.2rem; margin: 1.5rem 0 0.5rem; color: var(--text); }
    h4, h5, h6 { margin: 1rem 0 0.5rem; color: var(--text-muted); }
    p { margin: 0.5rem 0; line-height: 1.7; }
    a { color: var(--link); }
    code {
      font-family: 'Fira Code', 'JetBrains Mono', monospace;
      font-size: 0.875em;
      background: var(--code-bg);
      padding: 0.15em 0.4em;
      border-radius: 4px;
    }
    pre {
      background: var(--code-bg);
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1rem 0;
      border: 1px solid var(--border);
    }
    pre code { background: none; padding: 0; font-size: 0.85rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { padding: 0.6rem 1rem; text-align: left; border: 1px solid var(--border); }
    th { background: var(--code-bg); font-weight: 600; font-size: 0.875rem; }
    td { font-size: 0.875rem; }
    blockquote { border-left: 4px solid var(--accent); padding: 0.5rem 1rem; margin: 1rem 0; color: var(--text-muted); background: var(--code-bg); border-radius: 0 4px 4px 0; }
    hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }
    ul, ol { margin: 0.5rem 0; padding-left: 1.5rem; }
    li { margin: 0.25rem 0; line-height: 1.6; }
    img { max-width: 100%; border-radius: 8px; }
    .admonition {
      border-left: 4px solid var(--accent);
      background: var(--code-bg);
      padding: 1rem;
      margin: 1rem 0;
      border-radius: 0 4px 4px 0;
    }
    .admonition-title { font-weight: 600; margin-bottom: 0.5rem; }
    .admonition.warning, .admonition.caution { border-left-color: #f9e2af; }
    .admonition.danger, .admonition.error { border-left-color: #f38ba8; }
    .admonition.tip, .admonition.hint { border-left-color: #a6e3a1; }
    .admonition.note, .admonition.info { border-left-color: #89b4fa; }
    .mermaid { margin: 1rem 0; text-align: center; }
    ${customCss}
  </style>
</head>
<body>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h2>DocWalk Preview</h2>
      <span>Local dev server</span>
    </div>
    <nav>${sidebar}</nav>
  </aside>
  <main class="content">
    ${body}
  </main>
  <script src="https://cdn.jsdelivr.net/npm/highlight.js@11/highlight.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    hljs.highlightAll();
    mermaid.initialize({ theme: 'dark', startOnLoad: true });
  </script>
</body>
</html>`;
}

function renderNav(items: NavItem[], currentPath: string): string {
  let html = "";
  for (const item of items) {
    if (item.children) {
      html += `<div class="section-title">${escapeHtml(item.title)}</div>`;
      for (const child of item.children) {
        const href = child.path === "/" ? "/" : child.path;
        const active = currentPath.replace(/\.md$/, "").replace(/\/index$/, "/") === href ||
          currentPath === href + ".md" ? " active" : "";
        html += `<a href="${href}"${active ? ' class="active"' : ''}>${escapeHtml(child.title)}</a>`;
      }
    } else {
      const href = item.path === "/" ? "/" : item.path;
      const normalizedCurrent = currentPath === "/" || currentPath === "/index.md" || currentPath === "/index" ? "/" : currentPath.replace(/\.md$/, "");
      const active = normalizedCurrent === href ? " active" : "";
      html += `<a href="${href}"${active ? ' class="active"' : ''}>${escapeHtml(item.title)}</a>`;
    }
  }
  return html;
}
