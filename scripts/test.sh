#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

node --check "$ROOT_DIR/hard-mode.js"
node --check "$ROOT_DIR/popup.js"
node --check "$ROOT_DIR/unhook.js"
node "$ROOT_DIR/scripts/test-hard-mode.js"
node "$ROOT_DIR/scripts/test-content-script.js"

python3 -m json.tool "$ROOT_DIR/manifest.json" >/dev/null

echo "Extension checks passed"
