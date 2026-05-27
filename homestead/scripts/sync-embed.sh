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
#
# We use `tar | tar` (not rsync) so the script works with stock tools on
# both macOS (BSD tar) and Linux (GNU tar) — no extra deps, and it sidesteps
# rsync 3.2.x's refusal to create intermediate destination directories.

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"
DEST="$SCRIPT_DIR/../internal/embedfs/workspace"

mkdir -p "$DEST"

# Wipe and rebuild — we never want a stale file lingering.
find "$DEST" -mindepth 1 -not -name '.gitkeep' -delete

EXCLUDES=(
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

# Top-level files needed for `npm install` to work in the extracted workspace.
cp "$REPO_ROOT/package.json"      "$DEST/package.json"
cp "$REPO_ROOT/package-lock.json" "$DEST/package-lock.json"
cp "$REPO_ROOT/homestead.config.ts" "$DEST/homestead.config.ts"

# Frontend + workspace packages. The root package.json declares tests/e2e
# as a workspace, so npm needs its package.json present at install time.
( cd "$REPO_ROOT" && tar -cf - "${EXCLUDES[@]}" frontend packages tests/e2e ) \
  | tar -C "$DEST" -xf -

echo "synced repo source into $DEST"
