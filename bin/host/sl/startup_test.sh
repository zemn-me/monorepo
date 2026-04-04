#!/usr/bin/env bash

# --- begin runfiles.bash initialization v3 ---
# Copy-pasted from the Bazel Bash runfiles library v3.
set -uo pipefail; set +e; f=bazel_tools/tools/bash/runfiles/runfiles.bash
source "${RUNFILES_DIR:-/dev/null}/$f" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "${RUNFILES_MANIFEST_FILE:-/dev/null}" | cut -f2- -d' ')" 2>/dev/null || \
  source "$0.runfiles/$f" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "$0.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "$0.exe.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
  { echo>&2 "ERROR: cannot find $f"; exit 1; }; f=; set -e
# --- end runfiles.bash initialization v3 ---

actual="$(
  PAGER=cat \
  TERM=dumb \
  "$(rlocation "${SL_BINARY}")" help 2>&1
)"

if [[ "${actual}" == *"Could not find platform independent libraries"* ]]; then
  echo "Sapling failed to boot its embedded Python runtime:" >&2
  echo "${actual}" >&2
  exit 1
fi

if [[ "${actual}" != *"Sapling SCM"* ]]; then
  echo "expected Sapling help output, got:" >&2
  echo "${actual}" >&2
  exit 1
fi
