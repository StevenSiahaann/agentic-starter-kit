#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# SYNC-TO-PROJECT: Multi-Project Rollout & Upgrade CLI for Engineering Managers
# ==============================================================================
# Distributes or upgrades 'agentic-starter-kit' into any target project repository
# while preserving project-specific overrides (.agents/project-context.md).
#
# Usage:
#   ./.agents/scripts/sync-to-project.sh /path/to/target-project [--with-git-hooks]
# ==============================================================================

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

if [[ $# -lt 1 ]]; then
    echo -e "${RED}Error: Target project directory path is required.${NC}"
    echo "Usage: $0 /path/to/target-project [--with-git-hooks]"
    exit 1
fi

TARGET_DIR="$1"
INSTALL_GIT_HOOKS="${2:-}"
SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ ! -d "$TARGET_DIR" ]]; then
    echo -e "${YELLOW}Target directory does not exist yet. Creating: $TARGET_DIR${NC}"
    mkdir -p "$TARGET_DIR"
fi

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

if [[ "$SOURCE_ROOT" == "$TARGET_DIR" ]]; then
    echo -e "${RED}Error: Source and target directories cannot be identical.${NC}"
    exit 1
fi

SOURCE_VERSION="$(cat "$SOURCE_ROOT/.agents/VERSION" 2>/dev/null || echo "2.2.0")"
TARGET_OLD_VERSION="$(cat "$TARGET_DIR/.agents/VERSION" 2>/dev/null || echo "none")"

echo -e "${BLUE}====================================================================${NC}"
echo -e "${BLUE}   SYNCING AGENTIC-STARTER-KIT (v${TARGET_OLD_VERSION} -> v${SOURCE_VERSION})${NC}"
echo -e "${BLUE}   TARGET: ${TARGET_DIR}${NC}"
echo -e "${BLUE}====================================================================${NC}"

# 1. Create directory structure in target repository
mkdir -p "$TARGET_DIR/.agents"
mkdir -p "$TARGET_DIR/.claude"
mkdir -p "$TARGET_DIR/.cursor/rules"
mkdir -p "$TARGET_DIR/.github/workflows"

# 2. Synchronize Rules, Agents, Skills, Hooks, Templates, and Scripts
echo -e "${YELLOW}[1/5] Synchronizing .agents/ (18 rules, 6 agents, 7 skills, hooks, 17 templates)...${NC}"
cp -R "$SOURCE_ROOT/.agents/rules" "$TARGET_DIR/.agents/"
cp -R "$SOURCE_ROOT/.agents/agents" "$TARGET_DIR/.agents/"
cp -R "$SOURCE_ROOT/.agents/skills" "$TARGET_DIR/.agents/"
cp -R "$SOURCE_ROOT/.agents/hooks" "$TARGET_DIR/.agents/"
cp -R "$SOURCE_ROOT/.agents/templates" "$TARGET_DIR/.agents/"
cp -R "$SOURCE_ROOT/.agents/scripts" "$TARGET_DIR/.agents/"
cp "$SOURCE_ROOT/.agents/hooks.json" "$TARGET_DIR/.agents/hooks.json"
cp "$SOURCE_ROOT/.agents/VERSION" "$TARGET_DIR/.agents/VERSION"
cp "$SOURCE_ROOT/.agents/project-context.example.md" "$TARGET_DIR/.agents/project-context.example.md"
chmod +x "$TARGET_DIR/.agents/hooks/scripts/"*.sh "$TARGET_DIR/.agents/scripts/"*.sh

# 3. Preserve target project's .agents/project-context.md if already present
echo -e "${YELLOW}[2/5] Checking project-specific context (.agents/project-context.md)...${NC}"
if [[ ! -f "$TARGET_DIR/.agents/project-context.md" ]]; then
    cp "$SOURCE_ROOT/.agents/project-context.example.md" "$TARGET_DIR/.agents/project-context.md"
    echo -e "${GREEN}  -> Initialized new .agents/project-context.md from template.${NC}"
else
    echo -e "${GREEN}  -> Preserved existing .agents/project-context.md (not overwritten).${NC}"
fi

# 4. Synchronize Universal Multi-Agent Adapters & GitHub Governance
echo -e "${YELLOW}[3/5] Synchronizing Universal Multi-Agent Adapters & Governance...${NC}"
cp "$SOURCE_ROOT/AGENTS.md" "$TARGET_DIR/AGENTS.md"
cp "$SOURCE_ROOT/CLAUDE.md" "$TARGET_DIR/CLAUDE.md"
cp -P -R "$SOURCE_ROOT/.claude/"* "$TARGET_DIR/.claude/"
cp "$SOURCE_ROOT/.cursorrules" "$TARGET_DIR/.cursorrules"
cp -R "$SOURCE_ROOT/.cursor/rules/"* "$TARGET_DIR/.cursor/rules/"
cp "$SOURCE_ROOT/.windsurfrules" "$TARGET_DIR/.windsurfrules"
cp "$SOURCE_ROOT/.editorconfig" "$TARGET_DIR/.editorconfig"
cp "$SOURCE_ROOT/.github/PULL_REQUEST_TEMPLATE.md" "$TARGET_DIR/.github/PULL_REQUEST_TEMPLATE.md"
cp "$SOURCE_ROOT/.github/copilot-instructions.md" "$TARGET_DIR/.github/copilot-instructions.md"

if [[ ! -f "$TARGET_DIR/Makefile" ]]; then
    cp "$SOURCE_ROOT/Makefile" "$TARGET_DIR/Makefile"
    echo -e "${GREEN}  -> Installed standard Makefile.${NC}"
fi

if [[ ! -f "$TARGET_DIR/docker-compose.yml" ]]; then
    cp "$SOURCE_ROOT/docker-compose.yml" "$TARGET_DIR/docker-compose.yml"
    echo -e "${GREEN}  -> Installed local development docker-compose.yml stack.${NC}"
fi

mkdir -p "$TARGET_DIR/docs/architecture"
if [[ ! -f "$TARGET_DIR/docs/architecture/system-overview.md" ]]; then
    cp "$SOURCE_ROOT/docs/architecture/system-overview.md" "$TARGET_DIR/docs/architecture/system-overview.md"
    echo -e "${GREEN}  -> Installed C4 Architecture documentation.${NC}"
fi

if [[ ! -f "$TARGET_DIR/.github/CODEOWNERS" ]]; then
    cp "$SOURCE_ROOT/.github/CODEOWNERS" "$TARGET_DIR/.github/CODEOWNERS"
fi

if [[ ! -f "$TARGET_DIR/.github/dependabot.yml" ]]; then
    cp "$SOURCE_ROOT/.github/dependabot.yml" "$TARGET_DIR/.github/dependabot.yml"
fi

if [[ ! -f "$TARGET_DIR/.github/workflows/ci-cd-pipeline.yml" ]]; then
    cp "$SOURCE_ROOT/.github/workflows/ci-cd-pipeline.yml" "$TARGET_DIR/.github/workflows/ci-cd-pipeline.yml"
    echo -e "${GREEN}  -> Installed .github/workflows/ci-cd-pipeline.yml.${NC}"
else
    echo -e "${GREEN}  -> Preserved existing .github/workflows/ci-cd-pipeline.yml.${NC}"
fi

# 5. Optional: Install Native Git Pre-Commit & Commit-Msg Hooks
echo -e "${YELLOW}[4/5] Checking local Git Hooks installation...${NC}"
if [[ "$INSTALL_GIT_HOOKS" == "--with-git-hooks" && -d "$TARGET_DIR/.git/hooks" ]]; then
    cat > "$TARGET_DIR/.git/hooks/pre-commit" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail
./.agents/hooks/scripts/harness-verify.sh
EOF
    chmod +x "$TARGET_DIR/.git/hooks/pre-commit"

    cat > "$TARGET_DIR/.git/hooks/commit-msg" << 'EOF'
#!/usr/bin/env bash
set -euo pipefail
./.agents/hooks/scripts/commit-msg-guard.sh "$1"
EOF
    chmod +x "$TARGET_DIR/.git/hooks/commit-msg"
    echo -e "${GREEN}  -> Installed Git pre-commit & commit-msg verification hooks!${NC}"
else
    echo -e "  -> Skipped Git hook installation (pass --with-git-hooks to enable)."
fi

echo -e "${YELLOW}[5/5] Running verification harness on target repository...${NC}"
(cd "$TARGET_DIR" && ./.agents/hooks/scripts/harness-verify.sh)

echo -e "\n${GREEN}✅ Synchronization complete! Target project at ${TARGET_DIR} is ready.${NC}"
