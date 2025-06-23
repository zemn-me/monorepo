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

set -euo pipefail

# Bazel supplies TEST_TMPDIR for a writable workspace
cp "$(rlocation $PACKAGE_JSON)" "$TEST_TMPDIR/package.json"
cp "$(rlocation $PNPM_LOCKFILE)" "$TEST_TMPDIR/pnpm-lock.yaml"

# Add a fake dependency to cause mismatch using jq
$(rlocation $GOJQ_BINARY) '.devDependencies["pnpm-lockfile-validation-test"] = "0.0.1"' "$TEST_TMPDIR/package.json" > "$TEST_TMPDIR/package.json.tmp"
mv "$TEST_TMPDIR/package.json.tmp" "$TEST_TMPDIR/package.json"

cd "$TEST_TMPDIR"

if $(rlocation $VALIDATION_BIN) >out.txt 2>&1; then
  echo "expected failure but command succeeded" >&2
  cat out.txt >&2
  exit 1
else
  # command failed as expected; suppress output
  exit 0
fi
