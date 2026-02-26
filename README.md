<div align="center">

# ⚒ DocWalk

**Your codebase, documented. Automatically.**

Analyze any repository and generate a full [MkDocs Material](https://squidfunk.github.io/mkdocs-material/) documentation site — API references, architecture guides, navigation trees — then keep it in sync with every commit via intelligent git-diff analysis. Deploy anywhere in one command.

[![npm version](https://img.shields.io/npm/v/docwalk?color=%235de4c7&style=flat-square)](https://www.npmjs.com/package/docwalk)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

[Website](https://docwalk.dev) · [Documentation](https://docs.docwalk.dev) · [Getting Started](#quickstart) · [Configuration](#configuration)

</div>

---

## What is DocWalk?

DocWalk is a CLI tool that turns any codebase into a professional documentation site. It:

1. **Analyzes** your repository — AST parsing, symbol extraction, dependency graphs across 20+ languages
2. **Generates** a complete MkDocs Material site — overview, API reference, architecture, changelog
3. **Deploys** to GitHub Pages, Cloudflare Pages, Vercel, Netlify, or S3 — with custom domain support
4. **Syncs** incrementally — uses `git diff` to only re-analyze changed files, keeping docs up-to-date in seconds

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

That's it. Zero to live docs in under 2 minutes.

## How It Works

```
┌──────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────┐
│   Git    │────▶│  DocWalk     │────▶│  MkDocs       │────▶│  Edge    │
│   Repo   │     │  Engine      │     │  Material     │     │  Network │
└──────────┘     └──────────────┘     └───────────────┘     └──────────┘
  Source         AST parsing,          Static site          Cloudflare,
  code           symbol extraction,    generation with      GitHub Pages,
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
  depth: full          # full | surface | api-only
  ai_summaries: false  # Enable AI-powered descriptions
  dependency_graph: true
  changelog: true

sync:
  trigger: on_push     # on_push | cron | manual
  diff_strategy: incremental
  impact_analysis: true

deploy:
  provider: cloudflare # gh-pages | cloudflare | vercel | netlify | s3
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
│   │   ├── types.ts      # Core type definitions
│   │   ├── language-detect.ts
│   │   └── file-discovery.ts
│   ├── generators/       # MkDocs Material site generator
│   │   └── mkdocs.ts     # Page generation + mkdocs.yml
│   ├── sync/             # Git-diff incremental sync engine
│   │   └── engine.ts     # Diff computation, impact analysis
│   ├── deploy/           # Hosting provider integrations
│   │   ├── index.ts      # Provider interface + registry
│   │   └── providers/    # gh-pages, cloudflare, vercel
│   ├── config/           # Zod-validated configuration
│   │   ├── schema.ts     # Config schema definitions
│   │   └── loader.ts     # cosmiconfig-based loader
│   ├── utils/            # Shared utilities
│   └── index.ts          # Public API exports
├── tests/
├── docs/                 # DocWalk's own documentation
└── package.json
```

## Development

```bash
git clone https://github.com/your-org/docwalk.git
cd docwalk
npm install

# Run in dev mode
npm run docwalk -- init --repo your-org/your-repo
npm run docwalk -- generate
npm run docwalk -- dev

# Tests
npm test

# Build
npm run build
```

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
<strong>⚒ DocWalk</strong> — Your codebase, documented. Automatically.
</div>
