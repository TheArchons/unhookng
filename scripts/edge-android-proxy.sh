#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADB_BIN="${ADB_BIN:-${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb}"
DEVICE="${ANDROID_SERIAL:-}"
PROXY_PORT="${PROXY_PORT:-8888}"

if [[ -z "$DEVICE" ]]; then
  DEVICE="$($ADB_BIN devices | awk '$2 == "device" && $1 !~ /^emulator-/ {print $1; exit}')"
fi
if [[ -z "$DEVICE" ]]; then
  echo "no authorized physical Android device detected by adb" >&2
  exit 1
fi

original_proxy="$($ADB_BIN -s "$DEVICE" shell settings get global http_proxy)"
proxy_pid=""

cleanup() {
  if [[ "$original_proxy" == "null" || "$original_proxy" == ":0" ]]; then
    "$ADB_BIN" -s "$DEVICE" shell settings delete global http_proxy >/dev/null
  else
    "$ADB_BIN" -s "$DEVICE" shell settings put global http_proxy "$original_proxy" >/dev/null
  fi
  "$ADB_BIN" -s "$DEVICE" reverse --remove "tcp:$PROXY_PORT" >/dev/null 2>&1 || true
  if [[ -n "$proxy_pid" ]]; then
    kill "$proxy_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

PROXY_PORT="$PROXY_PORT" node "$ROOT_DIR/scripts/adb-forward-proxy.mjs" &
proxy_pid=$!
sleep 1
if ! kill -0 "$proxy_pid" 2>/dev/null; then
  echo "local proxy failed to start" >&2
  exit 1
fi

"$ADB_BIN" -s "$DEVICE" reverse "tcp:$PROXY_PORT" "tcp:$PROXY_PORT" >/dev/null
"$ADB_BIN" -s "$DEVICE" shell settings put global http_proxy "127.0.0.1:$PROXY_PORT" >/dev/null

printf 'Android traffic for %s is forwarded through 127.0.0.1:%s. Press Ctrl-C to stop and restore settings.\n' \
  "$DEVICE" "$PROXY_PORT"
wait "$proxy_pid"
