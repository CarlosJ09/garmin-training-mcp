#!/usr/bin/env bash
# Print an MCP client entry that launches this server inside WSL, using this machine's paths.
# Windows apps can't find an nvm-managed `node` by name, so the entry uses absolute paths.
#
# Usage: ./scripts/client-config.sh <codex|claude-desktop> [entry-name] [server flags...]
#   ./scripts/client-config.sh claude-desktop                     # live data, entry "training-log"
#   ./scripts/client-config.sh codex training-demo --demo         # fictional data
set -euo pipefail

usage() { echo "Usage: $0 <codex|claude-desktop> [entry-name] [server flags...]" >&2; exit 2; }

format="${1:-}"; [[ -n "$format" ]] || usage; shift
name="${1:-training-log}"; shift || true
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node="$(command -v node || true)"

[[ -n "${WSL_DISTRO_NAME:-}" ]] || { echo "Run this inside WSL." >&2; exit 1; }
[[ -n "$node" ]] || { echo "node isn't on PATH in this shell." >&2; exit 1; }

args=("-d" "$WSL_DISTRO_NAME" "--" "$node" "$root/src/stdio.ts" "$@")

case "$format" in
  codex)
    printf '[mcp_servers.%s]\ncommand = "wsl.exe"\nargs = [' "$name"
    for i in "${!args[@]}"; do printf '%s"%s"' "$([[ $i -gt 0 ]] && echo ', ')" "${args[$i]}"; done
    printf ']\n'
    ;;
  claude-desktop)
    # Merge this into the "mcpServers" object of claude_desktop_config.json.
    node -e 'const [name, ...args] = process.argv.slice(1); console.log(JSON.stringify({ [name]: { command: "wsl.exe", args } }, null, 2));' "$name" "${args[@]}"
    ;;
  *) usage ;;
esac
