#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# COMMIT-MSG GUARD: Conventional Commits Specification Linter
# ==============================================================================
# Governed by: .agents/rules/07-git-branch-and-pr.md
# Enforces format: <type>(<optional-scope>): <description>
# Examples:
#   feat(auth): implement argon2id password hashing
#   fix(outbox): handle transient database connection timeout
#   docs(api): update swagger ui documentation
# ==============================================================================

COMMIT_MSG_FILE="${1:-}"

if [[ -z "$COMMIT_MSG_FILE" || ! -f "$COMMIT_MSG_FILE" ]]; then
    exit 0
fi

# Extract first non-comment line
FIRST_LINE="$(grep -v '^#' "$COMMIT_MSG_FILE" | grep -v '^[[:space:]]*$' | head -n 1 || true)"

# Allow automated merge commits or squash messages
if [[ "$FIRST_LINE" =~ ^Merge[[:space:]] || "$FIRST_LINE" =~ ^Revert[[:space:]] ]]; then
    exit 0
fi

# Conventional Commits regex pattern
CONVENTIONAL_REGEX='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9_-]+\))?!?: .+$'

if ! [[ "$FIRST_LINE" =~ $CONVENTIONAL_REGEX ]]; then
    echo -e "\033[0;31m====================================================================\033[0m"
    echo -e "\033[0;31m[GIT COMMIT REJECTED] Non-compliant Conventional Commit message!\033[0m"
    echo -e "\033[0;31m====================================================================\033[0m"
    echo -e "Your commit message:"
    echo -e "  \033[0;33m\"$FIRST_LINE\"\033[0m\n"
    echo -e "Required format: \033[0;32m<type>(<scope>): <subject>\033[0m"
    echo -e "Allowed types:"
    echo -e "  feat     - A new business feature or endpoint"
    echo -e "  fix      - A bug fix or defect remediation"
    echo -e "  docs     - Documentation changes only"
    echo -e "  style    - Code style, formatting, missing semicolons"
    echo -e "  refactor - Code changes that neither fix a bug nor add a feature"
    echo -e "  perf     - Performance improvements"
    echo -e "  test     - Adding or correcting tests"
    echo -e "  build    - Build system or external dependency updates"
    echo -e "  ci       - CI configuration files and scripts"
    echo -e "  chore    - Maintenance tasks, version bumps, or housekeeping\n"
    echo -e "Example: \033[0;32mfeat(standards): add local docker-compose and baseline schema\033[0m"
    echo -e "\033[0;31m====================================================================\033[0m"
    exit 1
fi

exit 0

