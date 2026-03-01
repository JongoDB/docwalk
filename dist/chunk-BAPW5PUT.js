// src/utils/hash.ts
import { createHash } from "crypto";
function computeFileHash(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

// src/utils/index.ts
import path from "path";
function resolveRepoRoot(source) {
  if (source.provider !== "local") {
    return process.cwd();
  }
  const repo = source.repo;
  if (repo.includes("/") && !repo.startsWith(".") && !repo.startsWith("/")) {
    return process.cwd();
  }
  return path.resolve(repo);
}

export {
  computeFileHash,
  resolveRepoRoot
};
