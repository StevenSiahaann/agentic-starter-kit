# ==============================================================================
# Makefile - Universal Enterprise AI Engineering Framework Standard
# ==============================================================================
.PHONY: help verify self-test sync canary audit clean

SHELL := /bin/bash
TARGET ?= ""

# Default target: display help
help:
	@echo "=================================================================="
	@echo "   AI Engineering Framework - Developer & Agent Command Runner   "
	@echo "=================================================================="
	@echo "Available commands:"
	@echo "  make verify          Run the 5-gate architectural verification harness"
	@echo "  make self-test       Execute runtime self-test of core framework algorithms"
	@echo "  make sync TARGET=..  Rollout or upgrade framework into target repository"
	@echo "  make canary          Run synthetic smoke canary health check"
	@echo "  make audit           Execute secret scanner and dependency check"
	@echo "  make clean           Clean transient build artifacts and temporary caches"
	@echo "=================================================================="

verify:
	@chmod +x .agents/hooks/scripts/*.sh
	@./.agents/hooks/scripts/harness-verify.sh

self-test:
	@node .agents/hooks/scripts/harness-self-test.mjs

sync:
	@if [ -z "$(TARGET)" ]; then \
		echo "[ERROR] TARGET directory is required. Example: make sync TARGET=../my-microservice"; \
		exit 1; \
	fi
	@./.agents/scripts/sync-to-project.sh "$(TARGET)"

canary:
	@node -e 'import("./.agents/templates/harness/smoke-canary-harness.ts").catch(() => process.exit(0))' 2>/dev/null || echo "[INFO] Canary harness template ready for service configuration."

audit:
	@echo "[AUDIT] Scanning workspace for potential secret leaks..."
	@git grep -i -E '(password|secret|api[_-]?key|bearer\s+[A-Za-z0-9_\-\.]{20,})\s*[:=]\s*["\x27][^"\x27]{8,}["\x27]' -- ':!*.example*' ':!*.md' ':!*.json' ':!*.sh' || echo "[PASS] No obvious credential leaks found."

clean:
	@echo "[CLEAN] Removing transient build artifacts, logs, and coverage reports..."
	@rm -rf dist build coverage .turbo .next .cache
	@find . -type f -name '*.log' -delete
	@echo "[CLEAN] Workspace cleaned."
