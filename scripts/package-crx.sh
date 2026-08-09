#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_BIN="${EDGE_BIN:-/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge}"
OUTPUT_PATH="${1:-$ROOT_DIR/build/unhookng.crx}"
PACKAGE_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$PACKAGE_DIR"
}
trap cleanup EXIT

if [[ ! -x "$EDGE_BIN" ]]; then
  echo "Microsoft Edge not found at $EDGE_BIN" >&2
  exit 1
fi

mkdir -p "$PACKAGE_DIR/extension" "$(dirname "$OUTPUT_PATH")"
cp "$ROOT_DIR"/{manifest.json,popup.html,popup.js,hard-mode.js,unhook.js,LICENSE,README.md} \
  "$PACKAGE_DIR/extension/"
cp -R "$ROOT_DIR/icons" "$PACKAGE_DIR/extension/icons"

"$EDGE_BIN" --pack-extension="$PACKAGE_DIR/extension" --no-message-box
mv "$PACKAGE_DIR/extension.crx" "$OUTPUT_PATH"

echo "$OUTPUT_PATH"
