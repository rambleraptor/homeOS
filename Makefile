.PHONY: help install clean lint type-check type-check-cli build test test-cli test-e2e test-e2e-ui test-all dev start audit format all ci deploy setup-services start-services stop restart status logs aepbase homestead homestead-test release

# Release target platforms (filename arch follows Bun's convention: x64/arm64).
RELEASE_PLATFORMS := linux-x64 linux-arm64 darwin-x64 darwin-arm64

# Default target
.DEFAULT_GOAL := help

FRONTEND_DIR := packages/homestead-app
CLI_DIR := packages/homestead-cli
GEN := scripts/gen-embedded.ts
BUN := $(shell command -v bun || echo $$HOME/.bun/bin/bun)

help: ## Show this help message
	@echo "Homestead - Available Make Targets"
	@echo "================================"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	@echo "Installing workspace dependencies..."
	npm install

clean: ## Remove build artifacts and dependencies
	@echo "Cleaning build artifacts..."
	rm -rf $(FRONTEND_DIR)/dist
	rm -rf $(FRONTEND_DIR)/node_modules
	rm -rf $(CLI_DIR)/.build
	rm -rf aepbase/bin
	rm -rf bin
	$(BUN) $(GEN) --restore 2>/dev/null || true

lint: ## Run ESLint
	@echo "Running ESLint..."
	cd $(FRONTEND_DIR) && npm run lint

type-check: type-check-cli ## Run TypeScript type checking (frontend + CLI)
	@echo "Running TypeScript type check..."
	cd $(FRONTEND_DIR) && npm run type-check

type-check-cli: ## Type-check the homestead CLI package
	@echo "Type-checking homestead CLI..."
	npx tsc -p $(CLI_DIR)/tsconfig.json

build: ## Build the SPA (Vite -> frontend/dist)
	@echo "Building SPA..."
	cd $(FRONTEND_DIR) && npm run build

aepbase: ## Build the aepbase host binary (Go)
	@echo "Building aepbase host binary..."
	cd aepbase && go build -o bin/aepbase .
	@echo "→ aepbase/bin/aepbase"

dev: ## Start the Vite dev server only (no backend)
	@echo "Starting Vite dev server..."
	cd $(FRONTEND_DIR) && npm run dev

start: homestead ## Build and run the homestead launcher (prod, single binary)
	@echo "Starting homestead..."
	./bin/homestead start

test: test-cli ## Run frontend tests with Vitest (+ CLI tests)
	@echo "Running frontend tests..."
	cd $(FRONTEND_DIR) && npm run test

test-cli: ## Run the homestead CLI unit tests (Bun) + aepbase Go tests
	@echo "Running homestead CLI tests..."
	$(BUN) test $(CLI_DIR)/
	@echo "Running aepbase Go tests..."
	cd aepbase && go test ./...

test-e2e: ## Run end-to-end tests with Playwright
	@echo "Running e2e tests..."
	cd tests/e2e && npm install && npx playwright install --with-deps chromium && npm test

test-e2e-ui: ## Run e2e tests in UI mode
	@echo "Running e2e tests in UI mode..."
	cd tests/e2e && npm run test:ui

test-all: test test-e2e ## Run all tests (frontend + e2e)
	@echo "All tests completed!"

audit: ## Run security audit
	@echo "Running security audit..."
	cd $(FRONTEND_DIR) && npm audit --audit-level=high

format: ## Format code with Prettier
	@echo "Formatting code with Prettier..."
	cd $(FRONTEND_DIR) && npx prettier --write "src/**/*.{ts,tsx,js,jsx,json,css,md}"

homestead: build ## Build the single-binary `homestead` launcher (embeds SPA + sidecar + aepbase)
	@echo "Building homestead launcher (host platform)..."
	@mkdir -p bin
	cd aepbase && go build -o bin/aepbase .
	$(BUN) $(GEN) --aepbase aepbase/bin/aepbase --dist $(FRONTEND_DIR)/dist
	$(BUN) build --compile $(CLI_DIR)/src/cli.ts --outfile bin/homestead; \
	  status=$$?; $(BUN) $(GEN) --restore; exit $$status
	@echo "→ bin/homestead"

homestead-test: type-check-cli test-cli ## Type-check + test the CLI and aepbase

release: build ## Cross-compile per-platform homestead binaries (each embeds SPA + sidecar + aepbase)
	@mkdir -p bin aepbase/bin
	@for plat in $(RELEASE_PLATFORMS); do \
	  os=$${plat%-*}; barch=$${plat#*-}; \
	  goarch=$$( [ "$$barch" = "x64" ] && echo amd64 || echo $$barch ); \
	  echo "→ $$os/$$goarch"; \
	  (cd aepbase && GOOS=$$os GOARCH=$$goarch CGO_ENABLED=0 \
	    go build -o bin/aepbase-$$plat .) || exit 1; \
	  $(BUN) $(GEN) --aepbase aepbase/bin/aepbase-$$plat --dist $(FRONTEND_DIR)/dist || exit 1; \
	  $(BUN) build --compile --target=bun-$$plat $(CLI_DIR)/src/cli.ts \
	    --outfile bin/homestead-$$plat; status=$$?; \
	  $(BUN) $(GEN) --restore; [ $$status -eq 0 ] || exit $$status; \
	done
	@echo "→ bin/homestead-<platform> ($(words $(RELEASE_PLATFORMS)) binaries)"

all: install lint type-check build ## Run install, lint, type-check, and build

ci: lint type-check build ## Run CI checks (lint, type-check, build)
	@echo "All CI checks passed!"

# Deployment targets
deploy: ## Deploy Homestead (run as sudo)
	@./deployment/deploy.sh

deploy-force: ## Force deploy with rebuild
	@./deployment/deploy.sh --force

setup-services: ## Set up systemd services (requires sudo)
	@sudo ./deployment/setup-services.sh

setup-auto-update: ## Set up automatic updates (requires sudo)
	@sudo ./deployment/setup-auto-update.sh

start-services: ## Start the Homestead service (requires sudo)
	@echo "Starting Homestead service..."
	@sudo systemctl start homeos
	@echo "✅ Service started"

stop: ## Stop the Homestead service (requires sudo)
	@echo "Stopping Homestead service..."
	@sudo systemctl stop homeos
	@echo "✅ Service stopped"

restart: ## Restart the Homestead service (requires sudo)
	@echo "Restarting Homestead service..."
	@sudo systemctl restart homeos
	@echo "✅ Service restarted"

status: ## Check service status
	@sudo systemctl status homeos

logs: ## Follow service logs
	@echo "Following logs (Ctrl+C to stop)..."
	@sudo journalctl -u homeos -f
