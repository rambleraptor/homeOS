#!/bin/bash
set -e

# Homestead Unified Deployment Script
# Handles deployment, updates, and service restarts with automatic rollback.
#
# Usage:
#   ./deploy.sh           - Deploy current code
#   ./deploy.sh --auto    - Check for updates, deploy if available (systemd timer)
#   ./deploy.sh --force   - Force rebuild even if no changes detected
#
# Note: aepbase schema changes (aepbase/terraform/) are NOT applied by this
# script. Run `terraform apply` manually in aepbase/terraform/ when the
# schema changes. Data persists in aepbase/data/aepbase.db.

export PATH="/opt/node22/bin:$PATH"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

AUTO_MODE=false
FORCE_BUILD=false
BRANCH="${DEPLOY_BRANCH:-main}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_FILE="${DEPLOY_LOG_FILE:-$PROJECT_ROOT/deployment.log}"

for arg in "$@"; do
  case $arg in
    --auto) AUTO_MODE=true ;;
    --force) FORCE_BUILD=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

log() {
  echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "${BLUE}🚀 Homestead Deployment${NC}"
cd "$PROJECT_ROOT"

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  log "${RED}❌ Not a git repository${NC}"
  exit 1
fi

PREVIOUS_COMMIT=$(git rev-parse HEAD)
log "${BLUE}Current:${NC} $PREVIOUS_COMMIT"

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

  REMOTE_COMMIT=$(git rev-parse origin/$BRANCH)
  log "${BLUE}Remote:${NC} $REMOTE_COMMIT"

  if [ "$PREVIOUS_COMMIT" = "$REMOTE_COMMIT" ]; then
    log "${GREEN}✅ Already up to date${NC}"
    exit 0
  fi

  log "${YELLOW}📥 Updates available${NC}"
  git log --oneline --graph --color $PREVIOUS_COMMIT..$REMOTE_COMMIT | tee -a "$LOG_FILE"
  git reset --hard origin/$BRANCH 2>&1 | tee -a "$LOG_FILE"
  NEW_COMMIT=$REMOTE_COMMIT
else
  NEW_COMMIT=$PREVIOUS_COMMIT
fi

# Detect what changed
AEPBASE_CHANGED=false
FRONTEND_CHANGED=false
DEPS_CHANGED=false
SCRIPTS_DEPS_CHANGED=false

if [ "$PREVIOUS_COMMIT" != "$NEW_COMMIT" ] || [ "$FORCE_BUILD" = true ]; then
  CHANGED=$(git diff --name-only $PREVIOUS_COMMIT..$NEW_COMMIT)

  if echo "$CHANGED" | grep -q "^aepbase/"; then
    AEPBASE_CHANGED=true
    log "${YELLOW}🔄 aepbase changes detected${NC}"
  fi
  if echo "$CHANGED" | grep -q "^frontend/"; then
    FRONTEND_CHANGED=true
    log "${YELLOW}🔄 Frontend changes detected${NC}"
  fi
  if echo "$CHANGED" | grep -q "^frontend/package.json"; then
    DEPS_CHANGED=true
    log "${YELLOW}📦 Frontend dependencies changed${NC}"
  fi
  if echo "$CHANGED" | grep -q "^scripts/package.json"; then
    SCRIPTS_DEPS_CHANGED=true
    log "${YELLOW}📦 Scripts dependencies changed${NC}"
  fi
fi

# Install dependencies if needed
if [ "$DEPS_CHANGED" = true ]; then
  log "${BLUE}📦 Installing frontend dependencies...${NC}"
  cd frontend
  if ! npm ci 2>&1 | tee -a "$LOG_FILE"; then
    log "${RED}❌ Failed to install frontend dependencies${NC}"
    cd "$PROJECT_ROOT"
    git reset --hard "$PREVIOUS_COMMIT" 2>&1 | tee -a "$LOG_FILE"
    exit 1
  fi
  cd "$PROJECT_ROOT"
fi

if [ "$SCRIPTS_DEPS_CHANGED" = true ]; then
  log "${BLUE}📦 Installing scripts dependencies...${NC}"
  cd scripts
  if ! npm ci 2>&1 | tee -a "$LOG_FILE"; then
    log "${RED}❌ Failed to install scripts dependencies${NC}"
    cd "$PROJECT_ROOT"
    git reset --hard "$PREVIOUS_COMMIT" 2>&1 | tee -a "$LOG_FILE"
    exit 1
  fi
  cd "$PROJECT_ROOT"
fi

if [ ! -d "$PROJECT_ROOT/frontend/.next" ]; then
  log "${YELLOW}⚠️  Frontend build directory (.next) missing${NC}"
  FRONTEND_CHANGED=true
fi

# Build frontend if needed
if [ "$FRONTEND_CHANGED" = true ] || [ "$DEPS_CHANGED" = true ] || [ "$FORCE_BUILD" = true ]; then
  log "${BLUE}🔨 Building frontend...${NC}"
  cd frontend
  if ! npm run build 2>&1 | tee -a "$LOG_FILE"; then
    log "${RED}❌ Frontend build failed${NC}"
    cd "$PROJECT_ROOT"
    git reset --hard "$PREVIOUS_COMMIT" 2>&1 | tee -a "$LOG_FILE"
    exit 1
  fi
  cd "$PROJECT_ROOT"
  log "${GREEN}✅ Frontend build complete${NC}"
else
  log "${BLUE}⏭️  Skipping frontend build (no changes detected)${NC}"
fi

# Rebuild aepbase if its Go source changed
if [ "$AEPBASE_CHANGED" = true ] || [ "$FORCE_BUILD" = true ]; then
  log "${BLUE}🔨 Rebuilding aepbase...${NC}"
  cd aepbase
  if ! ./install.sh 2>&1 | tee -a "$LOG_FILE"; then
    log "${RED}❌ aepbase build failed${NC}"
    cd "$PROJECT_ROOT"
    git reset --hard "$PREVIOUS_COMMIT" 2>&1 | tee -a "$LOG_FILE"
    exit 1
  fi
  cd "$PROJECT_ROOT"

  log "${BLUE}🔄 Restarting aepbase...${NC}"
  sudo systemctl restart homestead-aepbase 2>&1 | tee -a "$LOG_FILE"
  sleep 3
  if ! sudo systemctl is-active --quiet homestead-aepbase; then
    log "${RED}❌ aepbase failed to restart${NC}"
    sudo journalctl -u homestead-aepbase -n 50 --no-pager | tee -a "$LOG_FILE"
    exit 1
  fi
  log "${GREEN}✅ aepbase rebuilt and restarted${NC}"
fi

if [ "$FRONTEND_CHANGED" = true ] || [ "$DEPS_CHANGED" = true ] || [ "$FORCE_BUILD" = true ]; then
  log "${BLUE}🔄 Restarting frontend...${NC}"
  sudo systemctl restart homestead-frontend 2>&1 | tee -a "$LOG_FILE"
  sleep 2
fi

if ! sudo systemctl is-active --quiet homestead-aepbase || \
   ! sudo systemctl is-active --quiet homestead-frontend; then
  log "${RED}❌ Service verification failed${NC}"
  sudo systemctl status homestead-aepbase homestead-frontend --no-pager | tee -a "$LOG_FILE"
  exit 1
fi

log "${GREEN}✅ Deployment successful!${NC}"
log "${BLUE}aepbase:${NC}  http://localhost:8090"
log "${BLUE}Frontend:${NC} http://localhost:3000"
