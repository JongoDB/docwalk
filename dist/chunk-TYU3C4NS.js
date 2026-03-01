import {
  executeHooks
} from "./chunk-W5SRVZUR.js";
import {
  createProvider,
  resolveApiKey
} from "./chunk-NOZSCKAF.js";
import {
  generateArchitecturePage,
  generateArchitecturePageNarrative,
  generateChangelogPage,
  generateConfigurationPage,
  generateDependenciesPage,
  generateGettingStartedPage,
  generateGettingStartedPageNarrative,
  generateInsightsPage,
  generateModulePage,
  generateOverviewPage,
  generateOverviewPageNarrative,
  generateSBOMPage,
  generateTieredArchitecturePages,
  generateTypesPage,
  generateUsageGuidePage
} from "./chunk-GCUJBNZ3.js";
import {
  buildSymbolPageMap,
  groupByLogicalSection,
  groupModulesLogically,
  renderNavYaml,
  resolveProjectName
} from "./chunk-GEYCHOKI.js";

// src/generators/theme-presets.ts
var THEME_PRESETS = {
  corporate: {
    id: "corporate",
    name: "Corporate",
    palette: {
      scheme: "default",
      primary: "#1a237e",
      accent: "#0277bd"
    },
    cssVars: {
      "--md-primary-fg-color": "#1a237e",
      "--md-primary-fg-color--light": "#534bae",
      "--md-primary-fg-color--dark": "#000051",
      "--md-accent-fg-color": "#0277bd",
      "--md-accent-fg-color--transparent": "rgba(2, 119, 189, 0.1)"
    },
    features: [
      "navigation.tabs",
      "navigation.sections",
      "navigation.top",
      "search.suggest",
      "search.highlight",
      "content.code.copy",
      "content.tabs.link",
      "navigation.footer"
    ],
    fonts: {
      text: "Roboto",
      code: "Roboto Mono"
    },
    customCss: `/* Corporate Preset \u2014 Clean, professional, B2B */
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
`
  },
  startup: {
    id: "startup",
    name: "Startup",
    palette: {
      scheme: "default",
      primary: "#7c3aed",
      accent: "#f59e0b",
      toggleScheme: "slate"
    },
    cssVars: {
      "--md-primary-fg-color": "#7c3aed",
      "--md-primary-fg-color--light": "#a78bfa",
      "--md-primary-fg-color--dark": "#5b21b6",
      "--md-accent-fg-color": "#f59e0b",
      "--md-accent-fg-color--transparent": "rgba(245, 158, 11, 0.1)"
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
      "navigation.footer"
    ],
    fonts: {
      text: "Inter",
      code: "Fira Code"
    },
    customCss: `/* Startup Preset \u2014 Vibrant, modern, energetic */
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
`
  },
  developer: {
    id: "developer",
    name: "Developer",
    palette: {
      scheme: "slate",
      primary: "#5de4c7",
      accent: "#add7ff",
      toggleScheme: "default"
    },
    cssVars: {
      "--md-primary-fg-color": "#5de4c7",
      "--md-primary-fg-color--light": "#89f0d6",
      "--md-primary-fg-color--dark": "#32d4a9",
      "--md-accent-fg-color": "#add7ff",
      "--md-accent-fg-color--transparent": "rgba(173, 215, 255, 0.1)"
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
      "announce.dismiss"
    ],
    fonts: {
      text: "Inter",
      code: "Fira Code"
    },
    customCss: `/* Developer Preset \u2014 Premium technical documentation */

/* \u2500\u2500 Design Tokens \u2500\u2500 */
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

/* \u2500\u2500 Header & Navigation \u2500\u2500 */
.md-header {
  background-color: #12141c;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.2);
}

.md-tabs {
  background-color: #12141c;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

/* \u2500\u2500 Typography \u2500\u2500 */
.md-typeset {
  font-size: 0.82rem;
  line-height: 1.75;
}

/* \u2500\u2500 Hero heading: gradient text on first h1 \u2500\u2500 */
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

/* \u2500\u2500 Custom Scrollbar \u2500\u2500 */
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

/* \u2500\u2500 Card Grids (Glassmorphism) \u2500\u2500 */
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

/* \u2500\u2500 Code \u2500\u2500 */
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

/* \u2500\u2500 Admonitions \u2014 Per-type Tints \u2500\u2500 */
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

/* Tip \u2014 green */
[data-md-color-scheme="slate"] .md-typeset .admonition.tip,
[data-md-color-scheme="slate"] .md-typeset details.tip {
  background-color: rgba(34, 197, 94, 0.06);
}
/* Warning \u2014 amber */
[data-md-color-scheme="slate"] .md-typeset .admonition.warning,
[data-md-color-scheme="slate"] .md-typeset details.warning {
  background-color: rgba(245, 158, 11, 0.06);
}
/* Danger \u2014 red */
[data-md-color-scheme="slate"] .md-typeset .admonition.danger,
[data-md-color-scheme="slate"] .md-typeset details.danger {
  border-color: #ef4444;
  background-color: rgba(239, 68, 68, 0.06);
}
.md-typeset .admonition.danger .admonition-title,
.md-typeset details.danger summary {
  background-color: rgba(239, 68, 68, 0.1);
}
/* Question \u2014 purple */
[data-md-color-scheme="slate"] .md-typeset .admonition.question,
[data-md-color-scheme="slate"] .md-typeset details.question {
  background-color: rgba(168, 85, 247, 0.06);
}
/* Example \u2014 indigo */
[data-md-color-scheme="slate"] .md-typeset .admonition.example,
[data-md-color-scheme="slate"] .md-typeset details.example {
  background-color: rgba(99, 102, 241, 0.06);
}
/* Quote \u2014 gray */
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

/* \u2500\u2500 Tables \u2500\u2500 */
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

/* \u2500\u2500 Tab Styling \u2500\u2500 */
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

/* \u2500\u2500 Sidebar \u2014 Active item & Hover \u2500\u2500 */
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

/* \u2500\u2500 Breadcrumb Styling \u2500\u2500 */
.md-path {
  font-size: 0.72rem;
  color: var(--md-default-fg-color--light);
}
.md-path__separator {
  margin: 0 0.25rem;
}

/* \u2500\u2500 Content Width \u2500\u2500 */
.md-content {
  max-width: 54rem;
}

/* \u2500\u2500 Footer \u2500\u2500 */
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

/* \u2500\u2500 Mermaid Diagrams \u2500\u2500 */
.md-typeset .mermaid,
.md-typeset .dw-mermaid-loading {
  cursor: zoom-in;
  transition: transform var(--dw-transition-base), box-shadow var(--dw-transition-base);
  border-radius: var(--dw-radius-md);
  padding: 1rem;
}
[data-md-color-scheme="slate"] .md-typeset .mermaid,
[data-md-color-scheme="slate"] .md-typeset .dw-mermaid-loading {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
}
.md-typeset .mermaid:hover {
  transform: scale(1.01);
  box-shadow: var(--dw-glow-sm);
}
[data-md-color-scheme="default"] .md-typeset .mermaid,
[data-md-color-scheme="default"] .md-typeset .dw-mermaid-loading {
  background: rgba(0, 0, 0, 0.01);
  border: 1px solid #e5e7eb;
}

/* \u2500\u2500 Micro-Animations \u2500\u2500 */
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

/* \u2500\u2500 Source Links \u2500\u2500 */
.md-typeset a[href*="github.com"][href*="/blob/"] {
  font-size: 0.78rem;
  opacity: 0.7;
  transition: opacity var(--dw-transition-fast);
}
.md-typeset a[href*="github.com"][href*="/blob/"]:hover {
  opacity: 1;
}

/* \u2500\u2500 Badge Styles \u2500\u2500 */
.md-typeset h3 code + .twemoji,
.md-typeset h3 code ~ em {
  font-size: 0.72rem;
  opacity: 0.6;
}

/* \u2500\u2500 Light Mode Overrides \u2500\u2500 */
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
    customJs: `/* DocWalk Developer Preset \u2014 Custom JS */

/* Mermaid rendering + click-to-zoom.
   Zensical empties .mermaid containers without rendering SVGs.
   We save the source text immediately (before Zensical clears it),
   load Mermaid from CDN if needed, and render ourselves. */
(function() {
  /* 1. Save sources immediately and prevent Zensical from touching them */
  var diagrams = [];
  document.querySelectorAll("pre.mermaid").forEach(function(pre) {
    var code = pre.querySelector("code");
    var src = (code || pre).textContent || "";
    if (src.trim()) {
      diagrams.push({ el: pre, src: src.trim() });
      pre.className = "dw-mermaid-loading";
    }
  });
  if (!diagrams.length) return;

  /* 2. Pan + zoom overlay */
  function openZoom(svg) {
    var isDark = document.body.getAttribute("data-md-color-scheme") === "slate";
    var bg = isDark ? "#171921" : "#f9fafb";
    var fg = isDark ? "#d6d6da" : "#1f2937";
    var accent = isDark ? "#5de4c7" : "#0f766e";

    var overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:" + bg + ";display:flex;flex-direction:column;";

    /* Toolbar */
    var toolbar = document.createElement("div");
    toolbar.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1.25rem;border-bottom:1px solid " + (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)") + ";flex-shrink:0;user-select:none;";
    var hint = document.createElement("span");
    hint.textContent = "Scroll to zoom \\u00b7 Drag to pan \\u00b7 Double-click to reset";
    hint.style.cssText = "font:12px Inter,sans-serif;color:" + fg + ";opacity:0.5;";
    var controls = document.createElement("span");
    controls.style.cssText = "display:flex;gap:0.5rem;align-items:center;";
    function makeBtn(label, title) {
      var b = document.createElement("button");
      b.textContent = label;
      b.title = title;
      b.style.cssText = "background:none;border:1px solid " + (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)") + ";color:" + fg + ";border-radius:6px;width:32px;height:32px;font:16px Inter,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;";
      return b;
    }
    var btnZoomIn = makeBtn("+", "Zoom in");
    var btnZoomOut = makeBtn("\\u2212", "Zoom out");
    var btnReset = makeBtn("\\u21ba", "Reset view");
    var btnClose = makeBtn("\\u2715", "Close");
    btnClose.style.borderColor = accent;
    btnClose.style.color = accent;
    controls.appendChild(btnZoomIn);
    controls.appendChild(btnZoomOut);
    controls.appendChild(btnReset);
    controls.appendChild(btnClose);
    toolbar.appendChild(hint);
    toolbar.appendChild(controls);
    overlay.appendChild(toolbar);

    /* Viewport */
    var viewport = document.createElement("div");
    viewport.style.cssText = "flex:1;overflow:hidden;position:relative;cursor:grab;";
    var wrapper = document.createElement("div");
    wrapper.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform-origin:0 0;";
    var clone = svg.cloneNode(true);
    clone.style.cssText = "max-width:90vw;max-height:85vh;width:auto;height:auto;";
    clone.removeAttribute("max-width");
    wrapper.appendChild(clone);
    viewport.appendChild(wrapper);
    overlay.appendChild(viewport);
    document.body.appendChild(overlay);

    /* Pan + zoom state */
    var scale = 1, tx = 0, ty = 0;
    var dragging = false, startX = 0, startY = 0, startTx = 0, startTy = 0;

    function applyTransform() {
      wrapper.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
    }

    function zoom(delta, cx, cy) {
      var prev = scale;
      scale = Math.min(10, Math.max(0.1, scale * delta));
      var rect = viewport.getBoundingClientRect();
      var ox = (cx || rect.width / 2) - rect.left;
      var oy = (cy || rect.height / 2) - rect.top;
      tx = ox - (ox - tx) * (scale / prev);
      ty = oy - (oy - ty) * (scale / prev);
      applyTransform();
    }

    function resetView() { scale = 1; tx = 0; ty = 0; applyTransform(); }

    viewport.addEventListener("wheel", function(e) {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1.15 : 0.87, e.clientX, e.clientY);
    }, { passive: false });

    viewport.addEventListener("mousedown", function(e) {
      if (e.button !== 0) return;
      dragging = true; startX = e.clientX; startY = e.clientY;
      startTx = tx; startTy = ty;
      viewport.style.cursor = "grabbing";
    });
    document.addEventListener("mousemove", function move(e) {
      if (!dragging) return;
      tx = startTx + (e.clientX - startX);
      ty = startTy + (e.clientY - startY);
      applyTransform();
    });
    document.addEventListener("mouseup", function up() {
      dragging = false;
      viewport.style.cursor = "grab";
    });

    viewport.addEventListener("dblclick", resetView);
    btnZoomIn.addEventListener("click", function() { zoom(1.3); });
    btnZoomOut.addEventListener("click", function() { zoom(0.77); });
    btnReset.addEventListener("click", resetView);

    function close() {
      overlay.remove();
    }
    btnClose.addEventListener("click", close);
    document.addEventListener("keydown", function esc(ev) {
      if (ev.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
    });
  }

  /* 3. Render one diagram at a time (mermaid.render is async in v10+) */
  function renderQueue(m, queue) {
    if (!queue.length) return;
    var d = queue.shift();
    var id = "dw-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4);
    try {
      var result = m.render(id, d.src);
      if (result && typeof result.then === "function") {
        result.then(function(r) {
          d.el.innerHTML = r.svg;
          d.el.className = "mermaid";
          renderQueue(m, queue);
        }).catch(function() {
          d.el.textContent = d.src;
          d.el.className = "mermaid";
          renderQueue(m, queue);
        });
      } else {
        d.el.innerHTML = typeof result === "string" ? result : "";
        d.el.className = "mermaid";
        renderQueue(m, queue);
      }
    } catch(e) {
      d.el.textContent = d.src;
      d.el.className = "mermaid";
      renderQueue(m, queue);
    }
  }

  function doRender(m) {
    var isDark = document.body.getAttribute("data-md-color-scheme") === "slate";
    m.initialize({ startOnLoad: false, theme: isDark ? "dark" : "default", fontFamily: "Inter, sans-serif" });
    renderQueue(m, diagrams.slice());
  }

  /* 4. Use global mermaid if available, otherwise load from CDN */
  function boot() {
    if (typeof mermaid !== "undefined" && mermaid.initialize) {
      doRender(mermaid);
      return;
    }
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    s.onload = function() {
      if (typeof mermaid !== "undefined") doRender(mermaid);
    };
    s.onerror = function() {
      diagrams.forEach(function(d) { d.el.textContent = d.src; d.el.className = "mermaid"; });
    };
    document.head.appendChild(s);
  }

  /* Small delay so Zensical's synchronous setup finishes first */
  setTimeout(boot, 0);

  /* 5. Capture-phase click-to-zoom */
  document.addEventListener("click", function(e) {
    if (!e.target.closest) return;
    var container = e.target.closest(".mermaid, .dw-mermaid-loading");
    if (!container) return;
    var svg = container.querySelector("svg");
    if (!svg) return;
    e.preventDefault();
    e.stopPropagation();
    openZoom(svg);
  }, true);
})();
`
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    palette: {
      scheme: "default",
      primary: "#374151",
      accent: "#6b7280"
    },
    cssVars: {
      "--md-primary-fg-color": "#374151",
      "--md-primary-fg-color--light": "#6b7280",
      "--md-primary-fg-color--dark": "#1f2937",
      "--md-accent-fg-color": "#6b7280",
      "--md-accent-fg-color--transparent": "rgba(107, 114, 128, 0.1)"
    },
    features: [
      "navigation.sections",
      "navigation.top",
      "search.suggest",
      "search.highlight",
      "content.code.copy",
      "content.tabs.link"
    ],
    fonts: {
      text: "Source Serif 4",
      code: "Source Code Pro"
    },
    customCss: `/* Minimal Preset \u2014 Reading-focused, distraction-free */
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
`
  }
};
var FREE_PRESET_IDS = ["corporate", "startup", "developer", "minimal"];
var PREMIUM_PRESET_IDS = ["api-reference", "knowledge-base"];
var externalPresets = {};
function registerPresets(presets) {
  Object.assign(externalPresets, presets);
}
async function loadPremiumPresets(licenseKey) {
  try {
    const premium = await import("@docwalk/themes-premium");
    if (typeof premium.register === "function") {
      premium.register(licenseKey);
    }
  } catch {
  }
}
function resolvePreset(presetId, options) {
  if (presetId === "custom") return void 0;
  const builtin = THEME_PRESETS[presetId];
  if (builtin) {
    if (options?.requireLicense && PREMIUM_PRESET_IDS.includes(presetId) && !options?.licenseKey) {
      return void 0;
    }
    return builtin;
  }
  return externalPresets[presetId];
}
function getPresetIds() {
  return [...Object.keys(THEME_PRESETS), ...Object.keys(externalPresets)];
}
function getFreePresetIds() {
  return [...FREE_PRESET_IDS];
}
function getPremiumPresetIds() {
  return [...PREMIUM_PRESET_IDS, ...Object.keys(externalPresets)];
}
function isPremiumPreset(presetId) {
  return PREMIUM_PRESET_IDS.includes(presetId) || presetId in externalPresets;
}

// src/generators/mkdocs.ts
import { mkdir, writeFile } from "fs/promises";
import path from "path";
function safeGenerate(name, fn, onProgress) {
  try {
    return fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onProgress?.(`Warning: ${name} page generation failed: ${message}`);
    return {
      path: `${name.toLowerCase().replace(/\s+/g, "-")}-error.md`,
      title: name,
      content: `---
title: ${name}
---

# ${name}

!!! danger "Generation Error"
    This page could not be generated: ${message}
`,
      navGroup: "",
      navOrder: 99
    };
  }
}
async function safeGenerateAsync(name, fn, onProgress) {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onProgress?.(`Warning: ${name} page generation failed: ${message}`);
    return {
      path: `${name.toLowerCase().replace(/\s+/g, "-")}-error.md`,
      title: name,
      content: `---
title: ${name}
---

# ${name}

!!! danger "Generation Error"
    This page could not be generated: ${message}
`,
      navGroup: "",
      navOrder: 99
    };
  }
}
async function generateDocs(options) {
  const { manifest, config, outputDir, onProgress, hooks, readFile, tryMode } = options;
  await executeHooks("pre_build", hooks, { cwd: outputDir });
  const docsDir = path.join(outputDir, "docs");
  await mkdir(docsDir, { recursive: true });
  let aiProvider;
  if (config.analysis.ai_summaries && config.analysis.ai_provider) {
    aiProvider = createProvider(config.analysis.ai_provider);
  }
  const useNarrative = !!(config.analysis.ai_narrative && aiProvider && readFile);
  let structurePlan;
  if (config.analysis.ai_structure && aiProvider) {
    try {
      onProgress?.("Analyzing codebase structure...");
      const { analyzeStructure } = await import("./structure-advisor-JIRRZUSM.js");
      structurePlan = await analyzeStructure(manifest, aiProvider);
    } catch {
    }
  }
  const pages = [];
  if (useNarrative) {
    onProgress?.("Generating narrative pages (overview, getting started, architecture)...");
    const narrativePromises = [];
    narrativePromises.push(
      safeGenerateAsync(
        "Overview",
        () => generateOverviewPageNarrative(manifest, config, aiProvider, readFile),
        onProgress
      )
    );
    narrativePromises.push(
      safeGenerateAsync(
        "Getting Started",
        () => generateGettingStartedPageNarrative(manifest, config, aiProvider, readFile),
        onProgress
      )
    );
    if (config.analysis.dependency_graph && config.analysis.architecture_tiers === false) {
      const repoUrl = config.source.repo.includes("/") ? config.source.repo : void 0;
      narrativePromises.push(
        safeGenerateAsync(
          "Architecture",
          () => generateArchitecturePageNarrative(manifest, aiProvider, readFile, repoUrl, config.source.branch),
          onProgress
        )
      );
    }
    const narrativeResults = await Promise.all(narrativePromises);
    pages.push(...narrativeResults);
    if (config.analysis.dependency_graph && config.analysis.architecture_tiers !== false) {
      const archResult = safeGenerate("Architecture", () => generateTieredArchitecturePages(manifest), onProgress);
      pages.push(...Array.isArray(archResult) ? archResult : [archResult]);
    }
  } else {
    const overviewResult = safeGenerate("Overview", () => generateOverviewPage(manifest, config), onProgress);
    pages.push(...Array.isArray(overviewResult) ? overviewResult : [overviewResult]);
    const gettingStartedResult = safeGenerate("Getting Started", () => generateGettingStartedPage(manifest, config), onProgress);
    pages.push(...Array.isArray(gettingStartedResult) ? gettingStartedResult : [gettingStartedResult]);
    if (config.analysis.dependency_graph) {
      onProgress?.("Generating architecture pages...");
      if (config.analysis.architecture_tiers !== false) {
        const archResult = safeGenerate("Architecture", () => generateTieredArchitecturePages(manifest), onProgress);
        pages.push(...Array.isArray(archResult) ? archResult : [archResult]);
      } else {
        const archResult = safeGenerate("Architecture", () => generateArchitecturePage(manifest), onProgress);
        pages.push(...Array.isArray(archResult) ? archResult : [archResult]);
      }
    }
  }
  const symbolPageMap = buildSymbolPageMap(manifest.modules);
  const modulePageCtx = { config, manifest, symbolPageMap };
  onProgress?.("Generating API reference pages...");
  const modulesByGroup = groupModulesLogically(manifest.modules);
  for (const [group, modules] of Object.entries(modulesByGroup)) {
    for (const mod of modules) {
      pages.push(generateModulePage(mod, group, modulePageCtx));
    }
  }
  if (config.analysis.config_docs) {
    onProgress?.("Generating configuration page...");
    const configResult = safeGenerate("Configuration", () => generateConfigurationPage(manifest, config), onProgress);
    pages.push(...Array.isArray(configResult) ? configResult : [configResult]);
  }
  if (config.analysis.types_page) {
    onProgress?.("Generating types page...");
    const typesResult = safeGenerate("Types", () => generateTypesPage(manifest), onProgress);
    pages.push(...Array.isArray(typesResult) ? typesResult : [typesResult]);
  }
  if (config.analysis.dependencies_page) {
    onProgress?.("Generating dependencies page...");
    if (config.analysis.sbom !== false) {
      const sbomResult = safeGenerate("SBOM", () => generateSBOMPage(manifest, config), onProgress);
      pages.push(...Array.isArray(sbomResult) ? sbomResult : [sbomResult]);
    } else {
      const depsResult = safeGenerate("Dependencies", () => generateDependenciesPage(manifest), onProgress);
      pages.push(...Array.isArray(depsResult) ? depsResult : [depsResult]);
    }
  }
  if (config.analysis.usage_guide_page) {
    onProgress?.("Generating usage guide page...");
    const guideResult = safeGenerate("Usage Guide", () => generateUsageGuidePage(manifest, config), onProgress);
    pages.push(...Array.isArray(guideResult) ? guideResult : [guideResult]);
  }
  if (config.analysis.changelog) {
    onProgress?.("Generating changelog page...");
    const changelogPage = await safeGenerateAsync("Changelog", () => generateChangelogPage(config), onProgress);
    pages.push(changelogPage);
  }
  if (config.analysis.user_docs !== false && !tryMode) {
    onProgress?.("Generating end-user documentation...");
    const userDocsConfig = config.analysis.user_docs_config;
    const {
      generateUserGuidePage,
      generateUserGettingStartedPage,
      generateFeaturesPage,
      generateTroubleshootingPage,
      generateFAQPage,
      generateUserGuidePageNarrative,
      generateUserGettingStartedPageNarrative,
      generateFeaturesPageNarrative,
      generateTroubleshootingPageNarrative,
      generateFAQPageNarrative
    } = await import("./pages-ECI4KKCX.js");
    if (useNarrative) {
      const userDocPromises = [];
      if (userDocsConfig?.overview !== false) {
        userDocPromises.push(safeGenerateAsync(
          "User Guide",
          () => generateUserGuidePageNarrative(manifest, config, aiProvider),
          onProgress
        ));
      }
      if (userDocsConfig?.getting_started !== false) {
        userDocPromises.push(safeGenerateAsync(
          "User Getting Started",
          () => generateUserGettingStartedPageNarrative(manifest, config, aiProvider),
          onProgress
        ));
      }
      if (userDocsConfig?.features !== false) {
        userDocPromises.push(safeGenerateAsync(
          "Features",
          () => generateFeaturesPageNarrative(manifest, config, aiProvider),
          onProgress
        ));
      }
      if (userDocsConfig?.troubleshooting !== false) {
        userDocPromises.push(safeGenerateAsync(
          "Troubleshooting",
          () => generateTroubleshootingPageNarrative(manifest, config, aiProvider),
          onProgress
        ));
      }
      if (userDocsConfig?.faq !== false) {
        userDocPromises.push(safeGenerateAsync(
          "FAQ",
          () => generateFAQPageNarrative(manifest, config, aiProvider),
          onProgress
        ));
      }
      const userDocResults = await Promise.all(userDocPromises);
      pages.push(...userDocResults);
    } else {
      if (userDocsConfig?.overview !== false) {
        const result = safeGenerate("User Guide", () => generateUserGuidePage(manifest, config), onProgress);
        pages.push(...Array.isArray(result) ? result : [result]);
      }
      if (userDocsConfig?.getting_started !== false) {
        const result = safeGenerate("User Getting Started", () => generateUserGettingStartedPage(manifest, config), onProgress);
        pages.push(...Array.isArray(result) ? result : [result]);
      }
      if (userDocsConfig?.features !== false) {
        const result = safeGenerate("Features", () => generateFeaturesPage(manifest, config), onProgress);
        pages.push(...Array.isArray(result) ? result : [result]);
      }
      if (userDocsConfig?.troubleshooting !== false) {
        const result = safeGenerate("Troubleshooting", () => generateTroubleshootingPage(manifest, config), onProgress);
        pages.push(...Array.isArray(result) ? result : [result]);
      }
      if (userDocsConfig?.faq !== false) {
        const result = safeGenerate("FAQ", () => generateFAQPage(manifest, config), onProgress);
        pages.push(...Array.isArray(result) ? result : [result]);
      }
    }
  }
  if (config.analysis.insights !== false && manifest.insights && manifest.insights.length > 0) {
    onProgress?.("Generating insights page...");
    const insightsResult = safeGenerate("Insights", () => generateInsightsPage(manifest.insights, config), onProgress);
    pages.push(...Array.isArray(insightsResult) ? insightsResult : [insightsResult]);
  }
  if (structurePlan && structurePlan.conceptPages.length > 0 && aiProvider && readFile) {
    onProgress?.("Generating concept pages...");
    const { generateConceptPage } = await import("./concept-U5CTR7X2.js");
    const repoUrl = config.source.repo.includes("/") ? config.source.repo : void 0;
    for (const suggestion of structurePlan.conceptPages) {
      const page = await safeGenerateAsync(
        suggestion.title,
        () => generateConceptPage(suggestion, manifest, aiProvider, readFile, repoUrl, config.source.branch),
        onProgress
      );
      pages.push(page);
    }
  }
  if (tryMode) {
    const totalModules = manifest.modules.length;
    for (const page of pages) {
      page.content += `

!!! tip "Unlock Full Documentation"
    This is a preview. DocWalk Pro includes complete API reference for all ${totalModules} modules, AI-powered narratives, end-user guides, and more.
`;
    }
  }
  for (const page of pages) {
    const pagePath = path.join(docsDir, page.path);
    await mkdir(path.dirname(pagePath), { recursive: true });
    await writeFile(pagePath, page.content);
    onProgress?.(`Written: ${page.path}`);
  }
  if (config.analysis.qa_widget && config.analysis.qa_config) {
    onProgress?.("Building Q&A index...");
    try {
      const { buildQAIndex } = await import("./qa-AZPPDSEX.js");
      const qaProviderName = config.analysis.qa_config.provider || "openai";
      const qaKeyEnv = config.analysis.qa_config.api_key_env || config.analysis.ai_provider?.api_key_env || "DOCWALK_AI_KEY";
      const qaApiKey = resolveApiKey(qaProviderName, qaKeyEnv) || "";
      const qaIndex = await buildQAIndex({
        pages,
        embedder: {
          provider: qaProviderName,
          model: config.analysis.qa_config.embedding_model,
          apiKey: qaApiKey,
          base_url: config.analysis.qa_config.base_url
        },
        onProgress
      });
      const qaDir = path.join(docsDir, "_docwalk");
      await mkdir(qaDir, { recursive: true });
      await writeFile(
        path.join(qaDir, "qa-index.json"),
        JSON.stringify(qaIndex.serialized)
      );
      onProgress?.(`Q&A index built: ${qaIndex.chunkCount} chunks from ${qaIndex.pageCount} pages`);
      const { injectQAWidget } = await import("./inject-E4UVQDJM.js");
      await injectQAWidget(outputDir, config.analysis.qa_config, "https://qa.docwalk.dev/api/ask");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onProgress?.(`Warning: Q&A index build failed: ${msg}`);
    }
  }
  const preset = resolvePreset(config.theme.preset ?? "developer");
  if (preset) {
    const stylesDir = path.join(docsDir, "stylesheets");
    await mkdir(stylesDir, { recursive: true });
    await writeFile(path.join(stylesDir, "preset.css"), preset.customCss);
    onProgress?.("Written: stylesheets/preset.css");
    if (preset.customJs) {
      const jsDir = path.join(docsDir, "javascripts");
      await mkdir(jsDir, { recursive: true });
      await writeFile(path.join(jsDir, "preset.js"), preset.customJs);
      onProgress?.("Written: javascripts/preset.js");
    }
  }
  onProgress?.("Generating mkdocs.yml...");
  const audienceSeparation = resolveAudienceSeparation(config, manifest);
  const navigation = buildNavigation(pages, audienceSeparation);
  const mkdocsYml = generateMkdocsConfig(manifest, config, navigation);
  await writeFile(path.join(outputDir, "mkdocs.yml"), mkdocsYml);
  await executeHooks("post_build", hooks, { cwd: outputDir });
  onProgress?.(`Documentation generated: ${pages.length} pages`);
}
function buildNavigation(pages, audienceSeparation) {
  if (audienceSeparation) {
    return buildTabbedNavigation(pages);
  }
  const nav = [];
  const topLevel = pages.filter((p) => !p.path.includes("/")).sort((a, b) => a.navOrder - b.navOrder);
  for (const page of topLevel) {
    nav.push({ title: page.title, path: page.path });
  }
  const archIndex = pages.find((p) => p.path === "architecture/index.md");
  const archSubPages = pages.filter((p) => p.path.startsWith("architecture/") && p.path !== "architecture/index.md");
  if (archIndex || archSubPages.length > 0) {
    const archNav = {
      title: "Architecture",
      children: []
    };
    if (archIndex) {
      archNav.children.push({ title: "System Overview", path: archIndex.path });
    }
    for (const page of archSubPages.sort((a, b) => a.navOrder - b.navOrder)) {
      archNav.children.push({ title: page.title, path: page.path });
    }
    nav.push(archNav);
  }
  const apiPages = pages.filter((p) => p.path.startsWith("api/"));
  const sections = groupByLogicalSection(apiPages);
  if (Object.keys(sections).length > 0) {
    const apiNav = {
      title: "API Reference",
      children: []
    };
    for (const [section, sectionPages] of Object.entries(sections)) {
      if (Object.keys(sections).length === 1) {
        apiNav.children = sectionPages.sort((a, b) => a.title.localeCompare(b.title)).map((p) => ({ title: p.title, path: p.path }));
      } else {
        apiNav.children.push({
          title: section,
          children: sectionPages.sort((a, b) => a.title.localeCompare(b.title)).map((p) => ({ title: p.title, path: p.path }))
        });
      }
    }
    nav.push(apiNav);
  }
  return nav;
}
function buildTabbedNavigation(pages) {
  const userPages = pages.filter((p) => p.audience === "user" || p.audience === "both");
  const devPages = pages.filter((p) => p.audience === "developer" || p.audience === "both");
  const unassigned = pages.filter((p) => !p.audience);
  const userDocs = {
    title: "User Docs",
    children: []
  };
  for (const page of userPages.sort((a, b) => a.navOrder - b.navOrder)) {
    userDocs.children.push({ title: page.title, path: page.path });
  }
  const devDocs = {
    title: "Developer Docs",
    children: []
  };
  const devTopLevel = [...devPages, ...unassigned].filter((p) => !p.path.startsWith("api/") && !p.path.startsWith("architecture/") && !p.path.startsWith("concepts/")).sort((a, b) => a.navOrder - b.navOrder);
  for (const page of devTopLevel) {
    devDocs.children.push({ title: page.title, path: page.path });
  }
  const archIndex = pages.find((p) => p.path === "architecture/index.md");
  const archSubPages = pages.filter((p) => p.path.startsWith("architecture/") && p.path !== "architecture/index.md");
  if (archIndex || archSubPages.length > 0) {
    const archNav = {
      title: "Architecture",
      children: []
    };
    if (archIndex) {
      archNav.children.push({ title: "System Overview", path: archIndex.path });
    }
    for (const page of archSubPages.sort((a, b) => a.navOrder - b.navOrder)) {
      archNav.children.push({ title: page.title, path: page.path });
    }
    devDocs.children.push(archNav);
  } else {
    const archPage = pages.find((p) => p.path === "architecture.md");
    if (archPage) {
      devDocs.children.push({ title: archPage.title, path: archPage.path });
    }
  }
  const apiPages = pages.filter((p) => p.path.startsWith("api/"));
  const sections = groupByLogicalSection(apiPages);
  if (Object.keys(sections).length > 0) {
    const apiNav = {
      title: "API Reference",
      children: []
    };
    for (const [section, sectionPages] of Object.entries(sections)) {
      if (Object.keys(sections).length === 1) {
        apiNav.children = sectionPages.sort((a, b) => a.title.localeCompare(b.title)).map((p) => ({ title: p.title, path: p.path }));
      } else {
        apiNav.children.push({
          title: section,
          children: sectionPages.sort((a, b) => a.title.localeCompare(b.title)).map((p) => ({ title: p.title, path: p.path }))
        });
      }
    }
    devDocs.children.push(apiNav);
  }
  const conceptPages = pages.filter((p) => p.path.startsWith("concepts/"));
  if (conceptPages.length > 0) {
    const conceptNav = {
      title: "Concepts",
      children: conceptPages.sort((a, b) => a.navOrder - b.navOrder).map((p) => ({ title: p.title, path: p.path }))
    };
    devDocs.children.push(conceptNav);
  }
  return [userDocs, devDocs];
}
function generateMkdocsConfig(manifest, config, navigation) {
  const siteName = resolveProjectName(manifest);
  const theme = config.theme;
  const preset = resolvePreset(theme.preset ?? "developer");
  const isGitHubRepo = config.source.repo.includes("/");
  const navYaml = renderNavYaml(navigation, 0);
  let resolvedFeatures = preset && theme.features.length === ThemeSchemaDefaults.features.length ? [...preset.features] : [...theme.features];
  const layout = theme.layout ?? "tabs";
  if (layout === "sidebar") {
    resolvedFeatures = resolvedFeatures.filter(
      (f) => f !== "navigation.tabs" && f !== "navigation.tabs.sticky"
    );
    if (!resolvedFeatures.includes("toc.integrate")) {
      resolvedFeatures.push("toc.integrate");
    }
  } else if (layout === "tabs-sticky") {
    if (!resolvedFeatures.includes("navigation.tabs")) {
      resolvedFeatures.push("navigation.tabs");
    }
    if (!resolvedFeatures.includes("navigation.tabs.sticky")) {
      resolvedFeatures.push("navigation.tabs.sticky");
    }
  } else {
    if (!resolvedFeatures.includes("navigation.tabs")) {
      resolvedFeatures.push("navigation.tabs");
    }
  }
  const features = resolvedFeatures.map((f) => `      - ${f}`).join("\n");
  const scheme = preset ? preset.palette.scheme : theme.palette;
  const toggleScheme = preset?.palette.toggleScheme;
  let paletteYaml;
  if (toggleScheme) {
    paletteYaml = `  palette:
    - scheme: ${scheme}
      primary: custom
      accent: custom
      toggle:
        icon: material/brightness-${scheme === "slate" ? "4" : "7"}
        name: Switch to ${scheme === "slate" ? "light" : "dark"} mode
    - scheme: ${toggleScheme}
      primary: custom
      accent: custom
      toggle:
        icon: material/brightness-${toggleScheme === "slate" ? "4" : "7"}
        name: Switch to ${scheme === "slate" ? "dark" : "light"} mode`;
  } else {
    paletteYaml = `  palette:
    - scheme: ${scheme}
      primary: custom
      accent: custom
      toggle:
        icon: material/brightness-7
        name: Switch to dark mode
    - scheme: slate
      primary: custom
      accent: custom
      toggle:
        icon: material/brightness-4
        name: Switch to light mode`;
  }
  const fonts = preset?.fonts;
  const fontYaml = fonts ? `  font:
    text: "${fonts.text}"
    code: "${fonts.code}"` : "";
  const extraCss = [];
  if (preset) {
    extraCss.push("stylesheets/preset.css");
  }
  if (theme.custom_css) {
    extraCss.push(...theme.custom_css);
  }
  const extraCssYaml = extraCss.length > 0 ? `
extra_css:
${extraCss.map((c) => `  - ${c}`).join("\n")}
` : "";
  const extraJs = [];
  if (preset?.customJs) {
    extraJs.push("javascripts/preset.js");
  }
  if (theme.custom_js) {
    extraJs.push(...theme.custom_js);
  }
  const extraJsYaml = extraJs.length > 0 ? `
extra_javascript:
${extraJs.map((j) => `  - ${j}`).join("\n")}
` : "";
  let pluginsYaml = `plugins:
  - search:
      lang: en
  - glightbox:
      touchNavigation: true
      loop: false
      effect: zoom
      slide_effect: slide
      width: 100%
      height: auto
      zoomable: true
      draggable: true
  - minify:
      minify_html: true`;
  if (config.versioning.enabled) {
    pluginsYaml += `
  - mike:
      alias_type: symlink
      canonical_version: "${config.versioning.default_alias}"`;
  }
  let extraYaml = `extra:
  generator: false
  social: []`;
  if (config.versioning.enabled) {
    extraYaml += `
  version:
    provider: mike
    default: "${config.versioning.default_alias}"`;
  }
  return `# DocWalk Generated Configuration
# Do not edit manually \u2014 re-run 'docwalk generate' to update

site_name: "${siteName} Documentation"
site_description: "Auto-generated documentation for ${siteName}"
site_url: "${config.domain.custom ? `https://${config.domain.custom}${config.domain.base_path}` : ""}"

${isGitHubRepo ? `repo_url: "https://github.com/${config.source.repo}"
repo_name: "${config.source.repo}"` : `# repo_url: configure with your repository URL`}

theme:
  name: material
${paletteYaml}
${theme.logo ? `  logo: ${theme.logo}` : ""}
${theme.favicon ? `  favicon: ${theme.favicon}` : ""}
${fontYaml}
  features:
${features}

markdown_extensions:
  - admonition
  - pymdownx.details
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_code_format
  - pymdownx.highlight:
      anchor_linenums: true
  - pymdownx.tabbed:
      alternate_style: true
  - pymdownx.tasklist:
      custom_checkbox: true
  - tables
  - attr_list
  - md_in_html
  - toc:
      permalink: true
  - abbr
  - def_list
  - footnotes
  - pymdownx.emoji:
      emoji_index: !!python/name:material.extensions.emoji.twemoji
      emoji_generator: !!python/name:material.extensions.emoji.to_svg
  - pymdownx.inlinehilite
  - pymdownx.mark
  - pymdownx.keys

${pluginsYaml}
${extraCssYaml}${extraJsYaml}
nav:
${navYaml}

${extraYaml}
`;
}
var ThemeSchemaDefaults = {
  features: [
    "navigation.tabs",
    "navigation.sections",
    "navigation.expand",
    "navigation.top",
    "search.suggest",
    "search.highlight",
    "content.code.copy",
    "content.tabs.link"
  ]
};
function resolveAudienceSeparation(config, manifest) {
  const setting = config.analysis.audience;
  if (setting === "split") return true;
  if (setting === "unified") return false;
  return detectProjectType(manifest) === "library";
}
function detectProjectType(manifest) {
  if (manifest.projectMeta.projectType) return manifest.projectMeta.projectType;
  const allPaths = manifest.modules.map((m) => m.filePath);
  const hasPages = allPaths.some((p) => p.includes("pages/") || p.includes("app/"));
  const hasBin = allPaths.some((p) => p.includes("bin/") || p.includes("cli/"));
  const hasElectron = allPaths.some((p) => p.includes("electron") || p.includes("main.ts") || p.includes("main.js"));
  if (hasPages || hasElectron) return "application";
  const totalSymbols = manifest.modules.reduce((s, m) => s + m.symbols.length, 0);
  const exportedSymbols = manifest.modules.reduce(
    (s, m) => s + m.symbols.filter((sym) => sym.exported).length,
    0
  );
  if (totalSymbols > 0 && exportedSymbols / totalSymbols > 0.5) return "library";
  if (hasBin) return "application";
  return "unknown";
}

export {
  FREE_PRESET_IDS,
  PREMIUM_PRESET_IDS,
  registerPresets,
  loadPremiumPresets,
  resolvePreset,
  getPresetIds,
  getFreePresetIds,
  getPremiumPresetIds,
  isPremiumPreset,
  generateDocs
};
