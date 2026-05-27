#!/usr/bin/env bash
# Sync the bits of the repo we need to embed into the `homestead` binary.
#
# The Go embed directive in homestead/internal/embedfs/embed.go pulls in
# everything under homestead/internal/embedfs/workspace/. This script is
# what populates that mirror. Run it before `go build`. The Makefile target
# `make homestead` runs it for you.
#
# Why a mirror instead of `//go:embed all:../frontend`: go:embed paths must
# be siblings or children of the .go file, and the dirs we need (frontend/,
# packages/, the root lockfile) are not under homestead/. Mirroring is also
# the only sane way to exclude node_modules / .next / data / .env files.

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"
DEST="$SCRIPT_DIR/../internal/embedfs/workspace"

mkdir -p "$DEST"

# Wipe and rebuild — we never want a stale file lingering.
find "$DEST" -mindepth 1 -not -name '.gitkeep' -delete

RSYNC_EXCLUDES=(
  --exclude='node_modules'
  --exclude='.next'
  --exclude='dist'
  --exclude='data'
  --exclude='.env'
  --exclude='.env.*'
  --exclude='*.tsbuildinfo'
  --exclude='.git'
  --exclude='coverage'
  --exclude='playwright-report'
  --exclude='test-results'
  --exclude='.DS_Store'
)

# Top-level files needed for `npm ci` to work in the extracted workspace.
cp "$REPO_ROOT/package.json"      "$DEST/package.json"
cp "$REPO_ROOT/package-lock.json" "$DEST/package-lock.json"
cp "$REPO_ROOT/homestead.config.ts" "$DEST/homestead.config.ts"

# Frontend + workspace packages. The root package.json declares
# tests/e2e as a workspace, so npm ci needs its package.json present
# (the actual e2e source is excluded — see PLAYWRIGHT exclude below).
rsync -a "${RSYNC_EXCLUDES[@]}" "$REPO_ROOT/frontend/" "$DEST/frontend/"
rsync -a "${RSYNC_EXCLUDES[@]}" "$REPO_ROOT/packages/" "$DEST/packages/"
rsync -a "${RSYNC_EXCLUDES[@]}" "$REPO_ROOT/tests/e2e/" "$DEST/tests/e2e/"

echo "synced repo source into $DEST"
