#!/bin/bash
set -euo pipefail

# Homestead build script.
# Builds the single `homestead` binary (a Bun-compiled CLI embedding the Vite
# SPA + the compiled Bun sidecar + the aepbase Go binary) via `make homestead`.
# At runtime the binary spawns aepbase as a child process and serves the
# sidecar in-process.

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"

echo "🏗️  Building the homestead launcher..."

# VAPID_PUBLIC_KEY is baked into the SPA at build time (packages/homestead-app/vite.config.ts
# reads process.env.VAPID_PUBLIC_KEY). Load packages/homestead-app/.env so the build picks
# it up; without it web-push subscriptions can't be created.
ENV_FILE="$PROJECT_ROOT/packages/homestead-app/.env"
if [ -f "$ENV_FILE" ]; then
  echo "🔑 Loading $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo "⚠️  $ENV_FILE not found — building without VAPID_PUBLIC_KEY."
  echo "    Create packages/homestead-app/.env with your VAPID keys (see packages/homestead-app/.env.example)."
fi

# --- Toolchain preflight -----------------------------------------------------
fail=0

if ! command -v node >/dev/null 2>&1; then
  echo "❌ node not found. Install Node.js 20+." >&2
  fail=1
fi

if ! command -v go >/dev/null 2>&1; then
  echo "❌ Go toolchain not found. Install Go 1.25+ (see aepbase/go.mod)." >&2
  fail=1
else
  GO_VER="$(go env GOVERSION 2>/dev/null | sed 's/^go//')"
  case "$GO_VER" in
    1.1[0-9]*|1.2[0-4]*)
      echo "⚠️  Go $GO_VER is older than the 1.25 required by aepbase/go.mod."
      echo "    Go will try to auto-download the 1.25 toolchain (needs network)."
      echo "    If the build fails to fetch it, install Go 1.25+ directly."
      ;;
  esac
fi

# `make homestead` compiles the sidecar with Bun.
if ! command -v bun >/dev/null 2>&1 && [ ! -x "$HOME/.bun/bin/bun" ]; then
  echo "❌ Bun not found (needed to compile the sidecar)." >&2
  echo "    Install it: curl -fsSL https://bun.sh/install | bash" >&2
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "Preflight failed — fix the items above and re-run." >&2
  exit 1
fi
# Make sure a ~/.bun install is on PATH for the make recipe.
export PATH="$PATH:$HOME/.bun/bin"

echo "🔨 make homestead"
make homestead

echo ""
echo "✅ Build complete: $PROJECT_ROOT/bin/homestead"
echo ""
echo "Next steps:"
echo "  1. Set up service:  sudo make setup-services"
echo "  2. Start:           sudo make start-services"
