# CLAUDE.md — DocWalk Development Guide

## What is DocWalk?

DocWalk is a CLI tool that analyzes any codebase and generates a full MkDocs Material documentation site, then keeps it in sync via git-diff intelligence. It deploys to GitHub Pages, Cloudflare Pages, Vercel, Netlify, or S3 with custom domain support.

**Tagline:** "Your codebase, documented. Automatically."

## Project Architecture

```
src/
├── cli/              # Commander.js CLI (entry: src/cli/index.ts)
│   └── commands/     # init, generate, sync, deploy, dev, status, ci-setup
├── analysis/         # Static analysis engine
│   ├── engine.ts     # Multi-pass orchestrator
│   ├── parsers/      # Per-language parsers (tree-sitter)
│   │   ├── index.ts  # Parser interface + registry
│   │   └── typescript.ts  # Reference parser (regex-based stub → needs tree-sitter)
│   ├── types.ts      # Core IR types (Symbol, Module, Manifest)
│   ├── language-detect.ts  # Extension → language mapping
│   └── file-discovery.ts   # Glob-based file discovery
├── generators/       # MkDocs Material site generator
│   └── mkdocs.ts     # Manifest → Markdown pages + mkdocs.yml
├── sync/             # Git-diff incremental sync engine
│   └── engine.ts     # Diff, impact analysis, state management
├── deploy/           # Hosting providers
│   ├── index.ts      # Provider interface + registry
│   └── providers/    # github-pages.ts, cloudflare.ts, vercel.ts
├── config/           # Zod schema + cosmiconfig loader
│   ├── schema.ts     # Full config schema (source, analysis, sync, deploy, domain, theme, versioning)
│   └── loader.ts     # Discovers and validates docwalk.config.yml
├── utils/            # Logger, hashing
└── index.ts          # Public API barrel exports
```

## Key Design Decisions

- **Config-driven**: Everything flows through `docwalk.config.yml` validated by Zod schemas in `src/config/schema.ts`
- **Incremental by default**: Sync engine stores last commit SHA in `.docwalk/state.json`, diffs against it
- **Provider-agnostic deploy**: `DeployProvider` interface in `src/deploy/index.ts` — implement `checkAuth()`, `deploy()`, `configureDomain()`, `generateCIConfig()`
- **Extensible parsers**: `LanguageParser` interface in `src/analysis/parsers/index.ts` — register with `registerParser()`
- **MkDocs Material output**: All generated docs are standard MkDocs-compatible Markdown

## What's Built (Scaffolding Complete)

✅ Full TypeScript project structure with tsconfig, package.json, vitest  
✅ Zod config schema with all options (source, analysis, sync, deploy, domain, theme, versioning, plugins, hooks)  
✅ Config loader with cosmiconfig  
✅ Analysis engine orchestrator with file discovery, language detection  
✅ TypeScript parser (regex-based stub — needs tree-sitter upgrade)  
✅ Git-diff sync engine with cross-file impact analysis  
✅ MkDocs Material generator (pages, nav tree, mkdocs.yml)  
✅ Deploy provider interface + implementations (GitHub Pages, Cloudflare, Vercel)  
✅ Complete CLI with 7 commands (init, generate, sync, deploy, dev, status, ci-setup)  
✅ Interactive init wizard with inquirer  
✅ Unit tests for config schema and language detection  
✅ Landing page (docs/index.html)  
✅ README, LICENSE, example config  

## What Needs Work (Priority Order)

### P0 — Make It Actually Work
1. **Install deps and verify compilation**: `npm install && npm run typecheck`
2. **Tree-sitter integration**: Replace the regex-based TypeScript parser (`src/analysis/parsers/typescript.ts`) with actual tree-sitter AST parsing. The current parser is a working skeleton that handles common patterns but misses nested structures, decorators, complex generics, etc.
3. **Register parsers**: The parser registry (`src/analysis/parsers/index.ts`) has TODO comments — import and register the TypeScript parser, then build Python and Go parsers following the same `LanguageParser` interface
4. **Register deploy providers**: Same pattern in `src/deploy/index.ts` — import and register GitHubPages, Cloudflare, Vercel providers
5. **End-to-end test**: Run `npx tsx src/cli/index.ts init` then `generate` against a real repo and verify output

### P1 — Complete Core Features
6. **Python parser**: Implement `src/analysis/parsers/python.ts` — extract functions, classes, decorators, type hints, docstrings
7. **Go parser**: Implement `src/analysis/parsers/go.ts` — extract functions, structs, interfaces, methods, doc comments
8. **Rust parser**: Implement `src/analysis/parsers/rust.ts`
9. **AI summarization**: Wire up the `ai_summaries` config option — call Anthropic/OpenAI API to generate human-readable descriptions for modules and symbols
10. **Changelog generator**: Populate the changelog page from `git log` with conventional commit parsing
11. **Netlify + S3 deploy providers**: Implement remaining providers following the existing pattern
12. **Versioning**: Implement Mike-compatible versioned docs from git tags

### P2 — Polish
13. **MkDocs template improvements**: Better Markdown generation — admonitions for deprecations, tabbed code examples, proper Mermaid diagram sizing
14. **Error handling**: Add proper error boundaries in CLI commands with user-friendly messages
15. **Progress bars**: Replace log statements with listr2 task lists for prettier CLI output
16. **Plugin system**: Implement the hooks/plugin lifecycle defined in the config schema
17. **Integration tests**: Test against real repos (CYROID, a Python project, a Go project)
18. **npx binary**: Make `bin/docwalk.js` work correctly for both dev and published modes

## Commands to Run

```bash
npm install                          # Install dependencies
npm run typecheck                    # Verify TypeScript compiles
npm test                             # Run tests
npm run docwalk -- init              # Test the init wizard
npm run docwalk -- generate          # Test analysis + generation
npm run docwalk -- status            # Test status display
npm run build                        # Build for distribution
```

## Security

- **Hook commands run with `shell: true`**: The hooks executor (`src/utils/hooks.ts`) passes user-defined hook commands through the system shell via `execa(command, { shell: true })`. This is intentional — hooks need shell features like pipes, environment variable expansion, and glob patterns. However, this means **untrusted `docwalk.config.yml` files could execute arbitrary commands**. Only run DocWalk against config files you trust. This is the same trust model as Makefiles, npm scripts, and Git hooks.

## Style & Conventions

- ESM modules throughout (`"type": "module"` in package.json)
- All imports use `.js` extension (required for ESM)
- Barrel exports via `index.ts` in each directory
- Chalk for CLI colors, ora/listr2 for spinners
- Zod for all validation
- vitest for testing
- Types defined close to their consumers, shared types in `analysis/types.ts`

## Branding

- **Name**: DocWalk
- **Tagline**: "Your codebase, documented. Automatically."
- **Icon**: 👣
- **Accent color**: `#5de4c7`
- **Font stack**: JetBrains Mono (code), Instrument Serif (display), DM Sans (body)
- **Tone**: Developer-first, no-nonsense, premium-feeling
