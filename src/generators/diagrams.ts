/**
 * Multi-Type Diagram Generation
 *
 * Generates class diagrams, sequence diagrams, and flowcharts
 * alongside existing dependency graphs.
 *
 * Static diagrams (class) are built from Symbol data.
 * AI-assisted diagrams (sequence, flow) use the LLM via context builder.
 */

import type { AnalysisManifest, ModuleInfo, Symbol, DiagramSuggestion } from "../analysis/types.js";
import type { AIProvider } from "../analysis/providers/base.js";
import { buildContext } from "../analysis/context-builder.js";
import { sanitizeMermaidId } from "./utils.js";

const MAX_DIAGRAM_NODES = 30;

/**
 * Generate a Mermaid class diagram from Symbol data.
 * Static — no AI required.
 */
export function generateClassDiagram(manifest: AnalysisManifest): string | undefined {
  const classSymbols: Array<{ sym: Symbol; filePath: string }> = [];

  for (const mod of manifest.modules) {
    for (const sym of mod.symbols) {
      if (
        sym.exported &&
        (sym.kind === "class" || sym.kind === "interface") &&
        (sym.extends || (sym.implements && sym.implements.length > 0) || (sym.children && sym.children.length > 0))
      ) {
        classSymbols.push({ sym, filePath: mod.filePath });
      }
    }
  }

  if (classSymbols.length === 0) return undefined;

  // Also include base classes/interfaces that are referenced but don't have
  // their own extends/implements/children (so they passed the filter above)
  const includedNames = new Set(classSymbols.map((c) => c.sym.name));
  const referencedNames = new Set<string>();
  for (const { sym } of classSymbols) {
    if (sym.extends) referencedNames.add(sym.extends);
    if (sym.implements) {
      for (const iface of sym.implements) referencedNames.add(iface);
    }
  }
  for (const mod of manifest.modules) {
    for (const sym of mod.symbols) {
      if (
        sym.exported &&
        (sym.kind === "class" || sym.kind === "interface") &&
        referencedNames.has(sym.name) &&
        !includedNames.has(sym.name)
      ) {
        classSymbols.push({ sym, filePath: mod.filePath });
      }
    }
  }

  // Limit to top N for readability
  const limited = classSymbols.slice(0, MAX_DIAGRAM_NODES);

  let mermaid = "classDiagram\n";

  // Collect all known class/interface names for relationship filtering
  const knownNames = new Set(limited.map((c) => c.sym.name));

  for (const { sym } of limited) {
    const id = sanitizeMermaidId(sym.name);

    // Find child symbols from the same module
    const parent = manifest.modules.find((m) =>
      m.symbols.some((s) => s.id === sym.id)
    );
    const children = parent
      ? parent.symbols.filter((s) => s.parentId === sym.id).slice(0, 10)
      : [];

    // Emit a single class block with annotation + members
    if (sym.kind === "interface" || children.length > 0) {
      mermaid += `  class ${id} {\n`;
      if (sym.kind === "interface") {
        mermaid += `    <<interface>>\n`;
      }
      for (const child of children) {
        const vis = child.visibility === "private" ? "-" :
          child.visibility === "protected" ? "#" : "+";
        if (child.kind === "method" || child.kind === "function") {
          mermaid += `    ${vis}${child.name}()\n`;
        } else {
          mermaid += `    ${vis}${child.name}\n`;
        }
      }
      mermaid += "  }\n";
    }

    // Inheritance
    if (sym.extends && knownNames.has(sym.extends)) {
      mermaid += `  ${sanitizeMermaidId(sym.extends)} <|-- ${id}\n`;
    }

    // Interface implementation
    if (sym.implements) {
      for (const iface of sym.implements) {
        if (knownNames.has(iface)) {
          mermaid += `  ${sanitizeMermaidId(iface)} <|.. ${id}\n`;
        }
      }
    }
  }

  return mermaid;
}

/**
 * Generate a class hierarchy diagram for a specific module.
 */
export function generateModuleClassDiagram(mod: ModuleInfo): string | undefined {
  const classSymbols = mod.symbols.filter(
    (s) => s.kind === "class" || s.kind === "interface"
  );

  if (classSymbols.length === 0) return undefined;

  let mermaid = "classDiagram\n";

  for (const sym of classSymbols) {
    const id = sanitizeMermaidId(sym.name);

    // Add members
    const children = mod.symbols.filter((s) => s.parentId === sym.id).slice(0, 10);

    // Emit a single class block with annotation + members
    if (sym.kind === "interface" || children.length > 0) {
      mermaid += `  class ${id} {\n`;
      if (sym.kind === "interface") {
        mermaid += `    <<interface>>\n`;
      }
      for (const child of children) {
        const vis = child.visibility === "private" ? "-" :
          child.visibility === "protected" ? "#" : "+";
        if (child.kind === "method" || child.kind === "function") {
          const params = child.parameters
            ? child.parameters.map((p) => `${p.name}`).join(", ")
            : "";
          mermaid += `    ${vis}${child.name}(${params})\n`;
        } else {
          mermaid += `    ${vis}${child.name}\n`;
        }
      }
      mermaid += "  }\n";
    }

    if (sym.extends) {
      mermaid += `  ${sanitizeMermaidId(sym.extends)} <|-- ${id}\n`;
    }

    if (sym.implements) {
      for (const iface of sym.implements) {
        mermaid += `  ${sanitizeMermaidId(iface)} <|.. ${id}\n`;
      }
    }
  }

  return mermaid;
}

/**
 * Generate an AI-assisted sequence diagram for a module or topic.
 */
export async function generateSequenceDiagram(
  provider: AIProvider,
  manifest: AnalysisManifest,
  readFile: (filePath: string) => Promise<string>,
  targetModule?: ModuleInfo,
  topic?: string
): Promise<DiagramSuggestion | undefined> {
  const contextChunks = await buildContext({
    targetModule,
    topic: topic || "main flow sequence",
    tokenBudget: 4000,
    manifest,
    readFile,
  });

  const contextText = contextChunks
    .map((c) => `--- ${c.filePath} ---\n${c.content}`)
    .join("\n\n");

  const prompt = `Based on the following source code, generate a Mermaid sequence diagram showing the main interaction flow between components.

SOURCE CODE:
${contextText}

INSTRUCTIONS:
1. Generate ONLY valid Mermaid sequenceDiagram syntax — no explanation, no markdown fences
2. Show 3-6 participants using descriptive aliases: \`participant A as ComponentName\`
3. Use actual function/method names from the code as message labels
4. Maximum 15 interactions total

MERMAID SYNTAX RULES (follow exactly):
- Start with \`sequenceDiagram\` on its own line
- Solid arrow for calls: \`A->>B: methodName()\`
- Dashed arrow for returns: \`B-->>A: result\`
- Solid arrow (no head) for async/fire-and-forget: \`A-)B: emit(event)\`
- Activation boxes: \`A->>+B: call()\` and \`B-->>-A: return\`
- Group related interactions: \`rect rgb(200, 220, 240)\` ... \`end\`
- Conditional flows: \`alt condition\` ... \`else other\` ... \`end\`
- Loops: \`loop description\` ... \`end\`
- Notes: \`Note over A,B: description\`
- Keep participant names short (1-3 words)
- Do NOT use HTML or special characters in labels`;

  try {
    const result = await provider.generate(prompt, {
      maxTokens: 1024,
      temperature: 0.2,
    });

    // Extract just the Mermaid code
    const mermaidCode = extractMermaidCode(result);
    if (mermaidCode && mermaidCode.startsWith("sequenceDiagram")) {
      return {
        type: "sequence",
        title: targetModule
          ? `Sequence: ${targetModule.filePath}`
          : "Sequence Diagram",
        mermaidCode,
      };
    }
  } catch {
    // AI failure — return nothing
  }

  return undefined;
}

/**
 * Generate an AI-assisted flowchart for a module or topic.
 */
export async function generateFlowchartDiagram(
  provider: AIProvider,
  manifest: AnalysisManifest,
  readFile: (filePath: string) => Promise<string>,
  targetModule?: ModuleInfo,
  topic?: string
): Promise<DiagramSuggestion | undefined> {
  const contextChunks = await buildContext({
    targetModule,
    topic: topic || "data flow pipeline",
    tokenBudget: 4000,
    manifest,
    readFile,
  });

  const contextText = contextChunks
    .map((c) => `--- ${c.filePath} ---\n${c.content}`)
    .join("\n\n");

  const prompt = `Based on the following source code, generate a Mermaid flowchart showing the main processing flow or data pipeline.

SOURCE CODE:
${contextText}

INSTRUCTIONS:
1. Generate ONLY valid Mermaid flowchart syntax — no explanation, no markdown fences
2. Show the main processing steps with decision points
3. Use actual function/class names from the code as labels
4. Maximum 15 nodes total

MERMAID SYNTAX RULES (follow exactly):
- MUST start with \`flowchart TD\` (top-down orientation, NEVER use LR)
- Rectangle nodes: \`A[Step Name]\`
- Rounded nodes: \`A(Process Name)\`
- Diamond decisions: \`A{Condition?}\`
- Stadium-shaped: \`A([Start/End])\`
- Arrows with labels: \`A -->|"yes"| B\`
- Group related nodes: \`subgraph Title\` ... \`end\`
- Keep labels to 3-4 words maximum per node
- Use lowercase IDs: \`a1\`, \`b2\`, \`c3\`
- Do NOT use special characters, HTML, or quotes inside node labels
- Do NOT use \`style\` or \`class\` directives`;

  try {
    const result = await provider.generate(prompt, {
      maxTokens: 1024,
      temperature: 0.2,
    });

    const mermaidCode = extractMermaidCode(result);
    if (mermaidCode && (mermaidCode.startsWith("flowchart") || mermaidCode.startsWith("graph"))) {
      return {
        type: "flowchart",
        title: targetModule
          ? `Flow: ${targetModule.filePath}`
          : "Processing Flow",
        mermaidCode,
      };
    }
  } catch {
    // AI failure — return nothing
  }

  return undefined;
}

const MERMAID_BLOCK_REGEX = /```(?:mermaid)?\n?([\s\S]*?)```/;

/**
 * Extract a single Mermaid code block from text.
 * Shared utility used by diagram generators and narrative engine.
 */
export function extractMermaidCode(text: string): string {
  const codeBlockMatch = text.match(MERMAID_BLOCK_REGEX);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  // Otherwise assume the entire response is Mermaid code
  return text.trim();
}

/**
 * Extract all Mermaid code blocks from text.
 * Returns an array of trimmed code strings.
 */
export function extractAllMermaidBlocks(text: string): string[] {
  const blocks: string[] = [];
  const globalRegex = new RegExp(MERMAID_BLOCK_REGEX.source, "g");
  let match;
  while ((match = globalRegex.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}
