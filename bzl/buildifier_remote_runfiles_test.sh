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


buildifier="$(rlocation "$BUILDIFIER")"
template="$(rlocation "$RUNNER_TEMPLATE")"
unset BUILD_WORKSPACE_DIRECTORY

# Exercise source discovery and executable lookup with both runfile layouts.
for layout in regular symlink; do
  directory="$TEST_TMPDIR/$layout"
  mkdir -p "$directory"
  sed -e 's|@@BUILDIFIER_SHORT_PATH@@|./buildifier|' \
      -e "s|@@ARGS@@|('-mode=check')|" \
      -e 's|@@WORKSPACE@@||' \
      -e 's|@@EXCLUDE_PATTERNS@@||' "$template" > "$directory/runner.bash"
  source_file="$TEST_TMPDIR/$layout.BUILD"
  echo 'filegroup(name="example",srcs=[])' > "$source_file"
  if [[ "$layout" == regular ]]; then
    cp "$buildifier" "$directory/buildifier"
    cp "$source_file" "$directory/BUILD.bazel"
  else
    ln -s "$buildifier" "$directory/buildifier"
    ln -s "$source_file" "$directory/BUILD.bazel"
  fi
  (
    cd "$directory"
    if bash runner.bash > output 2>&1; then
      echo "Buildifier did not reject unformatted input with $layout runfiles" >&2
      exit 1
    fi
    "$buildifier" -mode=fix BUILD.bazel
    bash runner.bash

    # The no-sandbox mode changes directory before invoking the same tool.
    mkdir nested
    cp BUILD.bazel nested/BUILD.bazel
    touch nested/WORKSPACE
    sed 's|^WORKSPACE=""$|WORKSPACE="nested/WORKSPACE"|' runner.bash > runner-workspace.bash
    bash runner-workspace.bash
  )
done
