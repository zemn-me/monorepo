#!/usr/bin/env bash
set -euo pipefail

# Reproduce the fresh deploy runner: only the archive supplies runfiles.
exec env -i HOME="$TEST_TMPDIR" PATH="$PATH" RUNNER_TEMP="$TEST_TMPDIR" \
  PULUMI_BACKEND_URL="file://$TEST_TMPDIR" PULUMI_SKIP_UPDATE_CHECK=true \
  HTTPS_PROXY=http://127.0.0.1:9 HTTP_PROXY=http://127.0.0.1:9 NO_PROXY=localhost,127.0.0.1 \
  "$1" "$2" verify
