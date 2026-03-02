/**
 * Q&A Widget Injector
 *
 * Adds widget JS/CSS to the MkDocs output directory
 * and configures mkdocs.yml to include them.
 */

import { writeFile, mkdir } from "fs/promises";
import path from "path";
import type { AnalysisConfig } from "../../config/schema.js";
import { generateWidgetJS } from "./widget.js";

/** Default AI proxy Q&A streaming endpoint */
const DEFAULT_QA_ENDPOINT = "https://docwalk-ai-proxy.jonathanrannabargar.workers.dev/v1/qa/stream";

/**
 * Full widget CSS, embedded to avoid runtime file-path issues when
 * running from compiled dist/ (import.meta.url points to dist/, not src/).
 *
 * Uses MkDocs Material CSS variables for automatic theme integration.
 */
const WIDGET_CSS = `/* DocWalk Q&A Widget */

#docwalk-qa-widget {
  --dw-accent: var(--md-accent-fg-color, #5de4c7);
  --dw-accent-t: var(--md-accent-fg-color--transparent, rgba(93,228,199,0.1));
  --dw-bg: var(--md-default-bg-color, #16161a);
  --dw-bg-alt: var(--md-code-bg-color, #1c1c22);
  --dw-fg: var(--md-default-fg-color, #e8e6e3);
  --dw-fg-muted: var(--md-default-fg-color--light, #6a6a6e);
  --dw-border: var(--md-default-fg-color--lightest, #2a2a32);
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.5;
}

/* Toggle button */
#docwalk-qa-widget #dw-qa-toggle {
  all: unset;
  box-sizing: border-box;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--dw-accent);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  transition: transform 0.2s, box-shadow 0.2s;
}
#docwalk-qa-widget #dw-qa-toggle svg { filter: brightness(0); }
#docwalk-qa-widget #dw-qa-toggle:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 24px rgba(0,0,0,0.35);
}

/* Panel */
#docwalk-qa-widget #dw-qa-panel {
  display: none;
  flex-direction: column;
  width: 400px;
  max-width: calc(100vw - 40px);
  height: 520px;
  max-height: calc(100vh - 100px);
  background: var(--dw-bg);
  border: 1px solid var(--dw-border);
  border-radius: 12px;
  box-shadow: 0 8px 48px rgba(0,0,0,0.35);
  overflow: hidden;
  color: var(--dw-fg);
}

/* Header */
#docwalk-qa-widget #dw-qa-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--dw-bg-alt);
  border-bottom: 1px solid var(--dw-border);
}
#docwalk-qa-widget .dw-qa-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--dw-fg);
  letter-spacing: -0.01em;
}
#docwalk-qa-widget .dw-qa-header-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}
#docwalk-qa-widget #dw-qa-new,
#docwalk-qa-widget #dw-qa-close {
  all: unset;
  box-sizing: border-box;
  color: var(--dw-fg-muted);
  cursor: pointer;
  font-size: 18px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
}
#docwalk-qa-widget #dw-qa-new:hover,
#docwalk-qa-widget #dw-qa-close:hover {
  color: var(--dw-fg);
  background: var(--dw-accent-t);
}

/* Messages */
#docwalk-qa-widget #dw-qa-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
#docwalk-qa-widget .dw-qa-msg {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13.5px;
  line-height: 1.65;
  max-width: 88%;
  word-wrap: break-word;
  animation: dw-qa-fadein 0.2s ease;
}
@keyframes dw-qa-fadein {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
#docwalk-qa-widget .dw-qa-user {
  background: var(--dw-accent);
  color: #000;
  align-self: flex-end;
  border-bottom-right-radius: 4px;
  font-weight: 500;
}
#docwalk-qa-widget .dw-qa-bot {
  background: var(--dw-bg-alt);
  color: var(--dw-fg);
  align-self: flex-start;
  border-bottom-left-radius: 4px;
  border: 1px solid var(--dw-border);
}
#docwalk-qa-widget .dw-qa-bot strong { color: var(--dw-fg); }
#docwalk-qa-widget .dw-qa-bot a { color: var(--dw-accent); text-decoration: none; }
#docwalk-qa-widget .dw-qa-bot a:hover { text-decoration: underline; }

/* Streaming cursor */
#docwalk-qa-widget .dw-qa-streaming .dw-qa-cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  background: var(--dw-accent);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: dw-qa-blink 0.8s infinite;
}
@keyframes dw-qa-blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* Error */
#docwalk-qa-widget .dw-qa-error {
  border-color: #ef4444 !important;
  color: #fca5a5 !important;
}

/* Code in bot messages */
#docwalk-qa-widget .dw-qa-code {
  background: var(--md-code-bg-color, #111115);
  border: 1px solid var(--dw-border);
  border-radius: 8px;
  padding: 10px 12px;
  margin: 8px 0;
  font-family: var(--md-code-font-family, 'Fira Code', monospace);
  font-size: 12px;
  overflow-x: auto;
  white-space: pre;
  color: var(--dw-fg);
}
#docwalk-qa-widget .dw-qa-inline-code {
  background: var(--dw-accent-t);
  color: var(--dw-accent);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--md-code-font-family, 'Fira Code', monospace);
  font-size: 0.88em;
}

/* Citations */
#docwalk-qa-widget .dw-qa-citations {
  padding: 8px 14px;
  font-size: 11.5px;
  color: var(--dw-fg-muted);
  animation: dw-qa-fadein 0.3s ease;
}
#docwalk-qa-widget .dw-qa-citations-label {
  font-weight: 600;
  color: var(--dw-fg);
}
#docwalk-qa-widget .dw-qa-citation-link {
  color: var(--dw-accent);
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.15s;
}
#docwalk-qa-widget .dw-qa-citation-link:hover {
  opacity: 1;
  text-decoration: underline;
}

/* Input area */
#docwalk-qa-widget #dw-qa-input-area {
  display: flex;
  padding: 12px;
  gap: 8px;
  border-top: 1px solid var(--dw-border);
  background: var(--dw-bg-alt);
  align-items: center;
}
#docwalk-qa-widget #dw-qa-input {
  all: unset;
  box-sizing: border-box;
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--dw-border);
  border-radius: 8px;
  background: var(--dw-bg);
  color: var(--dw-fg);
  font-size: 13.5px;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
  min-width: 0;
}
#docwalk-qa-widget #dw-qa-input:focus {
  border-color: var(--dw-accent);
  box-shadow: 0 0 0 2px var(--dw-accent-t);
}
#docwalk-qa-widget #dw-qa-input::placeholder {
  color: var(--dw-fg-muted);
}
#docwalk-qa-widget #dw-qa-input:disabled {
  opacity: 0.5;
}
#docwalk-qa-widget #dw-qa-send {
  all: unset;
  box-sizing: border-box;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: var(--dw-accent);
  color: #000;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s, transform 0.15s;
  flex-shrink: 0;
}
#docwalk-qa-widget #dw-qa-send:hover {
  opacity: 0.85;
  transform: scale(1.04);
}
#docwalk-qa-widget #dw-qa-send:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  transform: none;
}

/* Scrollbar */
#docwalk-qa-widget #dw-qa-messages::-webkit-scrollbar { width: 4px; }
#docwalk-qa-widget #dw-qa-messages::-webkit-scrollbar-track { background: transparent; }
#docwalk-qa-widget #dw-qa-messages::-webkit-scrollbar-thumb {
  background: var(--dw-border);
  border-radius: 2px;
}

/* Mobile */
@media (max-width: 480px) {
  #docwalk-qa-widget { bottom: 10px; right: 10px; left: 10px; }
  #docwalk-qa-widget #dw-qa-panel {
    width: calc(100vw - 20px);
    height: calc(100vh - 80px);
    position: fixed;
    bottom: 10px;
    right: 10px;
    left: 10px;
  }
  #docwalk-qa-widget #dw-qa-toggle { width: 48px; height: 48px; }
}`;

/**
 * Inject the Q&A widget assets into the docs output.
 */
export async function injectQAWidget(
  outputDir: string,
  config: NonNullable<AnalysisConfig["qa_config"]>,
  qaApiEndpoint?: string
): Promise<{ extraCss: string[]; extraJs: string[] }> {
  const assetsDir = path.join(outputDir, "docs", "_docwalk");
  await mkdir(assetsDir, { recursive: true });

  // Generate and write widget JS
  const widgetJS = generateWidgetJS({
    apiEndpoint: qaApiEndpoint || DEFAULT_QA_ENDPOINT,
    searchIndexUrl: "_docwalk/qa-search.json",
    position: config.position || "bottom-right",
    greeting: config.greeting || "Ask me anything about this project.",
    dailyLimit: config.daily_limit || 50,
    mode: "client",
  });
  await writeFile(path.join(assetsDir, "qa-widget.js"), widgetJS);

  // Write embedded CSS (no file I/O — always available)
  await writeFile(path.join(assetsDir, "qa-widget.css"), WIDGET_CSS);

  return {
    extraCss: ["_docwalk/qa-widget.css"],
    extraJs: ["_docwalk/qa-widget.js"],
  };
}
