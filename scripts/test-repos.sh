#!/usr/bin/env bash
# DocWalk Multi-Repo Test Script
#
# Clones test repos, runs docwalk generate -v against each, and reports results.
# Usage: ./scripts/test-repos.sh

set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────────────────

REPOS=(
  "JongoDB/verbatim-studio"    # TypeScript monorepo (Electron + backend)
  "JongoDB/CYROID"             # Python
  "JongoDB/cloudflared-fips"   # Go
  "JongoDB/ARC4DE"             # Python
)

DOCWALK_CMD="npx tsx src/cli/index.ts"
TEMP_DIR=$(mktemp -d)
RESULTS_FILE="$TEMP_DIR/results.txt"

echo "DocWalk Multi-Repo Test"
echo "═══════════════════════"
echo "Temp directory: $TEMP_DIR"
echo ""

# Track overall status
TOTAL=0
PASSED=0
FAILED=0

# ─── Test each repo ───────────────────────────────────────────────────────

for REPO in "${REPOS[@]}"; do
  TOTAL=$((TOTAL + 1))
  REPO_NAME=$(basename "$REPO")
  REPO_DIR="$TEMP_DIR/$REPO_NAME"
  echo "────────────────────────────────────────"
  echo "Testing: $REPO"
  echo "────────────────────────────────────────"

  # Clone (shallow)
  echo "  Cloning..."
  if ! git clone --depth 1 "https://github.com/$REPO.git" "$REPO_DIR" 2>/dev/null; then
    echo "  ✗ FAILED to clone $REPO"
    FAILED=$((FAILED + 1))
    echo "$REPO: CLONE_FAILED" >> "$RESULTS_FILE"
    continue
  fi

  # Create a minimal docwalk config
  cat > "$REPO_DIR/docwalk.config.yml" <<EOF
source:
  repo: "."
  branch: main
  provider: local
  languages: auto

analysis:
  depth: full
  ai_summaries: false
  dependency_graph: true
  changelog: false
  max_file_size: 500000
EOF

  # Run docwalk generate
  echo "  Running docwalk generate -v..."
  GENERATE_OUTPUT=""
  if GENERATE_OUTPUT=$(cd "$REPO_DIR" && $DOCWALK_CMD generate --full -v 2>&1); then
    echo "  ✓ Generate succeeded"
  else
    echo "  ✗ Generate failed"
    echo "  Output: $GENERATE_OUTPUT"
    FAILED=$((FAILED + 1))
    echo "$REPO: GENERATE_FAILED" >> "$RESULTS_FILE"
    continue
  fi

  # Check results
  OUTPUT_DIR="$REPO_DIR/docwalk-output"
  DOCS_DIR="$OUTPUT_DIR/docs"

  if [ ! -d "$DOCS_DIR" ]; then
    echo "  ✗ No docs directory generated"
    FAILED=$((FAILED + 1))
    echo "$REPO: NO_DOCS_DIR" >> "$RESULTS_FILE"
    continue
  fi

  # Count pages
  PAGE_COUNT=$(find "$DOCS_DIR" -name "*.md" | wc -l | tr -d ' ')
  echo "  Pages generated: $PAGE_COUNT"

  if [ "$PAGE_COUNT" -eq 0 ]; then
    echo "  ✗ Zero pages generated"
    FAILED=$((FAILED + 1))
    echo "$REPO: ZERO_PAGES" >> "$RESULTS_FILE"
    continue
  fi

  # Check for mkdocs.yml
  if [ ! -f "$OUTPUT_DIR/mkdocs.yml" ]; then
    echo "  ✗ No mkdocs.yml generated"
    FAILED=$((FAILED + 1))
    echo "$REPO: NO_MKDOCS_YML" >> "$RESULTS_FILE"
    continue
  fi

  # Check for empty index page
  INDEX_SIZE=$(wc -c < "$DOCS_DIR/index.md" 2>/dev/null || echo 0)
  if [ "$INDEX_SIZE" -lt 100 ]; then
    echo "  ⚠ Index page suspiciously small ($INDEX_SIZE bytes)"
  fi

  # Run mkdocs build if available
  MKDOCS_WARNINGS=0
  if command -v mkdocs &>/dev/null; then
    echo "  Running mkdocs build..."
    MKDOCS_OUTPUT=$(cd "$OUTPUT_DIR" && mkdocs build 2>&1) || true
    MKDOCS_WARNINGS=$(echo "$MKDOCS_OUTPUT" | grep -c "WARNING" || true)
    echo "  MkDocs warnings: $MKDOCS_WARNINGS"
  else
    echo "  (mkdocs not installed — skipping build check)"
  fi

  # Extract analyzed file count from output
  ANALYZED_COUNT=$(echo "$GENERATE_OUTPUT" | grep -o "Analyzed [0-9]* files" | grep -o "[0-9]*" || echo "?")
  echo "  Files analyzed: $ANALYZED_COUNT"

  PASSED=$((PASSED + 1))
  echo "  ✓ PASSED"
  echo "$REPO: PASSED (pages=$PAGE_COUNT, analyzed=$ANALYZED_COUNT, mkdocs_warnings=$MKDOCS_WARNINGS)" >> "$RESULTS_FILE"
  echo ""
done

# ─── Summary ──────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════"
echo "Results: $PASSED/$TOTAL passed, $FAILED failed"
echo "════════════════════════════════════════"
echo ""

if [ -f "$RESULTS_FILE" ]; then
  cat "$RESULTS_FILE"
fi

echo ""
echo "Temp directory: $TEMP_DIR"
echo "(Remove with: rm -rf $TEMP_DIR)"

# Exit with failure if any tests failed
[ "$FAILED" -eq 0 ]
