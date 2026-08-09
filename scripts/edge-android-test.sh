#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADB_BIN="${ADB_BIN:-${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb}"
DEVICE="${ANDROID_SERIAL:-}"
EDGE_PACKAGE="${EDGE_PACKAGE:-}"
ARTIFACT_PATH="${ARTIFACT_PATH:-$ROOT_DIR/build/unhookng.crx}"

show_help() {
  printf '%s\n' \
    'Usage: scripts/edge-android-test.sh [--device SERIAL] [--edge-package PACKAGE]' \
    '' \
    'Checks an authorized Android device, packages the extension as a CRX, pushes it to' \
    'Downloads, opens mobile YouTube in Microsoft Edge, and records evidence under build/device.' \
    'Set DEVICE_PIN only when the attached device needs unlocking; it is never logged.'
}

while (($#)); do
  case "$1" in
    --device) DEVICE="$2"; shift 2 ;;
    --edge-package) EDGE_PACKAGE="$2"; shift 2 ;;
    --help|-h) show_help; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

if [[ ! -x "$ADB_BIN" ]]; then
  echo "adb not found at $ADB_BIN" >&2
  exit 1
fi

if [[ -z "$DEVICE" ]]; then
  DEVICE="$($ADB_BIN devices | awk '$2 == "device" && $1 !~ /^emulator-/ {print $1; exit}')"
fi
if [[ -z "$DEVICE" ]]; then
  echo "no authorized physical Android device detected by adb" >&2
  exit 1
fi

if [[ -z "$EDGE_PACKAGE" ]]; then
  installed_packages="$($ADB_BIN -s "$DEVICE" shell pm list packages | sed 's/^package://')"
  for candidate in \
    com.microsoft.emmx.canary \
    com.microsoft.emmx.dev \
    com.microsoft.emmx.beta \
    com.microsoft.emmx
  do
    if grep -qx "$candidate" <<<"$installed_packages"; then
      EDGE_PACKAGE="$candidate"
      break
    fi
  done
fi
if [[ -z "$EDGE_PACKAGE" ]]; then
  echo "Microsoft Edge is not installed on $DEVICE" >&2
  exit 1
fi

keyguard_state() {
  local window_state
  window_state="$($ADB_BIN -s "$DEVICE" shell dumpsys window)"
  if grep -Eq 'isKeyguardShowing=true|mDreamingLockscreen=true|mShowingLockscreen=true' <<<"$window_state"; then
    echo locked
  elif grep -Eq 'isKeyguardShowing=false|mDreamingLockscreen=false|mShowingLockscreen=false' <<<"$window_state"; then
    echo unlocked
  else
    echo unknown
  fi
}

initial_keyguard_state="$(keyguard_state)"
if [[ "$initial_keyguard_state" == "unknown" ]]; then
  echo "device keyguard state could not be verified; refusing credential input" >&2
  exit 1
fi

if [[ "$initial_keyguard_state" == "locked" ]]; then
  if [[ -z "${DEVICE_PIN:-}" ]]; then
    echo "device is locked; set DEVICE_PIN for this invocation" >&2
    exit 1
  fi
  pin_digits="${DEVICE_PIN//./}"
  if [[ ! "$pin_digits" =~ ^[0-9]+$ ]]; then
    echo "DEVICE_PIN must contain digits with optional dots" >&2
    exit 1
  fi

  "$ADB_BIN" -s "$DEVICE" shell input keyevent KEYCODE_WAKEUP
  "$ADB_BIN" -s "$DEVICE" shell cmd statusbar collapse
  "$ADB_BIN" -s "$DEVICE" shell wm dismiss-keyguard
  sleep 1

  if [[ "$(keyguard_state)" == "locked" ]]; then
    unlock_ui_path="/data/local/tmp/unhookng-unlock-window.xml"
    "$ADB_BIN" -s "$DEVICE" shell uiautomator dump "$unlock_ui_path" >/dev/null
    unlock_ui="$($ADB_BIN -s "$DEVICE" shell cat "$unlock_ui_path")"
    "$ADB_BIN" -s "$DEVICE" shell rm -f "$unlock_ui_path"
    if ! grep -q 'package="com.android.systemui"' <<<"$unlock_ui" ||
        ! grep -Eq 'Enter PIN|keyguard_pin_view|pinEntry' <<<"$unlock_ui"; then
      echo "Android credential screen was not verified; refusing credential input" >&2
      exit 1
    fi

    {
      echo 'input keyevent KEYCODE_MOVE_END'
      for _ in {1..16}; do echo 'input keyevent KEYCODE_DEL'; done
      printf 'input text %s\n' "$pin_digits"
      echo 'input keyevent KEYCODE_ENTER'
      echo 'exit'
    } | "$ADB_BIN" -s "$DEVICE" shell >/dev/null
    sleep 3
  fi

  if [[ "$(keyguard_state)" != "unlocked" ]]; then
    echo "device unlock did not clear keyguard" >&2
    exit 1
  fi
fi

"$ROOT_DIR/scripts/test.sh"
"$ROOT_DIR/scripts/package-crx.sh" "$ARTIFACT_PATH" >/dev/null

EVIDENCE_DIR="$ROOT_DIR/build/device"
mkdir -p "$EVIDENCE_DIR"
"$ADB_BIN" -s "$DEVICE" push "$ARTIFACT_PATH" /sdcard/Download/unhookng.crx >/dev/null
"$ADB_BIN" -s "$DEVICE" shell am start \
  -a android.intent.action.VIEW \
  -d https://m.youtube.com/ \
  -p "$EDGE_PACKAGE" >/dev/null
sleep 6
"$ADB_BIN" -s "$DEVICE" shell uiautomator dump /sdcard/unhookng-window.xml >/dev/null
"$ADB_BIN" -s "$DEVICE" shell cat /sdcard/unhookng-window.xml > "$EVIDENCE_DIR/window.xml"
"$ADB_BIN" -s "$DEVICE" exec-out screencap -p > "$EVIDENCE_DIR/edge.png"
"$ADB_BIN" -s "$DEVICE" shell dumpsys package "$EDGE_PACKAGE" | grep -m 1 'versionName=' > "$EVIDENCE_DIR/edge-version.txt"
{
  printf 'model: '
  "$ADB_BIN" -s "$DEVICE" shell getprop ro.product.model
  printf 'android: '
  "$ADB_BIN" -s "$DEVICE" shell getprop ro.build.version.release
} > "$EVIDENCE_DIR/device.txt"

printf 'device: %s\nedge_package: %s\nartifact: /sdcard/Download/unhookng.crx\nevidence: %s\n' \
  "$DEVICE" "$EDGE_PACKAGE" "$EVIDENCE_DIR"
