<div align="center">

# 👣 DocWalk

**Your codebase, documented. Automatically.**

Analyze any repository, generate a full [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) documentation site with AI-written narrative prose, and keep it in sync with every commit. Deploy anywhere in one command.

[![npm version](https://img.shields.io/npm/v/docwalk?color=%235de4c7&style=flat-square)](https://www.npmjs.com/package/docwalk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

[Website](https://docwalk.dev) · [Documentation](https://docs.docwalk.dev) · [Getting Started](#quickstart) · [Configuration](#configuration)

</div>

---

## What is DocWalk?

DocWalk is a CLI tool that turns any codebase into a professional documentation site. It:

1. **Analyzes** your repository — AST parsing, symbol extraction, dependency graphs across 19 languages
2. **Generates** a complete MkDocs Material site — developer reference, end-user guides, architecture diagrams, and more
3. **Writes** AI-powered narrative documentation — not just templates, but real prose explaining your code
4. **Deploys** to GitHub Pages, Cloudflare Pages, Vercel, Netlify, or S3 — with custom domain support
5. **Syncs** incrementally — uses `git diff` to only re-analyze changed files, keeping docs up-to-date in seconds

## Quickstart

```bash
# Initialize DocWalk in your repo
npx docwalk init --repo your-org/your-repo

# Analyze and generate documentation
npx docwalk generate

# Preview locally
npx docwalk dev

# Deploy to your chosen provider
npx docwalk deploy --provider cloudflare --domain docs.yoursite.com/project
```

## How It Works

```
┌──────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────┐
│   Git    │────▶│  DocWalk     │────▶│  MkDocs       │────▶│  Edge    │
│   Repo   │     │  Engine      │     │  Material     │     │  Network │
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
npx docwalk sync --dry-run

# Run incremental sync
npx docwalk sync

# Force full re-analysis
npx docwalk sync --full
```

## AI-Powered Documentation

When AI is enabled, DocWalk generates LLM-written narrative prose instead of template strings. The AI engine supports multiple providers — bring your own API key.

### Multi-Provider LLM Support

| Provider | Model | Notes |
|----------|-------|-------|
| **Anthropic** | Claude | Default for Pro tier |
| **OpenAI** | GPT-4o | Full API support |
| **Google Gemini** | Gemini 2.0 Flash | Free tier available |
| **Ollama** | Any local model | Self-hosted, private |
| **OpenRouter** | Any model | Multi-model gateway |

### What AI Generates

- **Narrative prose** on every documentation page — explaining what code does, why it exists, and how to use it
- **Source citations** linking prose back to specific files and line numbers
- **Sequence diagrams** showing interaction flows between components
- **Flowcharts** visualizing data pipelines and processing steps
- **FAQ answers** generated from project signals
- **Troubleshooting guides** based on detected error types
- **Dynamic page structure** — the AI analyzes your codebase and suggests which conceptual pages to generate

### Smart Context Builder

Instead of dumping entire files into prompts, DocWalk's context builder assembles ranked code chunks using the dependency graph:

- Direct dependencies score highest
- Transitive dependencies, same-directory files, and README sections fill the token budget
- Result: focused, relevant context for every LLM call

## End-User Documentation

DocWalk generates two documentation audiences in a single build:

**Developer Reference** (existing) — architecture, API reference, module docs, types, dependencies

**User Guide** (new) — documentation for people who *use* the software, not just build it:

| Page | Content |
|------|---------|
| **Overview** | What the software does, who it's for |
| **Getting Started** | Installation, first-use tutorial |
| **Features** | Feature-by-feature documentation |
| **Troubleshooting** | Error reference, common issues, solutions |
| **FAQ** | Auto-generated from project signals |

User content is extracted from CLI commands (Commander/Yargs/argparse patterns), API routes (Express/Koa/Flask), config schemas (Zod/JSON Schema), and error classes.

## Q&A Widget

Embed an interactive chat widget in your generated docs that answers questions about your codebase using RAG:

1. **Build-time:** Pages are chunked, embedded, and serialized to a search index
2. **Query-time:** Widget sends questions to the Q&A API, which finds relevant chunks via cosine similarity and prompts the LLM with context
3. **Result:** Answers with citations back to your documentation pages

## Architecture Diagrams

DocWalk generates multiple diagram types using [Mermaid](https://mermaid.js.org/):

- **Dependency graphs** — module-level import relationships (static, no AI)
- **Class diagrams** — inheritance hierarchies, interface implementations, member visibility (static, no AI)
- **Sequence diagrams** — component interaction flows (AI-generated)
- **Flowcharts** — data processing pipelines (AI-generated)

## Monorepo Support

DocWalk detects workspace structures (npm workspaces, pnpm-workspace.yaml, Lerna) and resolves cross-package imports. Architecture diagrams show edges between workspace packages instead of dead ends.

## Configuration

DocWalk is configured via a single `docwalk.config.yml` in your repo root:

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
    name: gemini           # anthropic | openai | gemini | ollama | openrouter
    model: gemini-2.0-flash
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
  palette: slate
  accent: "#5de4c7"
  features:
    - navigation.tabs
    - navigation.sections
    - search.suggest
    - content.code.copy
```

Run `npx docwalk init` for an interactive setup wizard that generates this for you.

## Deploy Providers

| Provider | CLI/API | Custom Domain | Preview URLs | CI Config |
|----------|---------|---------------|--------------|-----------|
| **GitHub Pages** | GitHub Actions | CNAME | Per-branch | `.github/workflows/docwalk-deploy.yml` |
| **Cloudflare Pages** | Wrangler | Auto DNS + SSL | Per-PR | `.github/workflows/docwalk-deploy.yml` |
| **Vercel** | Vercel CLI | Auto DNS | Per-commit | `.github/workflows/docwalk-deploy.yml` |
| **Netlify** | Netlify CLI | Auto DNS | Per-PR | `.github/workflows/docwalk-deploy.yml` |
| **AWS S3** | AWS CLI | CloudFront | Manual | `.github/workflows/docwalk-deploy.yml` |

```bash
# Generate CI/CD pipeline for your provider
npx docwalk ci-setup
```

## Custom Domains

DocWalk handles domain configuration automatically:

```bash
# Subdomain
npx docwalk deploy --domain docs.yoursite.com

# Subdomain + subpath
npx docwalk deploy --domain docs.yoursite.com/project

# Root domain
npx docwalk deploy --domain docs.yourproduct.dev
```

DNS records, SSL certificates, and reverse proxy configs are provisioned automatically through your provider's API.

## Supported Languages

TypeScript, JavaScript, Python, Go, Rust, Java, C#, Ruby, PHP, Swift, Kotlin, Scala, Elixir, Dart, Lua, Zig, Haskell, C, C++

Uses [tree-sitter](https://tree-sitter.github.io/tree-sitter/) for accurate AST parsing. Custom language parsers can be added via the plugin API.

## CLI Reference

| Command | Description |
|---------|-------------|
| `docwalk init` | Interactive setup wizard |
| `docwalk generate` | Analyze codebase and generate docs |
| `docwalk sync` | Incremental sync via git-diff |
| `docwalk deploy` | Deploy to hosting provider |
| `docwalk dev` | Start local preview server |
| `docwalk status` | Show sync state and project info |
| `docwalk ci-setup` | Generate CI/CD pipeline config |

## Project Structure

```
docwalk/
├── src/
│   ├── cli/              # Commander.js CLI + subcommands
│   │   ├── index.ts      # CLI entry point
│   │   └── commands/     # init, generate, sync, deploy, dev, status, ci-setup
│   ├── analysis/         # Static analysis engine
│   │   ├── engine.ts     # Multi-pass analysis orchestrator
│   │   ├── parsers/      # Per-language tree-sitter parsers
│   │   ├── providers/    # AI providers (Anthropic, OpenAI, Gemini, Ollama, OpenRouter)
│   │   ├── context-builder.ts   # Smart context assembly for LLM calls
│   │   ├── workspace-resolver.ts # Monorepo workspace detection
│   │   ├── structure-advisor.ts  # AI-driven page structure suggestions
│   │   ├── types.ts      # Core type definitions
│   │   ├── language-detect.ts
│   │   └── file-discovery.ts
│   ├── generators/       # MkDocs Material site generator
│   │   ├── mkdocs.ts     # Page orchestration + mkdocs.yml
│   │   ├── narrative-engine.ts  # AI prose generation with citations
│   │   ├── diagrams.ts          # Multi-type Mermaid diagram generation
│   │   ├── user-content-extractor.ts  # CLI/route/config signal extraction
│   │   ├── pages/        # Per-page generators (overview, architecture, module,
│   │   │                 #   user-guide, features, troubleshooting, faq, etc.)
│   │   └── qa-widget/    # Embeddable Q&A chat component
│   ├── qa/               # Q&A RAG pipeline (chunker, embedder, vector store)
│   ├── sync/             # Git-diff incremental sync engine
│   │   └── engine.ts     # Diff computation, impact analysis
│   ├── deploy/           # Hosting provider integrations
│   │   ├── index.ts      # Provider interface + registry
│   │   └── providers/    # gh-pages, cloudflare, vercel, netlify, s3
│   ├── config/           # Zod-validated configuration
│   │   ├── schema.ts     # Config schema definitions
│   │   └── loader.ts     # cosmiconfig-based loader
│   ├── utils/            # Shared utilities
│   └── index.ts          # Public API exports
├── worker/               # Cloudflare Workers (Try It, Q&A API)
├── tests/                # Unit + integration tests (506 tests)
├── docs/                 # DocWalk's own documentation
└── package.json
```

## Development

```bash
git clone https://github.com/JongoDB/docwalk.git
cd docwalk
npm install

# Run in dev mode
npm run docwalk -- init --repo your-org/your-repo
npm run docwalk -- generate
npm run docwalk -- dev

# Tests
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
<strong>👣 DocWalk</strong> — Your codebase, documented. Automatically.
</div>
