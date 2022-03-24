# --- begin runfiles.bash initialization v2 ---
# Copy-pasted from the Bazel Bash runfiles library v2.
set -uo pipefail; f=bazel_tools/tools/bash/runfiles/runfiles.bash
source "${RUNFILES_DIR:-/dev/null}/$f" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "${RUNFILES_MANIFEST_FILE:-/dev/null}" | cut -f2- -d' ')" 2>/dev/null || \
  source "$0.runfiles/$f" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "$0.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "$0.exe.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
  { echo>&2 "ERROR: cannot find $f"; exit 1; }; f=; set -e
# --- end runfiles.bash initialization v2 ---

echo $FIX_JS $FIX_GO $FIX_BAZEL


FIX_GO=$(realpath $(rlocation go_sdk/bin/gofmt))
FIX_JS=$(realpath $(rlocation npm/eslint/bin/eslint.sh))


FIX_BAZEL --lint=fix
cd $INIT_CWD
$FIX_GO -s -w .
$FIX_JS --fix --ignore-path .gitignore '**/*.ts' '**/*.js' '**/*.tsx' '**/*.json'
