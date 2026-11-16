#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# POST-EDIT STYLER & ARCHITECTURAL INVARIANT HARNESS (Dual-Mode)
# ==============================================================================
# Automatically supports execution via PostToolUse hook (stdin JSON -> {} stdout)
# as well as direct CLI invocation ($1 target file).
# ==============================================================================

MODE="cli"
TARGET_FILE="${1:-}"
HOOK_CWD=""

if [[ $# -eq 0 && ! -t 0 ]]; then
    STDIN_DATA="$(cat || true)"
    if [[ -n "$STDIN_DATA" ]]; then
        MODE="hook"
        if command -v node >/dev/null 2>&1; then
            PARSED="$(printf '%s' "$STDIN_DATA" | node -e '
              let data = "";
              process.stdin.on("data", c => data += c);
              process.stdin.on("end", () => {
                try {
                  const j = JSON.parse(data);
                  const file = (j.toolCall && j.toolCall.args && (j.toolCall.args.Path || j.toolCall.args.TargetFile || j.toolCall.args.file_path))
                    || (j.tool_input && (j.tool_input.file_path || j.tool_input.path || j.tool_input.Path))
                    || "";
                  const cwd = j.cwd || "";
                  console.log(JSON.stringify({ file, cwd }));
                } catch {
                  console.log(JSON.stringify({ file: "", cwd: "" }));
                }
              });
            ' 2>/dev/null || echo '{"file":"","cwd":""}')"
            TARGET_FILE="$(printf '%s' "$PARSED" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>console.log(JSON.parse(d).file||""))')"
            HOOK_CWD="$(printf '%s' "$PARSED" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>console.log(JSON.parse(d).cwd||""))')"
        elif command -v python3 >/dev/null 2>&1; then
            TARGET_FILE="$(printf '%s' "$STDIN_DATA" | python3 -c 'import sys,json; d=json.load(sys.stdin); print((d.get("toolCall",{}).get("args",{}).get("Path") or d.get("tool_input",{}).get("file_path") or ""))' 2>/dev/null || true)"
            HOOK_CWD="$(printf '%s' "$STDIN_DATA" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("cwd",""))' 2>/dev/null || true)"
        fi
    fi
fi

if [[ -n "$HOOK_CWD" && -d "$HOOK_CWD" ]]; then
    cd "$HOOK_CWD"
elif git rev-parse --show-toplevel >/dev/null 2>&1; then
    cd "$(git rev-parse --show-toplevel)"
fi

log_warning() {
    if [[ "$MODE" == "hook" ]]; then
        echo -e "$1" >&2
    else
        echo -e "$1"
    fi
}

if [[ -n "$TARGET_FILE" && -f "$TARGET_FILE" ]]; then
    # 1. ANTI-GLASSMORPHISM MANIFESTO ENFORCEMENT
    if echo "$TARGET_FILE" | grep -E -q "\.(tsx|jsx|css|html|vue|svelte)$"; then
        if grep -E -q "backdrop-filter:\s*blur|backdrop-blur" "$TARGET_FILE"; then
            log_warning "\033[0;33m[DESIGN HARNESS WARNING]\033[0m Detected 'backdrop-filter: blur' in $TARGET_FILE! Enforce Solid Surface Layering (#0B0F19, #161F30, #F8FAFC) with WCAG AA >= 4.5:1 contrast."
        fi
    fi

    # 2. ARCHITECTURAL CODE QUALITY ENFORCEMENT (TypeScript Production Files)
    if echo "$TARGET_FILE" | grep -E -q "\.(ts|tsx)$" && ! echo "$TARGET_FILE" | grep -E -q "\.(test|spec)\.(ts|tsx)$"; then
        if grep -E -q "(:\s*any\b|<any>|as\s+any\b)" "$TARGET_FILE"; then
            log_warning "\033[0;33m[CODE QUALITY WARNING]\033[0m Detected explicit 'any' type in $TARGET_FILE! Use 'unknown' with type narrowing or Zod schema validation."
        fi

        if grep -E -q "\bconsole\.(log|debug|info)\(" "$TARGET_FILE"; then
            log_warning "\033[0;33m[OBSERVABILITY WARNING]\033[0m Detected raw 'console.log' in $TARGET_FILE! Use the structured OTel logger (.agents/templates/otel-logger.ts)."
        fi
    fi

    # 3. AUTOMATIC CODE FORMATTING (Prettier if available in workspace)
    if command -v npx >/dev/null 2>&1 && [[ -f "package.json" ]]; then
        if npx prettier --version >/dev/null 2>&1; then
            npx prettier --write "$TARGET_FILE" >/dev/null 2>&1 || true
        fi
    fi
fi

if [[ "$MODE" == "hook" ]]; then
    printf '{}\n'
fi

exit 0
