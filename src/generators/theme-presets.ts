/**
 * Theme Preset Definitions
 *
 * Provides styled presets so generated docs look polished out of the box.
 * Each preset defines colors, fonts, Material features, and custom CSS.
 */

export interface ThemePreset {
  id: string;
  name: string;
  palette: {
    scheme: string;
    primary: string;
    accent: string;
    toggleScheme?: string;
  };
  cssVars: Record<string, string>;
  features: string[];
  fonts: {
    text: string;
    code: string;
  };
  customCss: string;
}

export const THEME_PRESETS: Record<string, ThemePreset> = {
  corporate: {
    id: "corporate",
    name: "Corporate",
    palette: {
      scheme: "default",
      primary: "#1a237e",
      accent: "#0277bd",
    },
    cssVars: {
      "--md-primary-fg-color": "#1a237e",
      "--md-primary-fg-color--light": "#534bae",
      "--md-primary-fg-color--dark": "#000051",
      "--md-accent-fg-color": "#0277bd",
      "--md-accent-fg-color--transparent": "rgba(2, 119, 189, 0.1)",
    },
    features: [
      "navigation.tabs",
      "navigation.sections",
      "navigation.top",
      "search.suggest",
      "search.highlight",
      "content.code.copy",
      "content.tabs.link",
      "navigation.footer",
    ],
    fonts: {
      text: "Roboto",
      code: "Roboto Mono",
    },
    customCss: `/* Corporate Preset — Clean, professional, B2B */
:root {
  --md-primary-fg-color: #1a237e;
  --md-primary-fg-color--light: #534bae;
  --md-primary-fg-color--dark: #000051;
  --md-accent-fg-color: #0277bd;
  --md-accent-fg-color--transparent: rgba(2, 119, 189, 0.1);
}

.md-header {
  background: linear-gradient(135deg, #1a237e, #0d47a1);
}

.md-tabs {
  background-color: #0d47a1;
}

.md-typeset h1,
.md-typeset h2 {
  font-weight: 600;
  letter-spacing: -0.02em;
}

.md-typeset code {
  border-radius: 4px;
}

.md-typeset .admonition,
.md-typeset details {
  border-radius: 6px;
}

.md-content {
  max-width: 52rem;
}

.md-typeset table:not([class]) th {
  background-color: #e8eaf6;
  color: #1a237e;
}

[data-md-color-scheme="slate"] .md-typeset table:not([class]) th {
  background-color: #283593;
  color: #e8eaf6;
}
`,
  },

  startup: {
    id: "startup",
    name: "Startup",
    palette: {
      scheme: "default",
      primary: "#7c3aed",
      accent: "#f59e0b",
      toggleScheme: "slate",
    },
    cssVars: {
      "--md-primary-fg-color": "#7c3aed",
      "--md-primary-fg-color--light": "#a78bfa",
      "--md-primary-fg-color--dark": "#5b21b6",
      "--md-accent-fg-color": "#f59e0b",
      "--md-accent-fg-color--transparent": "rgba(245, 158, 11, 0.1)",
    },
    features: [
      "navigation.tabs",
      "navigation.sections",
      "navigation.expand",
      "navigation.top",
      "search.suggest",
      "search.highlight",
      "content.code.copy",
      "content.code.annotate",
      "content.tabs.link",
      "navigation.instant",
      "navigation.footer",
    ],
    fonts: {
      text: "Inter",
      code: "Fira Code",
    },
    customCss: `/* Startup Preset — Vibrant, modern, energetic */
:root {
  --md-primary-fg-color: #7c3aed;
  --md-primary-fg-color--light: #a78bfa;
  --md-primary-fg-color--dark: #5b21b6;
  --md-accent-fg-color: #f59e0b;
  --md-accent-fg-color--transparent: rgba(245, 158, 11, 0.1);
}

.md-header {
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
}

.md-tabs {
  background-color: #6d28d9;
}

.md-typeset h1 {
  font-weight: 700;
  letter-spacing: -0.03em;
}

.md-typeset a {
  color: #7c3aed;
}

.md-typeset a:hover {
  color: #f59e0b;
}

.md-typeset code {
  border-radius: 6px;
  font-variant-ligatures: common-ligatures;
}

.md-typeset .admonition,
.md-typeset details {
  border-radius: 8px;
  border-left-width: 4px;
}

.md-typeset .admonition.note,
.md-typeset details.note {
  border-color: #7c3aed;
}

.md-content {
  max-width: 54rem;
}

[data-md-color-scheme="slate"] {
  --md-primary-fg-color: #a78bfa;
  --md-accent-fg-color: #fbbf24;
}
`,
  },

  developer: {
    id: "developer",
    name: "Developer",
    palette: {
      scheme: "slate",
      primary: "#5de4c7",
      accent: "#add7ff",
      toggleScheme: "default",
    },
    cssVars: {
      "--md-primary-fg-color": "#5de4c7",
      "--md-primary-fg-color--light": "#89f0d6",
      "--md-primary-fg-color--dark": "#32d4a9",
      "--md-accent-fg-color": "#add7ff",
      "--md-accent-fg-color--transparent": "rgba(173, 215, 255, 0.1)",
    },
    features: [
      "navigation.tabs",
      "navigation.sections",
      "navigation.expand",
      "navigation.top",
      "search.suggest",
      "search.highlight",
      "content.code.copy",
      "content.code.annotate",
      "content.tabs.link",
      "navigation.instant",
      "navigation.footer",
    ],
    fonts: {
      text: "Inter",
      code: "Fira Code",
    },
    customCss: `/* Developer Preset — Professional technical documentation */
:root {
  --md-primary-fg-color: #5de4c7;
  --md-primary-fg-color--light: #89f0d6;
  --md-primary-fg-color--dark: #32d4a9;
  --md-accent-fg-color: #add7ff;
  --md-accent-fg-color--transparent: rgba(173, 215, 255, 0.1);
}

[data-md-color-scheme="slate"] {
  --md-default-bg-color: #171921;
  --md-default-bg-color--light: #1e2028;
  --md-default-fg-color: #d6d6da;
  --md-default-fg-color--light: #a0a0a8;
  --md-code-bg-color: #12141c;
  --md-code-fg-color: #d6d6da;
  --md-typeset-a-color: #89d4f5;
}

/* ── Header & Navigation ── */
.md-header {
  background-color: #12141c;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.2);
}

.md-tabs {
  background-color: #12141c;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

/* ── Typography ── */
.md-typeset {
  font-size: 0.82rem;
  line-height: 1.75;
}

.md-typeset h1 {
  font-weight: 700;
  font-size: 2em;
  letter-spacing: -0.02em;
  margin-bottom: 0.8em;
}

.md-typeset h2 {
  font-weight: 600;
  font-size: 1.5em;
  letter-spacing: -0.01em;
  margin-top: 2.5em;
  padding-bottom: 0.4em;
}

[data-md-color-scheme="slate"] .md-typeset h2 {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.md-typeset h3 {
  font-weight: 600;
  font-size: 1.2em;
  margin-top: 1.8em;
}

[data-md-color-scheme="slate"] .md-typeset h1 {
  color: #e8e8ec;
}

[data-md-color-scheme="slate"] .md-typeset h2 {
  color: #d0d0d6;
}

[data-md-color-scheme="slate"] .md-typeset h3,
[data-md-color-scheme="slate"] .md-typeset h4 {
  color: #b8b8c0;
}

/* ── Code ── */
.md-typeset code {
  border-radius: 4px;
  font-size: 0.84em;
  padding: 0.1em 0.4em;
}

[data-md-color-scheme="slate"] .md-typeset code {
  background-color: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.md-typeset pre > code {
  font-size: 0.82em;
  line-height: 1.65;
  border: none;
}

[data-md-color-scheme="slate"] .md-typeset pre {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
}

/* ── Admonitions ── */
.md-typeset .admonition,
.md-typeset details {
  border-radius: 6px;
  border-left-width: 3px;
  font-size: 0.82rem;
}

.md-typeset .admonition .admonition-title,
.md-typeset details summary {
  font-weight: 600;
}

/* ── Tables ── */
.md-typeset table:not([class]) {
  font-size: 0.82rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  overflow: hidden;
}

[data-md-color-scheme="slate"] .md-typeset table:not([class]) th {
  background-color: rgba(255, 255, 255, 0.04);
  font-weight: 600;
  color: #d0d0d6;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

[data-md-color-scheme="slate"] .md-typeset table:not([class]) td {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

/* ── Sidebar ── */
[data-md-color-scheme="slate"] .md-sidebar {
  border-right: 1px solid rgba(255, 255, 255, 0.04);
}

.md-nav__link {
  font-size: 0.72rem;
}

/* ── Content Width ── */
.md-content {
  max-width: 54rem;
}

/* ── Light Mode Overrides ── */
[data-md-color-scheme="default"] {
  --md-primary-fg-color: #0f766e;
  --md-primary-fg-color--light: #14b8a6;
  --md-primary-fg-color--dark: #0d5d56;
  --md-accent-fg-color: #2563eb;
}

[data-md-color-scheme="default"] .md-header {
  background-color: #0f766e;
  border-bottom: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

[data-md-color-scheme="default"] .md-tabs {
  background-color: #0d6d66;
  border-bottom: none;
}

[data-md-color-scheme="default"] .md-typeset h2 {
  border-bottom: 1px solid #e5e7eb;
}

[data-md-color-scheme="default"] .md-typeset table:not([class]) {
  border: 1px solid #e5e7eb;
}

[data-md-color-scheme="default"] .md-typeset table:not([class]) th {
  background-color: #f3f4f6;
  border-bottom: 1px solid #d1d5db;
}

[data-md-color-scheme="default"] .md-typeset table:not([class]) td {
  border-bottom: 1px solid #e5e7eb;
}

/* ── Footer ── */
.md-footer {
  margin-top: 3rem;
}

[data-md-color-scheme="slate"] .md-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
`,
  },

  minimal: {
    id: "minimal",
    name: "Minimal",
    palette: {
      scheme: "default",
      primary: "#374151",
      accent: "#6b7280",
    },
    cssVars: {
      "--md-primary-fg-color": "#374151",
      "--md-primary-fg-color--light": "#6b7280",
      "--md-primary-fg-color--dark": "#1f2937",
      "--md-accent-fg-color": "#6b7280",
      "--md-accent-fg-color--transparent": "rgba(107, 114, 128, 0.1)",
    },
    features: [
      "navigation.sections",
      "navigation.top",
      "search.suggest",
      "search.highlight",
      "content.code.copy",
      "content.tabs.link",
    ],
    fonts: {
      text: "Source Serif 4",
      code: "Source Code Pro",
    },
    customCss: `/* Minimal Preset — Reading-focused, distraction-free */
:root {
  --md-primary-fg-color: #374151;
  --md-primary-fg-color--light: #6b7280;
  --md-primary-fg-color--dark: #1f2937;
  --md-accent-fg-color: #6b7280;
  --md-accent-fg-color--transparent: rgba(107, 114, 128, 0.1);
}

.md-header {
  background-color: #f9fafb;
  color: #374151;
  box-shadow: 0 1px 0 #e5e7eb;
}

[data-md-color-scheme="default"] .md-header .md-header__title {
  color: #374151;
}

[data-md-color-scheme="default"] .md-header .md-logo {
  color: #374151;
}

[data-md-color-scheme="default"] .md-tabs {
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.md-typeset {
  font-size: 1.05rem;
  line-height: 1.75;
}

.md-typeset h1 {
  font-weight: 700;
  letter-spacing: -0.03em;
}

.md-typeset h2 {
  font-weight: 600;
  margin-top: 2.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.md-typeset code {
  border-radius: 3px;
  font-size: 0.85em;
}

.md-typeset .admonition,
.md-typeset details {
  border-radius: 4px;
  box-shadow: none;
}

.md-content {
  max-width: 46rem;
  margin: 0 auto;
}

.md-sidebar--secondary {
  display: none;
}
`,
  },
};

/**
 * Resolve a preset by ID. Returns undefined for "custom" or unknown IDs.
 */
export function resolvePreset(presetId: string): ThemePreset | undefined {
  if (presetId === "custom") return undefined;
  return THEME_PRESETS[presetId];
}

/**
 * Get all available preset IDs.
 */
export function getPresetIds(): string[] {
  return Object.keys(THEME_PRESETS);
}
