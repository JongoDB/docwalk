/**
 * Hooks Executor
 *
 * Runs lifecycle hook commands (pre/post analyze, build, deploy)
 * sequentially via the shell. Handles missing config gracefully.
 */

import type { HooksConfig } from "../config/schema.js";

export type HookName =
  | "pre_analyze"
  | "post_analyze"
  | "pre_build"
  | "post_build"
  | "pre_deploy"
  | "post_deploy";

export interface HookOptions {
  /** Working directory for hook commands */
  cwd?: string;
  /** Callback for command output */
  onOutput?: (line: string) => void;
}

/**
 * Execute a named lifecycle hook.
 *
 * Runs all commands for the given hook name sequentially.
 * No-ops if hooks config is missing, undefined, or empty.
 *
 * @param hookName - The hook to execute (e.g., "pre_build")
 * @param hooksConfig - The hooks configuration object (may be undefined)
 * @param options - Execution options (cwd, output callback)
 * @throws If any hook command exits with non-zero status
 */
export async function executeHooks(
  hookName: HookName,
  hooksConfig: HooksConfig | undefined,
  options: HookOptions = {}
): Promise<void> {
  if (!hooksConfig) return;

  const commands = hooksConfig[hookName];
  if (!commands || commands.length === 0) return;

  const { execa } = await import("execa");

  for (const command of commands) {
    try {
      // SECURITY: shell: true is intentional — user-defined hook commands need
      // shell features (pipes, env vars, glob expansion). However, this means
      // untrusted docwalk.config.yml files could execute arbitrary commands.
      // Only run hooks from config files you trust.
      const result = await execa(command, {
        shell: true,
        cwd: options.cwd,
        stdout: "pipe",
        stderr: "pipe",
      });

      if (result.stdout && options.onOutput) {
        for (const line of result.stdout.split("\n")) {
          options.onOutput(line);
        }
      }
    } catch (error) {
      const err = error as { message?: string; exitCode?: number };
      throw new Error(
        `Hook "${hookName}" failed on command: ${command}\n` +
          `Exit code: ${err.exitCode ?? "unknown"}\n` +
          `${err.message ?? ""}`
      );
    }
  }
}
