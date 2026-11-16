#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# PRE-COMMAND GUARD: 5-Layer Defense-in-Depth Agent Safety Harness (Dual-Mode)
# ==============================================================================
# Automatically supports 3 execution modes:
# 1. Antigravity PreToolUse Hook (JSON via stdin -> JSON {"decision": "allow|deny"} stdout)
# 2. Claude Code PreToolUse Hook (JSON via stdin -> JSON permissionDecision stdout)
# 3. CLI / Git Hook Mode ($1 argument or AGY_COMMAND -> Human-readable output + exit 1)
# ==============================================================================

MODE="cli"
COMMAND_TO_RUN="${1:-${AGY_COMMAND:-}}"
HOOK_CWD=""

if [[ $# -eq 0 && -z "${AGY_COMMAND:-}" && ! -t 0 ]]; then
    STDIN_DATA="$(cat || true)"
    if [[ -n "$STDIN_DATA" ]]; then
        if echo "$STDIN_DATA" | grep -q '"toolCall"'; then
            MODE="antigravity"
        elif echo "$STDIN_DATA" | grep -q '"tool_input"'; then
            MODE="claude"
        fi

        if command -v node >/dev/null 2>&1; then
            PARSED="$(printf '%s' "$STDIN_DATA" | node -e '
              let data = "";
              process.stdin.on("data", c => data += c);
              process.stdin.on("end", () => {
                try {
                  const j = JSON.parse(data);
                  const cmd = (j.toolCall && j.toolCall.args && (j.toolCall.args.CommandLine || j.toolCall.args.command))
                    || (j.tool_input && (j.tool_input.command || j.tool_input.CommandLine))
                    || "";
                  const cwd = j.cwd || "";
                  console.log(JSON.stringify({ cmd, cwd }));
                } catch {
                  console.log(JSON.stringify({ cmd: "", cwd: "" }));
                }
              });
            ' 2>/dev/null || echo '{"cmd":"","cwd":""}')"
            COMMAND_TO_RUN="$(printf '%s' "$PARSED" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>console.log(JSON.parse(d).cmd||""))')"
            HOOK_CWD="$(printf '%s' "$PARSED" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>console.log(JSON.parse(d).cwd||""))')"
        elif command -v python3 >/dev/null 2>&1; then
            COMMAND_TO_RUN="$(printf '%s' "$STDIN_DATA" | python3 -c 'import sys,json; d=json.load(sys.stdin); print((d.get("toolCall",{}).get("args",{}).get("CommandLine") or d.get("tool_input",{}).get("command") or ""))' 2>/dev/null || true)"
            HOOK_CWD="$(printf '%s' "$STDIN_DATA" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("cwd",""))' 2>/dev/null || true)"
        fi
    fi
fi

if [[ -n "$HOOK_CWD" && -d "$HOOK_CWD" ]]; then
    cd "$HOOK_CWD"
fi

deny_execution() {
    local reason="$1"
    if [[ "$MODE" == "antigravity" ]]; then
        printf '{"decision":"deny","reason":"[SAFETY HARNESS BLOCKED] %s"}\n' "$reason"
        exit 0
    elif [[ "$MODE" == "claude" ]]; then
        printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"[SAFETY HARNESS BLOCKED] %s"}}\n' "$reason"
        exit 2
    else
        echo -e "\033[0;31m[SAFETY HARNESS BLOCKED]\033[0m $reason"
        exit 1
    fi
}

allow_execution() {
    if [[ "$MODE" == "antigravity" ]]; then
        printf '{"decision":"allow"}\n'
    elif [[ "$MODE" == "claude" ]]; then
        printf '{}\n'
    fi
    exit 0
}

# ------------------------------------------------------------------------------
# LAYER 1: FILESYSTEM CONTAINMENT & SENSITIVE FILE PROTECTION (.env & Keys)
# ------------------------------------------------------------------------------
if echo "$COMMAND_TO_RUN" | grep -E -q "(cat|nano|vi|vim|less|head|tail|tee|>|>>)\s+([^\s]*\/)?\.env(\.(production|prod|local|staging|live))?(\s|$)" && ! echo "$COMMAND_TO_RUN" | grep -q "\.env\.example"; then
    deny_execution "Filesystem Containment Violation! Direct reading or writing to live .env files is forbidden. AI agents may only edit '.env.example'."
fi

if echo "$COMMAND_TO_RUN" | grep -E -q "(\.pem|id_rsa|id_ed25519|service-account\.json)"; then
    deny_execution "Direct access to private keys or service account credentials is forbidden!"
fi

# ------------------------------------------------------------------------------
# LAYER 2: GIT GOVERNANCE & BRANCH SAFETY
# ------------------------------------------------------------------------------
if echo "$COMMAND_TO_RUN" | grep -E -q "git\s+push.*(origin|upstream)\s+(main|master)"; then
    deny_execution "Branching Strategy Violation! Direct 'git push' to main/master is forbidden. Use a short-lived feature branch and open a Pull Request (Trunk-Based Development)."
fi

if echo "$COMMAND_TO_RUN" | grep -E -q "git\s+push.*(\-f|--force)"; then
    deny_execution "Git Safety Violation! Force pushing ('--force' or '-f') is strictly prohibited."
fi

if echo "$COMMAND_TO_RUN" | grep -E -q "git\s+(commit|push).*\-\-no\-verify"; then
    deny_execution "Bypassing quality gates via '--no-verify' is forbidden!"
fi

if echo "$COMMAND_TO_RUN" | grep -E -q "git\s+reset\s+\-\-hard"; then
    deny_execution "'git reset --hard' is forbidden without manual user execution as it may permanently discard uncommitted work!"
fi

# ------------------------------------------------------------------------------
# LAYER 3: SUPPLY CHAIN & UNTRUSTED EXECUTION GUARD
# ------------------------------------------------------------------------------
if echo "$COMMAND_TO_RUN" | grep -E -q "(curl|wget)\s+.*\|\s*(bash|sh|zsh)"; then
    deny_execution "Piping remote scripts directly into a shell (curl | bash) is forbidden! Download explicitly and verify checksum integrity."
fi

if echo "$COMMAND_TO_RUN" | grep -E -q "(npm\s+install\s+(-g|--global)|yarn\s+global\s+add|pnpm\s+add\s+(-g|--global))"; then
    deny_execution "Global package installation (-g) is forbidden! All dependencies must be declared locally in package.json."
fi

# ------------------------------------------------------------------------------
# LAYER 4: DESTRUCTIVE COMMAND & MALICIOUS CODE GUARD
# ------------------------------------------------------------------------------
if echo "$COMMAND_TO_RUN" | grep -E -q "rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--force.*-r|-r.*--force)\s+([/~]|\$HOME|\.\.)"; then
    deny_execution "Destructive command detected (rm -rf targeting root, home, or parent directory)!"
fi

if echo "$COMMAND_TO_RUN" | grep -E -i -q "DROP\s+DATABASE"; then
    deny_execution "'DROP DATABASE' via terminal is strictly forbidden!"
fi

if echo "$COMMAND_TO_RUN" | grep -F -q ':(){ :|:& };:'; then
    deny_execution "Fork bomb detected!"
fi

# ------------------------------------------------------------------------------
# LAYER 5: DETERMINISTIC SECRET & CREDENTIAL LEAK SCANNER
# ------------------------------------------------------------------------------
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    LEAK_FOUND=0

    if git diff --cached -S"BEGIN PRIVATE KEY" -S"BEGIN RSA PRIVATE KEY" -S"BEGIN OPENSSH PRIVATE KEY" 2>/dev/null | grep -q "^+"; then
        LEAK_FOUND=1
    fi
    if git diff --cached 2>/dev/null | grep -E -q "^\+.*AKIA[0-9A-Z]{16}"; then
        LEAK_FOUND=1
    fi
    if git diff --cached 2>/dev/null | grep -E -q "^\+.*(ghp_|gho_|github_pat_)[a-zA-Z0-9_]{20,}"; then
        LEAK_FOUND=1
    fi
    if git diff --cached 2>/dev/null | grep -E -q "^\+.*AIza[-0-9A-Za-z_]{35}"; then
        LEAK_FOUND=1
    fi
    if git diff --cached 2>/dev/null | grep -E -q "^\+.*(sk_live_|sk-[a-zA-Z0-9]{20,})"; then
        LEAK_FOUND=1
    fi

    if [[ "$LEAK_FOUND" -eq 1 ]]; then
        deny_execution "Potential credential or secret leak detected in staged git changes! Inject secrets via Environment Variables instead."
    fi
fi

# Passed all 5 defense layers
allow_execution
