#!/usr/bin/env bash
# Print a Codex (Windows) MCP entry that launches this server inside WSL, using this machine's paths.
# Usage: ./scripts/codex-config.sh [entry-name] [server flags...]
#   ./scripts/codex-config.sh                         -> [mcp_servers.training-log]
#   ./scripts/codex-config.sh training-demo --demo    -> fictional data
set -euo pipefail

name="${1:-training-log}"
shift || true
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node="$(command -v node || true)"

[[ -n "${WSL_DISTRO_NAME:-}" ]] || { echo "Run this inside WSL." >&2; exit 1; }
[[ -n "$node" ]] || { echo "node isn't on PATH in this shell." >&2; exit 1; }

extra=""
for arg in "$@"; do extra+=", \"$arg\""; done

cat <<EOF
[mcp_servers.$name]
command = "wsl.exe"
args = ["-d", "$WSL_DISTRO_NAME", "--", "$node", "$root/src/server.mts"$extra]
EOF
