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
#docwalk-qa-widget { position: fixed; bottom: 20px; right: 20px; z-index: 9999; }
#dw-qa-toggle { width: 56px; height: 56px; border-radius: 50%; background: #5de4c7; color: #0a0a0c; border: none; cursor: pointer; }
#dw-qa-panel { width: 400px; height: 520px; background: #16161a; border: 1px solid #2a2a32; border-radius: 12px; }
`;
  }
  await writeFile(path.join(assetsDir, "qa-widget.css"), css);

  return {
    extraCss: ["_docwalk/qa-widget.css"],
    extraJs: ["_docwalk/qa-widget.js"],
  };
}
