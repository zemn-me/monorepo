#!/usr/bin/env bash
set -euo pipefail

runner="$(realpath "$1")"
bundle="$(cd "$(dirname "$2")" && pwd)"
failure_test="$(realpath "$3")"
# A deploy runner has neither the build checkout nor Bazel's runfiles environment.
clean_env=(env -i HOME="$TEST_TMPDIR" TEST_TMPDIR="$TEST_TMPDIR" PATH="$PATH"
  RUNNER_TEMP="$TEST_TMPDIR" PULUMI_BACKEND_URL="file://$TEST_TMPDIR" PULUMI_SKIP_UPDATE_CHECK=true
  HTTPS_PROXY=http://127.0.0.1:9 HTTP_PROXY=http://127.0.0.1:9 NO_PROXY=localhost,127.0.0.1)

# This is the LambdaHelloWorld image push that failed in Submit. It reads the
# image index with jq and starts crane. --help stops before any registry access.
push=ci/deploy/deploy.runfiles/_main/ts/pulumi/zemn.me/hello_world/push_oci_image_push_bin.sh
"${clean_env[@]}" "$runner" "$bundle" "$push" --help > "$TEST_TMPDIR/crane-help" 2>&1 || {
  cat "$TEST_TMPDIR/crane-help" >&2
  exit 1
}
grep -q "Usage:" "$TEST_TMPDIR/crane-help"
"${clean_env[@]}" "$runner" "$bundle" ci/deploy/deploy verify
"${clean_env[@]}" "$failure_test" "$runner" "$bundle" ci/deploy/deploy
