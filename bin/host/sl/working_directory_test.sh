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

target_dir="${TEST_TMPDIR}/repo"
mkdir -p "${target_dir}"

actual="$(
  cd /
  BUILD_WORKING_DIRECTORY="${target_dir}" \
    SL_BINARY_OVERRIDE="$(rlocation _main/bin/host/sl/fake_sl.sh)" \
    "$(rlocation _main/bin/host/sl/sl_linux)" 2>/dev/null
)"

if [[ "${actual}" != "${target_dir}" ]]; then
  echo "expected wrapper to run Sapling from ${target_dir}, got ${actual}" >&2
  exit 1
fi
