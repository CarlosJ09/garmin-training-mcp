#!/usr/bin/env bash
# Store a Garmin Personal API key in the file the server reads, from a hidden prompt.
# The key never appears on screen, in shell history, or in a command line.
set -euo pipefail

dir="$HOME/.config/garmin"
file="$dir/connect-personal-api-key"

if [[ -e "$file" ]]; then
  echo "A key file already exists at $file. Not overwriting it." >&2
  echo "To replace it, delete it yourself first: rm '$file'" >&2
  exit 1
fi

read -rsp 'Garmin Personal API key (input hidden): ' key
echo
if [[ -z "${key// }" ]]; then
  echo "No key entered. Nothing saved." >&2
  exit 1
fi

mkdir -p "$dir"
chmod 700 "$dir"
(umask 077 && printf '%s' "$key" > "$file")
unset key
echo "Saved to $file (readable only by $(id -un))."
