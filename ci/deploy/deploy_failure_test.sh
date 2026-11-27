#!/usr/bin/env bash
set -euo pipefail

# The inline Pulumi runtime can log an uncaught exception and let Node exit 0.
# Keep that listener present even when the local backend fails before startup.
listener="$TEST_TMPDIR/pulumi-listener.cjs"
echo 'process.on("uncaughtException", error => console.error(error))' > "$listener"
export NODE_OPTIONS="--require=\"$listener\""
export HOME="$TEST_TMPDIR" PULUMI_SKIP_UPDATE_CHECK=true
backend="$TEST_TMPDIR/unusable-pulumi-backend"
touch "$backend"
export PULUMI_BACKEND_URL="file://$backend"

failed=0
for revision in main candidate production; do
  status=0
  "$@" "$revision" > "$TEST_TMPDIR/output" 2>&1 || status=$?
  if ! grep -Fq "$backend is not a directory" "$TEST_TMPDIR/output"; then
    cat "$TEST_TMPDIR/output" >&2
    exit 1
  fi
  if [[ "$status" != 1 ]]; then
    echo "Pulumi failed during $revision, but the deploy command exited $status" >&2
    failed=1
  fi
done
exit "$failed"
