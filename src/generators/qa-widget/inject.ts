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

// The CSS is imported as a string at build time, or read from the file
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";

/**
 * Inject the Q&A widget assets into the docs output.
 */
export async function injectQAWidget(
  outputDir: string,
  config: NonNullable<AnalysisConfig["qa_config"]>,
  qaApiEndpoint: string
): Promise<{ extraCss: string[]; extraJs: string[] }> {
  const assetsDir = path.join(outputDir, "docs", "_docwalk");
  await mkdir(assetsDir, { recursive: true });

  // Generate and write widget JS
  const widgetJS = generateWidgetJS({
    apiEndpoint: qaApiEndpoint,
    position: config.position || "bottom-right",
    greeting: config.greeting || "Ask me anything about this project.",
    dailyLimit: config.daily_limit || 50,
  });
  await writeFile(path.join(assetsDir, "qa-widget.js"), widgetJS);

  // Write widget CSS
  // Read the CSS from the source file
  let css: string;
  try {
    const cssPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "widget.css"
    );
    css = await readFile(cssPath, "utf-8");
  } catch {
    // Fallback: inline minimal CSS
    css = `
#docwalk-qa-widget { position: fixed; bottom: 20px; right: 20px; z-index: 9999; }
#dw-qa-toggle { width: 56px; height: 56px; border-radius: 50%; background: #5de4c7; color: #0a0a0c; border: none; cursor: pointer; }
#dw-qa-panel { width: 380px; height: 500px; background: #16161a; border: 1px solid #2a2a32; border-radius: 12px; }
`;
  }
  await writeFile(path.join(assetsDir, "qa-widget.css"), css);

  return {
    extraCss: ["_docwalk/qa-widget.css"],
    extraJs: ["_docwalk/qa-widget.js"],
  };
}
