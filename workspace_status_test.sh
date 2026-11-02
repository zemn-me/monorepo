#!/usr/bin/env bash

set -euo pipefail

if [[ -n "${WORKSPACE_STATUS:-}" ]]; then
  # --- begin runfiles.bash initialization v3 ---
  set -uo pipefail; set +e; f=bazel_tools/tools/bash/runfiles/runfiles.bash
  source "${RUNFILES_DIR:-/dev/null}/$f" 2>/dev/null || \
    source "$(grep -sm1 "^$f " "${RUNFILES_MANIFEST_FILE:-/dev/null}" | cut -f2- -d' ')" 2>/dev/null || \
    source "$0.runfiles/$f" 2>/dev/null || \
    source "$(grep -sm1 "^$f " "$0.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
    source "$(grep -sm1 "^$f " "$0.exe.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
    { echo>&2 "ERROR: cannot find $f"; exit 1; }; f=; set -e
  # --- end runfiles.bash initialization v3 ---

  workspace_status="$(rlocation "$WORKSPACE_STATUS")"
else
  workspace_status="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/workspace_status.sh"
fi
output="$("$workspace_status")"

require_line() {
  local pattern="$1"

  if ! grep -Eq "$pattern" <<<"$output"; then
    echo "workspace_status.sh output did not contain pattern: $pattern" >&2
    echo "$output" >&2
    exit 1
  fi
}

require_line "^REPO_URL( .*)?$"
require_line "^COMMIT_SHA (dev|[0-9a-f]{40})$"
require_line "^BRANCH_NAME .+$"
require_line "^GIT_BRANCH .+$"
require_line "^GIT_TREE_STATUS (Clean|Modified|Unknown)$"
require_line "^STABLE_VERSION_TAG .+$"
require_line "^STABLE_COMMIT_SHA (dev|[0-9a-f]{40})$"
