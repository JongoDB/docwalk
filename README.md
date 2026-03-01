<div align="center">

<img src="docs/assets/logo.svg" alt="DocWalk" width="48" height="48">

# DocWalk

**Your codebase, documented. Automatically.**

Analyze any repository, generate a full documentation site with AI-written narrative prose, and keep it in sync with every commit. Deploy anywhere in one command.

[![npm version](https://img.shields.io/npm/v/docwalk?color=%235de4c7&style=flat-square)](https://www.npmjs.com/package/docwalk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

[Website](https://docwalk.dev) · [Documentation](https://docs.docwalk.dev) · [Getting Started](#quickstart) · [Configuration](#configuration)

</div>

---

## What is DocWalk?

DocWalk is a CLI tool that turns any codebase into a professional documentation site. It:

1. **Analyzes** your repository — AST parsing, symbol extraction, dependency graphs across 19 languages
2. **Generates** a complete documentation site — developer reference, end-user guides, architecture diagrams, and more
3. **Writes** AI-powered narrative documentation — not just templates, but real prose explaining your code
4. **Deploys** to GitHub Pages, Cloudflare Pages, Vercel, Netlify, or S3 — with custom domain support
5. **Syncs** incrementally — uses `git diff` to only re-analyze changed files, keeping docs up-to-date in seconds

## Install

```bash
# Install globally from GitHub
npm install -g github:JongoDB/docwalk

# Or clone and link (more reliable on some systems)
git clone https://github.com/JongoDB/docwalk.git ~/.docwalk-cli
cd ~/.docwalk-cli && npm install && npm link
```

## Quickstart

```bash
# Just run generate — DocWalk guides you through setup if needed
docwalk generate
```

That's it. If there's no config, DocWalk launches the Quick Start wizard: confirm your repo, set up AI (with interactive key entry and validation), pick a theme, and generate — all in one flow.

### With AI (zero config)

```bash
# AI summaries, narratives, and diagrams — no API key needed
docwalk generate --ai
```

When you pass `--ai` without any API key configured, DocWalk automatically routes through its free AI proxy service (powered by Gemini Flash). No setup required.

### With your own API key

The interactive setup prompts for your API key, validates it, and stores it in `.docwalk/.env` (gitignored) so you never have to set it again. Or set it manually:

```bash
export DOCWALK_AI_KEY=your-key-here
docwalk generate --ai
```

### Customize theme and layout

```bash
# Pick a theme and layout directly from the CLI
docwalk generate --theme startup --layout sidebar

# Or use the interactive init wizard for full customization
docwalk init
```

## How It Works

```
┌──────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────┐
│   Git    │────▶│  DocWalk     │────▶│  Zensical     │────▶│  Edge    │
│   Repo   │     │  Engine      │     │  (MkDocs)     │     │  Network │
└──────────┘     └──────────────┘     └───────────────┘     └──────────┘
  Source         AST parsing,          Static site          Cloudflare,
  code           AI narratives,        generation with      GitHub Pages,
                 dependency graphs     search, theming      Vercel, etc.
```

### Smart Sync (git-diff)

DocWalk doesn't re-analyze your entire codebase on every change. Instead:

1. Stores the last indexed commit SHA in `.docwalk/state.json`
2. On sync, runs `git diff --name-status` against the last indexed commit
3. Only re-analyzes changed, added, or renamed files
4. Runs **cross-file impact analysis** to catch downstream doc changes
5. Rebuilds only affected pages — sub-30-second updates for typical PRs

```bash
# See what would change without applying
docwalk sync --dry-run

# Run incremental sync
docwalk sync

# Force full re-analysis
docwalk sync --full
```

## AI-Powered Documentation

DocWalk's AI engine writes narrative documentation, generates diagrams, and builds user guides. It works out of the box with zero configuration via the built-in proxy, or you can bring your own API key for higher rate limits.

### AI Providers

| Provider | Model | Setup |
|----------|-------|-------|
| **DocWalk Proxy** | Gemini 2.5 Flash | Zero config — used automatically when no key is set |
| **Google Gemini** | Gemini 2.5 Flash | `export GEMINI_API_KEY=...` or `export DOCWALK_AI_KEY=...` |
| **Anthropic** | Claude | `export ANTHROPIC_API_KEY=...` |
| **OpenAI** | GPT-4o | `export OPENAI_API_KEY=...` |
| **OpenRouter** | Any model | `export OPENROUTER_API_KEY=...` |
| **Ollama** | Any local model | Self-hosted, no key needed |

DocWalk checks for API keys in this order:
1. The configured `api_key_env` variable (default: `DOCWALK_AI_KEY`)
2. `DOCWALK_AI_KEY` (universal override)
3. Provider-specific well-known variables (e.g. `ANTHROPIC_API_KEY`)
4. If nothing is found → automatic fallback to the free DocWalk proxy

### What AI Generates

- **Narrative prose** on every documentation page — explaining what code does, why it exists, and how to use it
- **Source citations** linking prose back to specific files and line numbers
- **Sequence diagrams** showing interaction flows between components
- **Flowcharts** visualizing data pipelines and processing steps
- **Module summaries** for every file in your codebase
- **FAQ answers** generated from project signals
- **Troubleshooting guides** based on detected error types
- **Dynamic page structure** — the AI analyzes your codebase and suggests which conceptual pages to generate

### Smart Context Builder

Instead of dumping entire files into prompts, DocWalk's context builder assembles ranked code chunks using the dependency graph:

- Direct dependencies score highest
- Transitive dependencies, same-directory files, and README sections fill the token budget
- Result: focused, relevant context for every LLM call

## Theme Presets

DocWalk ships with four built-in themes. Pass `--theme` to `init` or `generate`, or set `theme.preset` in config.

| Preset | Style |
|--------|-------|
| **developer** | Dark-first, code-dense, mint accent (default) |
| **corporate** | Clean, professional, navy palette |
| **startup** | Vibrant, modern, purple + amber |
| **minimal** | Reading-focused, distraction-free |

Layout modes: `tabs` (default), `sidebar`, `tabs-sticky`

```bash
docwalk generate --theme corporate --layout tabs-sticky
```

## End-User Documentation

DocWalk generates two documentation audiences in a single build:

**Developer Reference** — architecture, API reference, module docs, types, dependencies

**User Guide** — documentation for people who *use* the software, not just build it:

| Page | Content |
|------|---------|
| **Overview** | What the software does, who it's for |
| **Getting Started** | Installation, first-use tutorial |
| **Features** | Feature-by-feature documentation |
| **Troubleshooting** | Error reference, common issues, solutions |
| **FAQ** | Auto-generated from project signals |

User content is extracted from CLI commands (Commander/Yargs/argparse patterns), API routes (Express/Koa/Flask), config schemas (Zod/JSON Schema), and error classes.

## Architecture Diagrams

DocWalk generates multiple diagram types using [Mermaid](https://mermaid.js.org/):

- **Dependency graphs** — module-level import relationships (static, no AI)
- **Class diagrams** — inheritance hierarchies, interface implementations, member visibility (static, no AI)
- **Sequence diagrams** — component interaction flows (AI-generated)
- **Flowcharts** — data processing pipelines (AI-generated)

All diagrams are zoomable — click any diagram to open a full-screen zoom/pan overlay.

## Monorepo Support

DocWalk detects workspace structures (npm workspaces, pnpm-workspace.yaml, Lerna) and resolves cross-package imports. Architecture diagrams show edges between workspace packages instead of dead ends.

## Configuration

DocWalk is configured via `docwalk.config.yml` in your repo root. Run `docwalk init` to generate one interactively, or create it manually:

```yaml
source:
  repo: your-org/your-repo
  branch: main
  include: [src/**, lib/**, api/**]
  exclude: [tests/**, node_modules/**]
  languages: auto

analysis:
  depth: full              # full | surface | api-only
  ai_summaries: true       # Enable AI-powered descriptions
  ai_provider:
    name: gemini           # anthropic | openai | gemini | ollama | openrouter | docwalk-proxy
    model: gemini-2.5-flash
  ai_narrative: true       # LLM-written prose on pages
  ai_diagrams: true        # AI-generated sequence/flow diagrams
  ai_structure: false      # AI-suggested page structure
  dependency_graph: true
  changelog: true
  user_docs: true          # Generate end-user documentation
  user_docs_config:
    getting_started: true
    features: true
    troubleshooting: true
    faq: true
    overview: true
    section_title: "User Guide"
  qa_widget: false         # Embeddable Q&A chat (Team tier)

sync:
  trigger: on_push         # on_push | cron | manual
  diff_strategy: incremental
  impact_analysis: true

deploy:
  provider: cloudflare     # gh-pages | cloudflare | vercel | netlify | s3
  project: your-docs
  auto_ssl: true

domain:
  custom: docs.yoursite.com
  base_path: /project
  dns_auto: true

theme:
  preset: developer        # developer | corporate | startup | minimal
  layout: tabs             # tabs | sidebar | tabs-sticky
  palette: slate
  accent: "#5de4c7"
  features:
    - navigation.tabs
    - navigation.sections
    - search.suggest
    - content.code.copy
```

## Deploy Providers

| Provider | CLI/API | Custom Domain | Preview URLs | CI Config |
|----------|---------|---------------|--------------|-----------|
| **GitHub Pages** | GitHub Actions | CNAME | Per-branch | `.github/workflows/docwalk-deploy.yml` |
| **Cloudflare Pages** | Wrangler | Auto DNS + SSL | Per-PR | `.github/workflows/docwalk-deploy.yml` |
| **Vercel** | Vercel CLI | Auto DNS | Per-commit | `.github/workflows/docwalk-deploy.yml` |
| **Netlify** | Netlify CLI | Auto DNS | Per-PR | `.github/workflows/docwalk-deploy.yml` |
| **AWS S3** | AWS CLI | CloudFront | Manual | `.github/workflows/docwalk-deploy.yml` |

```bash
# Deploy to your configured provider
docwalk deploy

# Override provider and domain
docwalk deploy --provider cloudflare --domain docs.yoursite.com

# Generate CI/CD pipeline for automatic deploys
docwalk ci-setup
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `docwalk init` | Interactive setup wizard — creates `docwalk.config.yml` |
| `docwalk generate` | Analyze codebase and generate docs |
| `docwalk generate --ai` | Generate with AI summaries, narratives, and diagrams |
| `docwalk generate --theme <preset>` | Generate with a specific theme preset |
| `docwalk generate --layout <mode>` | Generate with a specific layout (tabs, sidebar, tabs-sticky) |
| `docwalk sync` | Incremental sync via git-diff |
| `docwalk deploy` | Deploy to hosting provider |
| `docwalk undeploy` | Remove deployment from hosting provider |
| `docwalk dev` | Start local preview server |
| `docwalk dev --watch` | Preview with auto-regeneration on file changes |
| `docwalk status` | Show sync state and project info |
| `docwalk doctor` | Check prerequisites (Zensical/Python) |
| `docwalk doctor --install` | Auto-install missing dependencies |
| `docwalk ci-setup` | Generate CI/CD pipeline config |
| `docwalk version list` | List available documentation versions |
| `docwalk version deploy <tag>` | Deploy a specific version tag |

## Supported Languages

TypeScript, JavaScript, Python, Go, Rust, Java, C#, Ruby, PHP, Swift, Kotlin, Scala, Elixir, Dart, Lua, Zig, Haskell, C, C++

## Development

```bash
git clone https://github.com/JongoDB/docwalk.git
cd docwalk
npm install
npm link    # makes `docwalk` available globally

# Run in dev mode (without link)
npm run docwalk -- init
npm run docwalk -- generate
npm run docwalk -- dev

# Tests (517 tests)
npm test

# Type check
npm run typecheck

# Build
npm run build
```

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
<img src="docs/assets/logo.svg" alt="" width="16" height="16"> <strong>DocWalk</strong> — Your codebase, documented. Automatically.
</div>
