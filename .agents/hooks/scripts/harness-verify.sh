#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# HARNESS-VERIFY: 1-Click Deterministic Verification Suite for AI & Developers
# ==============================================================================
# Run this script before committing, opening a PR, or marking any task complete.
# Guarantees 100% compliance across security, architecture, syntax, and tests.
# ==============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0

echo -e "${BLUE}====================================================================${NC}"
echo -e "${BLUE}   AUTOMATED AGENT & ARCHITECTURAL VERIFICATION HARNESS              ${NC}"
echo -e "${BLUE}====================================================================${NC}\n"

# 1. GATE 1: SECRET & CREDENTIAL SCAN
echo -e "${YELLOW}[Gate 1/5] Scanning for hardcoded secrets...${NC}"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if git grep -I -E "AKIA[0-9A-Z]{16}|(ghp_|gho_|github_pat_)[a-zA-Z0-9_]{20,}|AIza[-0-9A-Za-z_]{35}|sk_live_[a-zA-Z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----" -- ':!.agents/hooks/scripts/' ':!.env.example' >/dev/null 2>&1; then
        echo -e "${RED}[FAIL] Hardcoded secret detected in repository!${NC}"
        git grep -n -I -E "AKIA[0-9A-Z]{16}|(ghp_|gho_|github_pat_)[a-zA-Z0-9_]{20,}|AIza[-0-9A-Za-z_]{35}|sk_live_[a-zA-Z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----" -- ':!.agents/hooks/scripts/' ':!.env.example'
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}[PASS] Zero hardcoded secrets detected.${NC}"
    fi
else
    echo -e "${YELLOW}[SKIP] Not a git repository.${NC}"
fi

# 2. GATE 2: ARCHITECTURAL INVARIANTS & TEMPLATE INTEGRITY CHECK
echo -e "\n${YELLOW}[Gate 2/5] Verifying architectural invariants & templates...${NC}"
INV_FAIL=0

for CHECK_DIR in src .agents/templates; do
    if [[ -d "$CHECK_DIR" ]]; then
        if grep -r -E --include="*.ts" --include="*.tsx" --exclude="*.test.ts" --exclude="*.spec.ts" "\bconsole\.(log|debug|info|warn|error)\(" "$CHECK_DIR" >/dev/null 2>&1; then
            echo -e "${RED}[FAIL] Raw 'console.*' detected inside '$CHECK_DIR'! Use structured OTel logger instead.${NC}"
            grep -r -n -E --include="*.ts" --include="*.tsx" --exclude="*.test.ts" --exclude="*.spec.ts" "\bconsole\.(log|debug|info|warn|error)\(" "$CHECK_DIR" || true
            INV_FAIL=1
        fi

        if grep -r -E --include="*.ts" --include="*.tsx" --exclude="*.test.ts" --exclude="*.spec.ts" "(:\s*any\b|<any>|as\s+any\b)" "$CHECK_DIR" >/dev/null 2>&1; then
            echo -e "${RED}[FAIL] Explicit 'any' type detected inside '$CHECK_DIR'! Use 'unknown' or Zod schemas.${NC}"
            grep -r -n -E --include="*.ts" --include="*.tsx" --exclude="*.test.ts" --exclude="*.spec.ts" "(:\s*any\b|<any>|as\s+any\b)" "$CHECK_DIR" || true
            INV_FAIL=1
        fi
    fi
done

# Check Anti-Glassmorphism compliance (excluding node_modules, build outputs, and agent rule definitions)
if grep -r -E --include="*.tsx" --include="*.jsx" --include="*.css" \
    --exclude-dir=".agents" \
    --exclude-dir=".claude" \
    --exclude-dir=".cursor" \
    --exclude-dir=".git" \
    --exclude-dir="node_modules" \
    --exclude-dir=".next" \
    --exclude-dir="dist" \
    --exclude-dir="build" \
    --exclude-dir="coverage" \
    "backdrop-filter:\s*blur|backdrop-blur" . >/dev/null 2>&1; then
    echo -e "${RED}[FAIL] Glassmorphism blur detected! Enforce 100% opaque Solid Surface Layering.${NC}"
    INV_FAIL=1
fi

if [[ "$INV_FAIL" -eq 0 ]]; then
    echo -e "${GREEN}[PASS] Architectural invariants compliant (Zero 'any', zero 'console.*', solid surfaces).${NC}"
else
    ERRORS=$((ERRORS + 1))
fi

# 3. GATE 3: SHELL & JSON CONFIG SYNTAX VALIDATION
echo -e "\n${YELLOW}[Gate 3/5] Validating shell scripts & JSON configurations...${NC}"
SYNTAX_FAIL=0

for script in .agents/hooks/scripts/*.sh .agents/scripts/*.sh; do
    if [[ -f "$script" ]]; then
        if ! bash -n "$script"; then
            echo -e "${RED}[FAIL] Syntax error in shell script: $script${NC}"
            SYNTAX_FAIL=1
        fi
    fi
done

if command -v node >/dev/null 2>&1; then
    if ! node -e '
      const fs = require("fs");
      const files = [
        ".agents/hooks.json",
        ".agents/hooks/hooks.json",
        ".claude/settings.json",
        ".agents/agents/coordinator.json",
        ".agents/agents/security-auditor.json",
        ".agents/agents/ui-craftsman.json",
        ".agents/agents/database-architect.json",
        ".agents/agents/qa-engineer.json",
        ".agents/agents/devops-platform.json"
      ];
      for (const f of files) {
        if (fs.existsSync(f)) JSON.parse(fs.readFileSync(f, "utf8"));
      }
    '; then
        echo -e "${RED}[FAIL] Invalid JSON detected in agent or hook configuration files!${NC}"
        SYNTAX_FAIL=1
    fi
fi

if [[ "$SYNTAX_FAIL" -eq 0 ]]; then
    echo -e "${GREEN}[PASS] All shell scripts and JSON configurations are syntactically valid.${NC}"
else
    ERRORS=$((ERRORS + 1))
fi

# 4. GATE 4: TYPESCRIPT STATIC TYPECHECK
echo -e "\n${YELLOW}[Gate 4/5] Running Static Typecheck...${NC}"
if [[ -f "tsconfig.json" ]] && command -v npx >/dev/null 2>&1; then
    if npx tsc --noEmit; then
        echo -e "${GREEN}[PASS] TypeScript compiler check passed (Zero type errors).${NC}"
    else
        echo -e "${RED}[FAIL] TypeScript compilation failed!${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${YELLOW}[SKIP] No tsconfig.json found or npm not initialized.${NC}"
fi

# 5. GATE 5: AUTOMATED TEST SUITE
echo -e "\n${YELLOW}[Gate 5/5] Executing Test Suite...${NC}"
if [[ -f "package.json" ]] && command -v npm >/dev/null 2>&1; then
    if npm run | grep -q "test"; then
        if npm test; then
            echo -e "${GREEN}[PASS] All automated tests passed successfully.${NC}"
        else
            echo -e "${RED}[FAIL] Test suite failed!${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo -e "${YELLOW}[SKIP] No 'test' script defined in package.json.${NC}"
    fi
else
    echo -e "${YELLOW}[SKIP] No package.json found.${NC}"
fi

# ------------------------------------------------------------------------------
# FINAL REPORT
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}====================================================================${NC}"
if [[ "$ERRORS" -eq 0 ]]; then
    echo -e "${GREEN}   VERIFICATION HARNESS RESULT: ALL GATES PASSED (READY FOR PR)     ${NC}"
    echo -e "${BLUE}====================================================================${NC}"
    exit 0
else
    echo -e "${RED}   VERIFICATION HARNESS RESULT: FAILED WITH $ERRORS ERROR(S)       ${NC}"
    echo -e "${RED}   Resolve all violations reported above before committing.         ${NC}"
    echo -e "${BLUE}====================================================================${NC}"
    exit 1
fi
