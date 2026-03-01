/**
 * User Content Extractor
 *
 * Extracts user-facing signals from the analysis manifest:
 * CLI commands, routes, components, config options, error types.
 * Used to generate end-user documentation.
 */

import type { AnalysisManifest, ModuleInfo, Symbol } from "../analysis/types.js";

export interface UserContentSignals {
  /** CLI commands found (commander/yargs/argparse patterns) */
  cliCommands: CLICommand[];
  /** HTTP routes (Express/Koa/Flask patterns) */
  routes: Route[];
  /** Config options (Zod schemas, typed config objects) */
  configOptions: ConfigOption[];
  /** Error types (classes extending Error) */
  errorTypes: ErrorType[];
  /** React/Vue/Svelte components */
  components: ComponentInfo[];
  /** README content if available */
  readmeContent?: string;
}

export interface CLICommand {
  name: string;
  description?: string;
  filePath: string;
  options?: string[];
}

export interface Route {
  method: string;
  path: string;
  description?: string;
  filePath: string;
}

export interface ConfigOption {
  name: string;
  type?: string;
  description?: string;
  defaultValue?: string;
  filePath: string;
}

export interface ErrorType {
  name: string;
  description?: string;
  filePath: string;
  extends?: string;
}

export interface ComponentInfo {
  name: string;
  description?: string;
  filePath: string;
  props?: string[];
}

/**
 * Extract user-facing content signals from the manifest.
 */
export function extractUserContent(manifest: AnalysisManifest): UserContentSignals {
  const signals: UserContentSignals = {
    cliCommands: [],
    routes: [],
    configOptions: [],
    errorTypes: [],
    components: [],
  };

  for (const mod of manifest.modules) {
    // Extract CLI commands from cli/, commands/, bin/ directories
    if (isCLIModule(mod)) {
      signals.cliCommands.push(...extractCLICommands(mod));
    }

    // Extract routes from routes/, controllers/, handlers/
    if (isRouteModule(mod)) {
      signals.routes.push(...extractRoutes(mod));
    }

    // Extract config options from config schemas
    if (isConfigModule(mod)) {
      signals.configOptions.push(...extractConfigOptions(mod));
    }

    // Extract error types
    signals.errorTypes.push(...extractErrorTypes(mod));

    // Extract components
    if (isComponentModule(mod)) {
      signals.components.push(...extractComponents(mod));
    }

    // Extract README content
    if (mod.filePath.toLowerCase().includes("readme")) {
      signals.readmeContent = mod.moduleDoc?.summary || mod.moduleDoc?.description;
    }
  }

  return signals;
}

function isCLIModule(mod: ModuleInfo): boolean {
  const pathLower = mod.filePath.toLowerCase();
  // Must be in a commands/ or bin/ directory — not just anywhere under cli/
  // This avoids internal utilities, flows, preview servers, etc.
  if (
    pathLower.includes("commands/") ||
    pathLower.includes("bin/") ||
    pathLower.includes("cmd/")
  ) {
    return true;
  }
  // Only match top-level cli/ files that look like command entry points
  if (pathLower.includes("cli/") && !pathLower.includes("flows/") && !pathLower.includes("utils/")) {
    // Only the index/entry file, not internal utilities
    const fileName = pathLower.split("/").pop() || "";
    return fileName === "index.ts" || fileName === "index.js" || fileName === "main.ts" || fileName === "main.js";
  }
  return false;
}

function isRouteModule(mod: ModuleInfo): boolean {
  const pathLower = mod.filePath.toLowerCase();
  return (
    pathLower.includes("routes/") ||
    pathLower.includes("controllers/") ||
    pathLower.includes("handlers/") ||
    pathLower.includes("endpoints/")
  );
}

function isConfigModule(mod: ModuleInfo): boolean {
  const pathLower = mod.filePath.toLowerCase();
  return (
    pathLower.includes("config") ||
    pathLower.includes("schema") ||
    pathLower.includes("settings")
  );
}

function isComponentModule(mod: ModuleInfo): boolean {
  const pathLower = mod.filePath.toLowerCase();
  return (
    pathLower.includes("components/") ||
    pathLower.includes("views/") ||
    pathLower.includes("widgets/") ||
    mod.filePath.endsWith(".tsx") ||
    mod.filePath.endsWith(".jsx") ||
    mod.filePath.endsWith(".vue") ||
    mod.filePath.endsWith(".svelte")
  );
}

/**
 * Convert camelCase to kebab-case for CLI-style command names.
 * e.g. "ciSetup" → "ci-setup", "versionList" → "version-list"
 */
function toKebabCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * Filter out generic/useless parameter names that don't help end users.
 */
function filterUsefulOptions(params?: string[]): string[] | undefined {
  if (!params) return undefined;
  const generic = new Set(["options", "opts", "args", "config", "ctx", "context", "req", "res", "next"]);
  const useful = params.filter((p) => !generic.has(p.toLowerCase()));
  return useful.length > 0 ? useful : undefined;
}

function extractCLICommands(mod: ModuleInfo): CLICommand[] {
  const commands: CLICommand[] = [];

  // Extract a useful description from the module doc.
  // Module descriptions often look like:
  //   "DocWalk CLI — generate command\nRuns the full analysis → generation pipeline: ..."
  // We want the part AFTER the first line (the header), which has the real description.
  const fullDesc = mod.moduleDoc?.description || "";
  const descLines = fullDesc.split("\n").map((l) => l.trim()).filter(Boolean);
  // Skip the first line if it's just a "CLI — command" header
  const headerPattern = /^[\w\s]+(?:CLI|cli)\s*[—–-]/i;
  const usefulLines = descLines.length > 1 && headerPattern.test(descLines[0])
    ? descLines.slice(1)
    : descLines;
  const cleanModuleDesc = usefulLines.join(" ").trim();

  for (const sym of mod.symbols) {
    if (
      sym.exported &&
      (sym.kind === "function" || sym.kind === "variable" || sym.kind === "constant")
    ) {
      // Look for commander-style command patterns
      if (
        sym.name.toLowerCase().includes("command") ||
        sym.name.toLowerCase().includes("cmd") ||
        sym.docs?.summary?.toLowerCase().includes("command")
      ) {
        const rawName = sym.name.replace(/(?:command|cmd)$/i, "").replace(/^register/i, "");
        const description = sym.docs?.summary || (cleanModuleDesc || undefined);
        commands.push({
          name: toKebabCase(rawName),
          description,
          filePath: mod.filePath,
          options: filterUsefulOptions(sym.parameters?.map((p) => p.name)),
        });
      }
    }
  }

  // Don't fall back to listing all exported functions — only extract explicit command patterns
  // This prevents internal helpers from being listed as user-facing commands

  return commands;
}

function extractRoutes(mod: ModuleInfo): Route[] {
  const routes: Route[] = [];

  for (const sym of mod.symbols) {
    // Look for HTTP method patterns in decorators or function names
    const methods = ["get", "post", "put", "delete", "patch"];
    const nameLower = sym.name.toLowerCase();

    for (const method of methods) {
      if (nameLower.startsWith(method) || sym.decorators?.some((d) => d.toLowerCase().includes(method))) {
        routes.push({
          method: method.toUpperCase(),
          path: `/${sym.name.replace(/^(get|post|put|delete|patch)/i, "").replace(/^[A-Z]/, (c) => c.toLowerCase()).replace(/([A-Z])/g, "/$1").toLowerCase()}`,
          description: sym.docs?.summary,
          filePath: mod.filePath,
        });
        break;
      }
    }
  }

  return routes;
}

function extractConfigOptions(mod: ModuleInfo): ConfigOption[] {
  const options: ConfigOption[] = [];

  for (const sym of mod.symbols) {
    if (
      sym.exported &&
      (sym.kind === "interface" || sym.kind === "type" || sym.kind === "constant")
    ) {
      // Extract properties from interfaces/types
      const children = mod.symbols.filter((s) => s.parentId === sym.id);
      for (const child of children) {
        // Only include options that have at least a type or description
        if (child.typeAnnotation || child.docs?.summary) {
          options.push({
            name: `${sym.name}.${child.name}`,
            type: child.typeAnnotation,
            description: child.docs?.summary,
            defaultValue: child.parameters?.[0]?.defaultValue,
            filePath: mod.filePath,
          });
        }
      }

      // Skip bare schema/constant names that have no children and no useful metadata —
      // these are typically Zod schemas that look like "SourceSchema" with no description
    }
  }

  return options;
}

function extractErrorTypes(mod: ModuleInfo): ErrorType[] {
  const errors: ErrorType[] = [];

  for (const sym of mod.symbols) {
    if (
      sym.kind === "class" &&
      (sym.extends === "Error" ||
        sym.extends?.endsWith("Error") ||
        sym.name.endsWith("Error") ||
        sym.name.endsWith("Exception"))
    ) {
      errors.push({
        name: sym.name,
        description: sym.docs?.summary,
        filePath: mod.filePath,
        extends: sym.extends,
      });
    }
  }

  return errors;
}

function extractComponents(mod: ModuleInfo): ComponentInfo[] {
  const components: ComponentInfo[] = [];

  for (const sym of mod.symbols) {
    if (
      sym.exported &&
      (sym.kind === "component" ||
        sym.kind === "function" ||
        sym.kind === "class") &&
      // Heuristic: PascalCase names in component directories are likely components
      /^[A-Z]/.test(sym.name)
    ) {
      components.push({
        name: sym.name,
        description: sym.docs?.summary,
        filePath: mod.filePath,
        props: sym.parameters?.map((p) => p.name),
      });
    }
  }

  return components;
}
