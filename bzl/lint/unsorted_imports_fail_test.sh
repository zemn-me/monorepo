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

biome="$(rlocation "$BIOME_RUNFILE")"
config="$(rlocation "$BIOME_CONFIG")"

set +e
output="$(
	printf "import z from 'z';\nimport a from 'a';\n\nconsole.log(z, a);\n" |
		"$biome" check \
			--formatter-enabled=false \
			--linter-enabled=false \
			--assist-enabled=true \
			--enforce-assist=true \
			--vcs-enabled=false \
			--config-path "$config" \
			--stdin-file-path unsorted.ts 2>&1
)"
status=$?
set -e

if [[ "$status" -eq 0 ]]; then
	echo "expected unsorted imports to fail Biome assist enforcement" >&2
	exit 1
fi

if [[ "$output" != *"The contents aren't fixed"* ]]; then
	echo "unexpected Biome output:" >&2
	echo "$output" >&2
	exit 1
fi
