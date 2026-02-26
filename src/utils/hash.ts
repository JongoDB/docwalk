/**
 * Hash utilities for content fingerprinting and cache invalidation.
 */

import { createHash } from "crypto";

/**
 * Compute a SHA-256 hash of file content.
 * Used to detect content changes independent of timestamps.
 */
export function computeFileHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Compute a hash of multiple values (for composite cache keys).
 */
export function computeCompositeHash(...values: string[]): string {
  const hash = createHash("sha256");
  for (const value of values) {
    hash.update(value);
  }
  return hash.digest("hex").slice(0, 16);
}
