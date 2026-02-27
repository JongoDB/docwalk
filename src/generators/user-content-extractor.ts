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
  return (
    pathLower.includes("cli/") ||
    pathLower.includes("commands/") ||
    pathLower.includes("bin/") ||
    pathLower.includes("cmd/")
  );
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

function extractCLICommands(mod: ModuleInfo): CLICommand[] {
  const commands: CLICommand[] = [];

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
        commands.push({
          name: sym.name.replace(/(?:command|cmd)$/i, "").replace(/^register/i, ""),
          description: sym.docs?.summary,
          filePath: mod.filePath,
          options: sym.parameters?.map((p) => p.name),
        });
      }
    }
  }

  // If no explicit commands found but it's a CLI module, treat exported functions as commands
  if (commands.length === 0) {
    const exported = mod.symbols.filter((s) => s.exported && s.kind === "function");
    for (const sym of exported) {
      commands.push({
        name: sym.name,
        description: sym.docs?.summary,
        filePath: mod.filePath,
        options: sym.parameters?.map((p) => p.name),
      });
    }
  }

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
        options.push({
          name: `${sym.name}.${child.name}`,
          type: child.typeAnnotation,
          description: child.docs?.summary,
          defaultValue: child.parameters?.[0]?.defaultValue,
          filePath: mod.filePath,
        });
      }

      // If no children but the symbol itself looks like a config schema
      if (children.length === 0 && sym.name.toLowerCase().includes("schema")) {
        options.push({
          name: sym.name,
          type: sym.typeAnnotation,
          description: sym.docs?.summary,
          filePath: mod.filePath,
        });
      }
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
