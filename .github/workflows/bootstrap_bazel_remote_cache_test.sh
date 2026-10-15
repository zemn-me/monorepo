#!/usr/bin/env bash

# --- begin runfiles.bash initialization v3 ---
# Copy-pasted from the Bazel Bash runfiles library v3.
set -uo pipefail; set +e; f=bazel_tools/tools/bash/runfiles/runfiles.bash
# shellcheck disable=SC1090
source "${RUNFILES_DIR:-/dev/null}/$f" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "${RUNFILES_MANIFEST_FILE:-/dev/null}" | cut -f2- -d' ')" 2>/dev/null || \
  source "$0.runfiles/$f" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "$0.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "$0.exe.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
  { echo>&2 "ERROR: cannot find $f"; exit 1; }; f=; set -e
# --- end runfiles.bash initialization v3 ---

bootstrap="$(rlocation "$BOOTSTRAP")"
for mode in readonly writable missing; do
  mkdir -p "$TEST_TMPDIR/$mode"
  (
    cd "$TEST_TMPDIR/$mode"
    key=test-buildbuddy-key
    readonly_mode=false
    if [[ "$mode" == readonly ]]; then readonly_mode=true; fi
    if [[ "$mode" == missing ]]; then key=; fi
    BUILDBUDDY_API_KEY="$key" BUILDBUDDY_CACHE_READ_ONLY="$readonly_mode" bash "$bootstrap" > output
    # Credentials must be written only to the private Bazel configuration.
    [[ "$(<output)" != *test-buildbuddy-key* ]]
    if [[ "$mode" == missing ]]; then
      [[ ! -e .auth.bazelrc ]]
    else
      config="$(<.auth.bazelrc)"
      [[ "$config" == *'--remote_cache=grpcs://remote.buildbuddy.io'* ]]
      if [[ "$mode" == readonly ]]; then
        [[ "$config" == *'--remote_upload_local_results=false'* ]]
        [[ "$config" == *'--remote_cache_header=x-buildbuddy-api-key=test-buildbuddy-key'* ]]
        [[ "$config" != *'--remote_header='* ]]
        [[ "$config" != *'--bes_backend='* ]]
      else
        [[ "$config" != *'--remote_upload_local_results=false'* ]]
        [[ "$config" == *'--remote_header=x-buildbuddy-api-key=test-buildbuddy-key'* ]]
        [[ "$config" == *'--bes_backend=grpcs://remote.buildbuddy.io'* ]]
      fi
    fi
  )
done
