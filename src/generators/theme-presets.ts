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
  customJs?: string;
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
      "navigation.instant.prefetch",
      "navigation.instant.progress",
      "navigation.path",
      "navigation.tracking",
      "navigation.prune",
      "navigation.footer",
      "header.autohide",
      "content.code.select",
      "content.tooltips",
      "content.footnote.tooltips",
      "announce.dismiss",
    ],
    fonts: {
      text: "Inter",
      code: "Fira Code",
    },
    customCss: `/* Developer Preset — Premium technical documentation */

/* ── Design Tokens ── */
:root {
  --md-primary-fg-color: #5de4c7;
  --md-primary-fg-color--light: #89f0d6;
  --md-primary-fg-color--dark: #32d4a9;
  --md-accent-fg-color: #add7ff;
  --md-accent-fg-color--transparent: rgba(173, 215, 255, 0.1);
  --dw-glow-sm: 0 0 8px rgba(93, 228, 199, 0.15);
  --dw-glow-md: 0 0 20px rgba(93, 228, 199, 0.12);
  --dw-glow-lg: 0 4px 30px rgba(93, 228, 199, 0.10);
  --dw-card-bg: rgba(255, 255, 255, 0.03);
  --dw-card-border: rgba(255, 255, 255, 0.06);
  --dw-card-hover-border: rgba(93, 228, 199, 0.3);
  --dw-card-hover-bg: rgba(255, 255, 255, 0.05);
  --dw-gradient-accent: linear-gradient(135deg, #5de4c7, #add7ff);
  --dw-transition-fast: 0.15s ease;
  --dw-transition-base: 0.25s ease;
  --dw-transition-slow: 0.4s ease;
  --dw-radius-sm: 4px;
  --dw-radius-md: 8px;
  --dw-radius-lg: 12px;
  --dw-shadow-card: 0 2px 8px rgba(0, 0, 0, 0.12);
  --dw-shadow-card-hover: 0 8px 24px rgba(0, 0, 0, 0.18);
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

/* ── Hero heading: gradient text on first h1 ── */
.md-typeset h1 {
  font-weight: 800;
  font-size: 2.2em;
  letter-spacing: -0.03em;
  margin-bottom: 0.8em;
}

[data-md-color-scheme="slate"] .md-content > .md-typeset > h1:first-child,
[data-md-color-scheme="slate"] .md-typeset > h1:first-of-type {
  background: var(--dw-gradient-accent);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
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

/* ── Custom Scrollbar ── */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
[data-md-color-scheme="default"] ::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
}
[data-md-color-scheme="default"] ::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}

/* ── Card Grids (Glassmorphism) ── */
.md-typeset .grid.cards > ol > li,
.md-typeset .grid.cards > ul > li,
.md-typeset .grid > .card {
  background: var(--dw-card-bg);
  border: 1px solid var(--dw-card-border);
  border-radius: var(--dw-radius-lg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: var(--dw-shadow-card);
  transition: transform var(--dw-transition-base),
              box-shadow var(--dw-transition-base),
              border-color var(--dw-transition-base),
              background var(--dw-transition-base);
  padding: 1rem 1.2rem;
}
.md-typeset .grid.cards > ol > li:hover,
.md-typeset .grid.cards > ul > li:hover,
.md-typeset .grid > .card:hover {
  transform: translateY(-3px);
  box-shadow: var(--dw-shadow-card-hover), var(--dw-glow-md);
  border-color: var(--dw-card-hover-border);
  background: var(--dw-card-hover-bg);
}
[data-md-color-scheme="default"] .md-typeset .grid.cards > ol > li,
[data-md-color-scheme="default"] .md-typeset .grid.cards > ul > li,
[data-md-color-scheme="default"] .md-typeset .grid > .card {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
[data-md-color-scheme="default"] .md-typeset .grid.cards > ol > li:hover,
[data-md-color-scheme="default"] .md-typeset .grid.cards > ul > li:hover,
[data-md-color-scheme="default"] .md-typeset .grid > .card:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(15, 118, 110, 0.3);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

/* ── Code ── */
.md-typeset code {
  border-radius: var(--dw-radius-sm);
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
  border-radius: var(--dw-radius-md);
  transition: border-color var(--dw-transition-base), box-shadow var(--dw-transition-base);
}
[data-md-color-scheme="slate"] .md-typeset pre:hover {
  border-color: rgba(93, 228, 199, 0.2);
  box-shadow: var(--dw-glow-sm);
}

/* Code copy button hover */
.md-typeset .md-clipboard:hover {
  color: var(--md-accent-fg-color);
}

/* ── Admonitions — Per-type Tints ── */
.md-typeset .admonition,
.md-typeset details {
  border-radius: var(--dw-radius-md);
  border-left-width: 3px;
  font-size: 0.82rem;
  transition: box-shadow var(--dw-transition-base);
}

.md-typeset .admonition .admonition-title,
.md-typeset details summary {
  font-weight: 600;
}

/* Tip — green */
[data-md-color-scheme="slate"] .md-typeset .admonition.tip,
[data-md-color-scheme="slate"] .md-typeset details.tip {
  background-color: rgba(34, 197, 94, 0.06);
}
/* Warning — amber */
[data-md-color-scheme="slate"] .md-typeset .admonition.warning,
[data-md-color-scheme="slate"] .md-typeset details.warning {
  background-color: rgba(245, 158, 11, 0.06);
}
/* Danger — red */
[data-md-color-scheme="slate"] .md-typeset .admonition.danger,
[data-md-color-scheme="slate"] .md-typeset details.danger {
  border-color: #ef4444;
  background-color: rgba(239, 68, 68, 0.06);
}
.md-typeset .admonition.danger .admonition-title,
.md-typeset details.danger summary {
  background-color: rgba(239, 68, 68, 0.1);
}
/* Question — purple */
[data-md-color-scheme="slate"] .md-typeset .admonition.question,
[data-md-color-scheme="slate"] .md-typeset details.question {
  background-color: rgba(168, 85, 247, 0.06);
}
/* Example — indigo */
[data-md-color-scheme="slate"] .md-typeset .admonition.example,
[data-md-color-scheme="slate"] .md-typeset details.example {
  background-color: rgba(99, 102, 241, 0.06);
}
/* Quote — gray */
[data-md-color-scheme="slate"] .md-typeset .admonition.quote,
[data-md-color-scheme="slate"] .md-typeset details.quote {
  background-color: rgba(156, 163, 175, 0.06);
}

/* Light mode admonition tints */
[data-md-color-scheme="default"] .md-typeset .admonition.tip,
[data-md-color-scheme="default"] .md-typeset details.tip {
  background-color: rgba(34, 197, 94, 0.05);
}
[data-md-color-scheme="default"] .md-typeset .admonition.warning,
[data-md-color-scheme="default"] .md-typeset details.warning {
  background-color: rgba(245, 158, 11, 0.05);
}
[data-md-color-scheme="default"] .md-typeset .admonition.danger,
[data-md-color-scheme="default"] .md-typeset details.danger {
  background-color: rgba(239, 68, 68, 0.05);
}
[data-md-color-scheme="default"] .md-typeset .admonition.question,
[data-md-color-scheme="default"] .md-typeset details.question {
  background-color: rgba(168, 85, 247, 0.05);
}
[data-md-color-scheme="default"] .md-typeset .admonition.example,
[data-md-color-scheme="default"] .md-typeset details.example {
  background-color: rgba(99, 102, 241, 0.05);
}
[data-md-color-scheme="default"] .md-typeset .admonition.quote,
[data-md-color-scheme="default"] .md-typeset details.quote {
  background-color: rgba(156, 163, 175, 0.05);
}

/* ── Tables ── */
.md-typeset table:not([class]) {
  font-size: 0.82rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--dw-radius-md);
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

/* Table row hover */
.md-typeset table:not([class]) tbody tr {
  transition: background-color var(--dw-transition-fast);
}
[data-md-color-scheme="slate"] .md-typeset table:not([class]) tbody tr:hover {
  background-color: rgba(93, 228, 199, 0.04);
}
[data-md-color-scheme="default"] .md-typeset table:not([class]) tbody tr:hover {
  background-color: rgba(15, 118, 110, 0.04);
}

/* ── Tab Styling ── */
.md-typeset .tabbed-labels > label {
  border-radius: var(--dw-radius-sm) var(--dw-radius-sm) 0 0;
  transition: color var(--dw-transition-fast), background-color var(--dw-transition-fast);
}
.md-typeset .tabbed-labels > label:hover {
  color: var(--md-accent-fg-color);
}
.md-typeset .tabbed-labels > label.tabbed-labels__active,
.md-typeset .tabbed-labels > label--active {
  border-bottom: 2px solid var(--md-accent-fg-color);
}

/* ── Sidebar — Active item & Hover ── */
[data-md-color-scheme="slate"] .md-sidebar {
  border-right: 1px solid rgba(255, 255, 255, 0.04);
}

.md-nav__link {
  font-size: 0.72rem;
  transition: color var(--dw-transition-fast), background-color var(--dw-transition-fast);
  border-radius: var(--dw-radius-sm);
}
.md-nav__link:hover {
  background-color: rgba(255, 255, 255, 0.04);
}
[data-md-color-scheme="default"] .md-nav__link:hover {
  background-color: rgba(0, 0, 0, 0.03);
}
.md-nav__link--active,
.md-nav__item .md-nav__link--active {
  border-left: 2px solid var(--md-accent-fg-color);
  padding-left: 0.5rem;
  font-weight: 600;
}

/* Navigation section labels */
.md-nav__item--section > .md-nav__link {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.66rem;
  letter-spacing: 0.06em;
  opacity: 0.6;
}

/* ── Breadcrumb Styling ── */
.md-path {
  font-size: 0.72rem;
  color: var(--md-default-fg-color--light);
}
.md-path__separator {
  margin: 0 0.25rem;
}

/* ── Content Width ── */
.md-content {
  max-width: 54rem;
}

/* ── Footer ── */
.md-footer {
  margin-top: 3rem;
  position: relative;
}
.md-footer::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--dw-gradient-accent);
  opacity: 0.6;
}

[data-md-color-scheme="slate"] .md-footer {
  border-top: none;
}

.md-footer-meta {
  font-size: 0.72rem;
}

/* ── Mermaid Diagrams ── */
.md-typeset .mermaid {
  cursor: zoom-in;
  transition: transform var(--dw-transition-base), box-shadow var(--dw-transition-base);
  border-radius: var(--dw-radius-md);
  padding: 1rem;
}
[data-md-color-scheme="slate"] .md-typeset .mermaid {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
}
.md-typeset .mermaid:hover {
  transform: scale(1.01);
  box-shadow: var(--dw-glow-sm);
}
[data-md-color-scheme="default"] .md-typeset .mermaid {
  background: rgba(0, 0, 0, 0.01);
  border: 1px solid #e5e7eb;
}

/* ── Micro-Animations ── */
.md-typeset a {
  transition: color var(--dw-transition-fast);
}
.md-typeset a:hover {
  opacity: 0.9;
}

/* Content fade-in */
.md-content__inner {
  animation: dw-fadeIn 0.3s ease-out;
}
@keyframes dw-fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Link hover lift */
.md-typeset a:not(.md-nav__link):not(.md-header__button):not(.md-source):hover {
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

/* ── Source Links ── */
.md-typeset a[href*="github.com"][href*="/blob/"] {
  font-size: 0.78rem;
  opacity: 0.7;
  transition: opacity var(--dw-transition-fast);
}
.md-typeset a[href*="github.com"][href*="/blob/"]:hover {
  opacity: 1;
}

/* ── Badge Styles ── */
.md-typeset h3 code + .twemoji,
.md-typeset h3 code ~ em {
  font-size: 0.72rem;
  opacity: 0.6;
}

/* ── Light Mode Overrides ── */
[data-md-color-scheme="default"] {
  --md-primary-fg-color: #0f766e;
  --md-primary-fg-color--light: #14b8a6;
  --md-primary-fg-color--dark: #0d5d56;
  --md-accent-fg-color: #2563eb;
  --dw-card-bg: rgba(255, 255, 255, 0.7);
  --dw-card-border: #e5e7eb;
  --dw-card-hover-border: rgba(15, 118, 110, 0.3);
  --dw-card-hover-bg: rgba(255, 255, 255, 0.9);
  --dw-glow-sm: 0 0 8px rgba(15, 118, 110, 0.08);
  --dw-glow-md: 0 0 20px rgba(15, 118, 110, 0.06);
  --dw-shadow-card: 0 1px 4px rgba(0, 0, 0, 0.06);
  --dw-shadow-card-hover: 0 4px 16px rgba(0, 0, 0, 0.08);
  --dw-gradient-accent: linear-gradient(135deg, #0f766e, #2563eb);
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

[data-md-color-scheme="default"] .md-typeset h1:first-of-type {
  background: var(--dw-gradient-accent);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
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

[data-md-color-scheme="default"] .md-typeset pre {
  border: 1px solid #e5e7eb;
  border-radius: var(--dw-radius-md);
  transition: border-color var(--dw-transition-base), box-shadow var(--dw-transition-base);
}
[data-md-color-scheme="default"] .md-typeset pre:hover {
  border-color: rgba(15, 118, 110, 0.2);
  box-shadow: var(--dw-glow-sm);
}

[data-md-color-scheme="default"] .md-nav__link--active,
[data-md-color-scheme="default"] .md-nav__item .md-nav__link--active {
  border-left-color: var(--md-primary-fg-color);
}

[data-md-color-scheme="default"] .md-footer::before {
  background: var(--dw-gradient-accent);
}
`,
    customJs: `/* DocWalk Developer Preset — Custom JS */

/* Mermaid theme configuration */
window.mermaidConfig = {
  theme: "base",
  themeVariables: {
    primaryColor: "#1e2028",
    primaryTextColor: "#d6d6da",
    primaryBorderColor: "#5de4c7",
    lineColor: "#5de4c7",
    secondaryColor: "#12141c",
    tertiaryColor: "#1e2028",
    fontFamily: "Inter, sans-serif",
    fontSize: "13px",
    nodeBorder: "#5de4c7",
    mainBkg: "#1e2028",
    clusterBkg: "#12141c",
    edgeLabelBackground: "#171921",
    nodeTextColor: "#d6d6da"
  }
};

/* Re-initialize mermaid on theme toggle */
if (typeof document$ !== "undefined") {
  document$.subscribe(function() {
    var scheme = document.body.getAttribute("data-md-color-scheme");
    if (typeof mermaid !== "undefined") {
      var isDark = scheme === "slate";
      mermaid.initialize(Object.assign({}, window.mermaidConfig, {
        theme: "base",
        themeVariables: isDark ? window.mermaidConfig.themeVariables : {
          primaryColor: "#f3f4f6",
          primaryTextColor: "#1f2937",
          primaryBorderColor: "#0f766e",
          lineColor: "#0f766e",
          secondaryColor: "#e5e7eb",
          tertiaryColor: "#f9fafb",
          fontFamily: "Inter, sans-serif",
          fontSize: "13px",
          nodeBorder: "#0f766e",
          mainBkg: "#f3f4f6",
          clusterBkg: "#e5e7eb",
          edgeLabelBackground: "#ffffff",
          nodeTextColor: "#1f2937"
        }
      }));
    }
    /* Make Mermaid diagrams zoomable via glightbox */
    document.querySelectorAll("pre.mermaid svg, .mermaid svg").forEach(function(svg) {
      if (svg.closest("a[data-glightbox]")) return;
      var serializer = new XMLSerializer();
      var svgStr = serializer.serializeToString(svg);
      var dataUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
      var link = document.createElement("a");
      link.href = dataUri;
      link.setAttribute("data-glightbox", "type: image; description-position: bottom");
      link.setAttribute("data-title", "Diagram");
      link.style.cursor = "zoom-in";
      svg.parentNode.insertBefore(link, svg);
      link.appendChild(svg);
    });
  });
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

// ─── Free vs Premium Preset IDs ─────────────────────────────────────────────

/** Presets available in the open-source tier */
export const FREE_PRESET_IDS = ["corporate", "startup", "developer", "minimal"] as const;

/** Presets that require a paid license */
export const PREMIUM_PRESET_IDS = ["api-reference", "knowledge-base"] as const;

// ─── Dynamic Preset Loader ──────────────────────────────────────────────────

/**
 * Registry of additional presets loaded from external packages.
 * Premium theme packages call `registerPresets()` to add their themes.
 */
const externalPresets: Record<string, ThemePreset> = {};

/**
 * Register external presets (used by premium theme packages).
 */
export function registerPresets(presets: Record<string, ThemePreset>): void {
  Object.assign(externalPresets, presets);
}

/**
 * Try to load the premium themes package if installed and licensed.
 * Returns silently if the package is not installed.
 */
export async function loadPremiumPresets(licenseKey?: string): Promise<void> {
  try {
    const premium = await import("@docwalk/themes-premium");
    if (typeof premium.register === "function") {
      premium.register(licenseKey);
    }
  } catch {
    // Premium package not installed — use built-in presets only
  }
}

/**
 * Resolve a preset by ID. Checks built-in presets first, then external.
 * Returns undefined for "custom" or unknown IDs.
 *
 * @param presetId - The preset identifier
 * @param options.requireLicense - If true, premium built-in presets require a license key
 * @param options.licenseKey - License key for premium preset access
 */
export function resolvePreset(
  presetId: string,
  options?: { requireLicense?: boolean; licenseKey?: string }
): ThemePreset | undefined {
  if (presetId === "custom") return undefined;

  // Check built-in presets
  const builtin = THEME_PRESETS[presetId];
  if (builtin) {
    // If license enforcement is enabled, check premium presets
    if (
      options?.requireLicense &&
      (PREMIUM_PRESET_IDS as readonly string[]).includes(presetId) &&
      !options?.licenseKey
    ) {
      return undefined;
    }
    return builtin;
  }

  // Check externally registered presets
  return externalPresets[presetId];
}

/**
 * Get all available preset IDs (built-in + external).
 */
export function getPresetIds(): string[] {
  return [...Object.keys(THEME_PRESETS), ...Object.keys(externalPresets)];
}

/**
 * Get only free preset IDs.
 */
export function getFreePresetIds(): string[] {
  return [...FREE_PRESET_IDS];
}

/**
 * Get only premium preset IDs (built-in + external).
 */
export function getPremiumPresetIds(): string[] {
  return [...PREMIUM_PRESET_IDS, ...Object.keys(externalPresets)];
}

/**
 * Check if a preset ID is a premium preset.
 */
export function isPremiumPreset(presetId: string): boolean {
  return (
    (PREMIUM_PRESET_IDS as readonly string[]).includes(presetId) ||
    presetId in externalPresets
  );
}
