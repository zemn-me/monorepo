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


echo testing go...
go_binary="$(rlocation "$GO_BINARY")"
export GOMODCACHE="$TEST_TMPDIR/modcache" HOME="$TEST_TMPDIR/home"
"$go_binary" version
# Exercise the declared compiler and standard library, not only the executable.
cat > "$TEST_TMPDIR/sdk_smoke.go" <<'GO'
package main
import "fmt"
func main() { fmt.Print("sdk works") }
GO
result="$(CGO_ENABLED=0 GO111MODULE=off GOTOOLCHAIN=local GOCACHE="$TEST_TMPDIR/gocache" "$go_binary" run "$TEST_TMPDIR/sdk_smoke.go")"
[[ "$result" == 'sdk works' ]]



echo testing staticcheck...
$(rlocation $STATICCHECK_BINARY) -version


echo testing dlv...
$(rlocation $DLV_BINARY) version
