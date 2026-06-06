#!/bin/bash
set -euo pipefail

# For binary + homestead.config.ts deployments, prefer `homestead update`
# (pull the config repo + restart) — no source tree or toolchain required.
# This script is for SOURCE-TREE deployments of this repo: it additionally
# rebuilds the binary from source, which `homestead update` deliberately does
# not do.
#
# Homestead deployment script.
# Rebuilds the single `homestead` binary and restarts the one systemd
# service, with automatic rollback on failure.
#
# Usage:
#   ./deploy.sh           - Build current code and restart the service
#   ./deploy.sh --auto    - Pull from origin, deploy if there are updates (timer)
#   ./deploy.sh --force   - Rebuild even if no changes are detected
#
# aepbase runs as a child process of the homestead binary and its schema is
# synced by the Bun sidecar on boot, so a restart picks up schema changes.
# Data persists in aepbase/data/ (passed to homestead via --data-dir).

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

AUTO_MODE=false
FORCE_BUILD=false
BRANCH="${DEPLOY_BRANCH:-main}"
SERVICE="${DEPLOY_SERVICE:-homeos}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="${DEPLOY_LOG_FILE:-$PROJECT_ROOT/deployment.log}"
BINARY="$PROJECT_ROOT/bin/homestead"

for arg in "$@"; do
  case $arg in
    --auto) AUTO_MODE=true ;;
    --force) FORCE_BUILD=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

log() { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

cd "$PROJECT_ROOT"
log "${BLUE}🚀 Homestead deployment${NC}"

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  log "${RED}❌ Not a git repository${NC}"
  exit 1
fi

PREVIOUS_COMMIT=$(git rev-parse HEAD)
log "${BLUE}Current:${NC} $PREVIOUS_COMMIT"

rebuild() {
  # Build into the binary. Logs stream to the deploy log.
  ./deployment/build.sh 2>&1 | tee -a "$LOG_FILE"
}

rollback() {
  log "${YELLOW}↩️  Rolling back to $PREVIOUS_COMMIT${NC}"
  git reset --hard "$PREVIOUS_COMMIT" 2>&1 | tee -a "$LOG_FILE"
  if rebuild; then
    sudo systemctl restart "$SERVICE" 2>&1 | tee -a "$LOG_FILE" || true
  fi
}

if [ "$AUTO_MODE" = true ]; then
  log "${BLUE}🔍 Checking for updates...${NC}"
  if ! git fetch origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"; then
    log "${RED}❌ Failed to fetch from remote${NC}"
    exit 0
  fi
  if ! git rev-parse --verify "origin/$BRANCH" > /dev/null 2>&1; then
    log "${RED}❌ Branch 'origin/$BRANCH' does not exist${NC}"
    exit 1
  fi
  REMOTE_COMMIT=$(git rev-parse "origin/$BRANCH")
  log "${BLUE}Remote:${NC} $REMOTE_COMMIT"
  if [ "$PREVIOUS_COMMIT" = "$REMOTE_COMMIT" ]; then
    log "${GREEN}✅ Already up to date${NC}"
    exit 0
  fi
  log "${YELLOW}📥 Updates available${NC}"
  git log --oneline --graph --color "$PREVIOUS_COMMIT..$REMOTE_COMMIT" | tee -a "$LOG_FILE"
  git reset --hard "origin/$BRANCH" 2>&1 | tee -a "$LOG_FILE"
  NEW_COMMIT=$REMOTE_COMMIT
else
  NEW_COMMIT=$PREVIOUS_COMMIT
fi

# Everything (SPA, sidecar, aepbase, modules) compiles into the single binary,
# so any source change means a rebuild. Only the dependency manifests gate a
# fresh `npm ci`.
NEEDS_BUILD=false
DEPS_CHANGED=false
if [ "$PREVIOUS_COMMIT" != "$NEW_COMMIT" ]; then
  CHANGED=$(git diff --name-only "$PREVIOUS_COMMIT..$NEW_COMMIT")
  if echo "$CHANGED" | grep -qE "^(packages|aepbase|scripts)/|^homestead\.config\.ts$"; then
    NEEDS_BUILD=true
    log "${YELLOW}🔄 Source changes detected${NC}"
  fi
  if echo "$CHANGED" | grep -qE "^(package\.json|package-lock\.json)$"; then
    DEPS_CHANGED=true
    NEEDS_BUILD=true
    log "${YELLOW}📦 Workspace dependencies changed${NC}"
  fi
fi
[ "$FORCE_BUILD" = true ] && NEEDS_BUILD=true
[ ! -x "$BINARY" ] && { log "${YELLOW}⚠️  homestead binary missing${NC}"; NEEDS_BUILD=true; }

if [ "$DEPS_CHANGED" = true ] || { [ "$NEEDS_BUILD" = true ] && [ ! -d node_modules ]; }; then
  log "${BLUE}📦 Installing workspace dependencies...${NC}"
  if ! npm ci 2>&1 | tee -a "$LOG_FILE"; then
    log "${RED}❌ npm ci failed${NC}"
    [ "$AUTO_MODE" = true ] && git reset --hard "$PREVIOUS_COMMIT" 2>&1 | tee -a "$LOG_FILE"
    exit 1
  fi
fi

if [ "$NEEDS_BUILD" = true ]; then
  log "${BLUE}🔨 Building homestead binary...${NC}"
  if ! rebuild; then
    log "${RED}❌ Build failed — service left running the previous binary${NC}"
    [ "$AUTO_MODE" = true ] && git reset --hard "$PREVIOUS_COMMIT" 2>&1 | tee -a "$LOG_FILE"
    exit 1
  fi
  log "${GREEN}✅ Build complete${NC}"
else
  log "${BLUE}⏭️  No changes — skipping build${NC}"
fi

log "${BLUE}🔄 Restarting $SERVICE...${NC}"
sudo systemctl restart "$SERVICE" 2>&1 | tee -a "$LOG_FILE"
sleep 3

if ! sudo systemctl is-active --quiet "$SERVICE"; then
  log "${RED}❌ $SERVICE failed to start${NC}"
  sudo journalctl -u "$SERVICE" -n 50 --no-pager | tee -a "$LOG_FILE"
  [ "$AUTO_MODE" = true ] && rollback
  exit 1
fi

log "${GREEN}✅ Deployment successful!${NC}"
log "${BLUE}Homestead:${NC} http://localhost:3000"
