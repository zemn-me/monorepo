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


# this is a hack because the go_bin_runner chdirs into BUILD_WORKING_DIRECTORY
# which may make sense in some contexts but does not make sense in a smoke test.
# https://github.com/bazelbuild/rules_go/blob/0a6311cdc4a643f9f99b8109c44773f4a295c60e/go/tools/go_bin_runner/main.go#L34
BUILD_WORKING_DIRECTORY="." $(rlocation $GO_BINARY) version

echo {} | $(rlocation $GOPACKAGESDRIVER_BINARY)
