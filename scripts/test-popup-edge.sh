#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_BIN="${EDGE_BIN:-/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge}"
EDGE_DEBUG_PORT="${EDGE_DEBUG_PORT:-9225}"
PROFILE_DIR="$(mktemp -d)"
EDGE_PID=""

cleanup() {
  if [[ -n "$EDGE_PID" ]]; then
    kill "$EDGE_PID" 2>/dev/null || true
    wait "$EDGE_PID" 2>/dev/null || true
  fi
  rm -rf "$PROFILE_DIR"
}
trap cleanup EXIT

if [[ ! -x "$EDGE_BIN" ]]; then
  echo "Microsoft Edge not found at $EDGE_BIN" >&2
  exit 1
fi

mkdir -p "$ROOT_DIR/build"
"$EDGE_BIN" \
  --headless=new \
  --disable-gpu \
  --no-first-run \
  --no-default-browser-check \
  --user-data-dir="$PROFILE_DIR" \
  --remote-debugging-port="$EDGE_DEBUG_PORT" \
  about:blank >"$ROOT_DIR/build/edge-test.log" 2>&1 &
EDGE_PID=$!

for _ in {1..50}; do
  if curl -fsS "http://127.0.0.1:$EDGE_DEBUG_PORT/json/version" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

if ! curl -fsS "http://127.0.0.1:$EDGE_DEBUG_PORT/json/version" >/dev/null; then
  echo "Microsoft Edge remote debugging did not start" >&2
  exit 1
fi

EDGE_DEBUG_PORT="$EDGE_DEBUG_PORT" node "$ROOT_DIR/scripts/test-popup-edge.js"
