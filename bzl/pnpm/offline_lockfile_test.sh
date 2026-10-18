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

pnpm="$(rlocation "$PNPM")"
export BAZEL_BINDIR=.
unset BUILD_WORKSPACE_DIRECTORY
cd "$TEST_TMPDIR"
printf '%s\n' '{"name":"fixture","version":"1.0.0"}' > package.json
"$pnpm" install --lockfile-only --offline --ignore-scripts --dir "$PWD"
cp pnpm-lock.yaml expected-lock.yaml
"$pnpm" install --lockfile-only --offline --frozen-lockfile --ignore-scripts --dir "$PWD"
cmp expected-lock.yaml pnpm-lock.yaml
# Guard against pnpm silently rewriting a stale lockfile, including with --dir.
printf '%s\n' '{"name":"fixture","version":"1.0.0","dependencies":{"is-number":"7.0.0"}}' > package.json
if "$pnpm" install --lockfile-only --offline --frozen-lockfile --ignore-scripts --dir "$PWD" > output 2>&1; then
  echo "pnpm accepted a stale lockfile" >&2
  exit 1
fi
grep -q ERR_PNPM_OUTDATED_LOCKFILE output
cmp expected-lock.yaml pnpm-lock.yaml
