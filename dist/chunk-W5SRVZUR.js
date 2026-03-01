// src/utils/hooks.ts
async function executeHooks(hookName, hooksConfig, options = {}) {
  if (!hooksConfig) return;
  const commands = hooksConfig[hookName];
  if (!commands || commands.length === 0) return;
  const { execa } = await import("execa");
  for (const command of commands) {
    try {
      const result = await execa(command, {
        shell: true,
        cwd: options.cwd,
        stdout: "pipe",
        stderr: "pipe"
      });
      if (result.stdout && options.onOutput) {
        for (const line of result.stdout.split("\n")) {
          options.onOutput(line);
        }
      }
    } catch (error) {
      const err = error;
      throw new Error(
        `Hook "${hookName}" failed on command: ${command}
Exit code: ${err.exitCode ?? "unknown"}
${err.message ?? ""}`
      );
    }
  }
}

export {
  executeHooks
};
