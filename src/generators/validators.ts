/**
 * Post-Generation Content Validators
 *
 * Cleans and validates AI-generated narrative prose before
 * it's inserted into documentation pages.
 */

export interface ValidateProseOptions {
  /** Strip H1 headings from prose (module narratives shouldn't have headings) */
  expectNoH1?: boolean;
}

export interface ValidateProseResult {
  /** Whether the prose meets minimum quality thresholds */
  valid: boolean;
  /** Warnings about issues that were auto-fixed */
  warnings: string[];
  /** Cleaned prose content */
  prose: string;
}

/** Patterns that indicate template artifacts left by the LLM */
const TEMPLATE_ARTIFACT_PATTERNS = [
  /^.*YOUR_.*$/gm,
  /^.*TODO:.*$/gm,
  /^.*PLACEHOLDER.*$/gm,
  /^.*\[INSERT.*$/gm,
  /^.*\{\{.*\}\}.*$/gm,
];

/** Minimum character thresholds by page kind */
const MIN_LENGTH: Record<string, number> = {
  overview: 200,
  architecture: 200,
  module: 100,
  "getting-started": 200,
  concept: 100,
};

/**
 * Validate and clean AI-generated narrative prose.
 * Strips template artifacts, enforces minimum length, and optionally removes H1 headings.
 */
export function validateNarrativeProse(
  prose: string,
  kind: string,
  options?: ValidateProseOptions
): ValidateProseResult {
  const warnings: string[] = [];
  let cleaned = prose;

  // Strip template artifacts
  for (const pattern of TEMPLATE_ARTIFACT_PATTERNS) {
    const before = cleaned;
    cleaned = cleaned.replace(pattern, "");
    if (cleaned !== before) {
      warnings.push(`Stripped template artifact matching ${pattern.source}`);
    }
  }

  // Strip H1 headings if requested (module narratives say "Do NOT include headings")
  if (options?.expectNoH1) {
    const h1Pattern = /^# .+$/gm;
    const before = cleaned;
    cleaned = cleaned.replace(h1Pattern, "");
    if (cleaned !== before) {
      warnings.push("Stripped H1 heading from narrative prose");
    }
  }

  // Clean up resulting double blank lines
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  // Check minimum length
  const minLength = MIN_LENGTH[kind] ?? 100;
  const valid = cleaned.length >= minLength;
  if (!valid) {
    warnings.push(`Prose too short: ${cleaned.length} chars (minimum ${minLength} for ${kind})`);
  }

  return { valid, warnings, prose: cleaned };
}
