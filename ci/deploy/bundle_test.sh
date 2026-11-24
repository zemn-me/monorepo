#!/usr/bin/env bash
set -euo pipefail

# Reproduce the fresh deploy runner: only the archive supplies runfiles.
exec env -i HOME="$TEST_TMPDIR" PATH="$PATH" RUNNER_TEMP="$TEST_TMPDIR" "$1" "$2" verify
