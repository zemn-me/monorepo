#!/usr/bin/env bash
# --- begin runfiles.bash initialization v3 ---
set -uo pipefail; set +e; f=bazel_tools/tools/bash/runfiles/runfiles.bash
# shellcheck disable=SC1090
source "${RUNFILES_DIR:-/dev/null}/$f" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "${RUNFILES_MANIFEST_FILE:-/dev/null}" | cut -f2- -d' ')" 2>/dev/null || \
  source "$0.runfiles/$f" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "$0.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "$0.exe.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
  { echo>&2 "ERROR: cannot find $f"; exit 1; }; f=; set -e
# --- end runfiles.bash initialization v3 ---

api_bin="$(rlocation "project/zemn.me/api/cmd/local/local")"
next_bin="$(rlocation "project/zemn.me/dev_/dev")"

ADDR="127.0.0.1:8787"
NEXT_PUBLIC_ZEMN_ME_API="http://$ADDR" ADDR="$ADDR" "$api_bin" &
api_pid=$!
trap 'kill $api_pid' EXIT

"$next_bin" "$@"
