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

import { readFile } from "fs/promises";
import { fileURLToPath } from "url";

/** Default AI proxy Q&A streaming endpoint */
const DEFAULT_QA_ENDPOINT = "https://docwalk-ai-proxy.jonathanrannabargar.workers.dev/v1/qa/stream";

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

  // Write widget CSS
  let css: string;
  try {
    const cssPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "widget.css"
    );
    css = await readFile(cssPath, "utf-8");
  } catch {
    css = `
#docwalk-qa-widget { --dw-accent: var(--md-accent-fg-color, #5de4c7); position: fixed; bottom: 20px; right: 20px; z-index: 9999; }
#docwalk-qa-widget #dw-qa-toggle { all: unset; width: 56px; height: 56px; border-radius: 50%; background: var(--dw-accent); cursor: pointer; display: flex; align-items: center; justify-content: center; }
#docwalk-qa-widget #dw-qa-panel { width: 400px; height: 520px; background: var(--md-default-bg-color, #16161a); border: 1px solid var(--md-default-fg-color--lightest, #2a2a32); border-radius: 12px; }
#docwalk-qa-widget #dw-qa-input { all: unset; box-sizing: border-box; flex: 1; padding: 10px 14px; border: 1px solid var(--md-default-fg-color--lightest, #2a2a32); border-radius: 8px; background: var(--md-default-bg-color, #16161a); color: var(--md-default-fg-color, #e8e6e3); font-size: 13px; }
#docwalk-qa-widget #dw-qa-send { all: unset; box-sizing: border-box; width: 38px; height: 38px; border-radius: 8px; background: var(--dw-accent); cursor: pointer; display: flex; align-items: center; justify-content: center; }
`;
  }
  await writeFile(path.join(assetsDir, "qa-widget.css"), css);

  return {
    extraCss: ["_docwalk/qa-widget.css"],
    extraJs: ["_docwalk/qa-widget.js"],
  };
}
