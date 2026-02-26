#!/usr/bin/env node

/**
 * DocWalk CLI binary entry point.
 * This file is referenced in package.json "bin" and
 * simply bootstraps the CLI from the compiled source.
 */

import("../dist/cli/index.js").catch(() => {
  // If dist doesn't exist (dev mode), use tsx
  import("../src/cli/index.ts");
});
