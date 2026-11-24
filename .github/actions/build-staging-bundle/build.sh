#!/usr/bin/env bash
set -euo pipefail

./.github/workflows/prepare_ci.sh

# Bootstrap the launcher on main the first time this workflow runs.
if [ ! -d ci/staging/deploy ]; then
  cp -R "$GITHUB_WORKSPACE/ci/staging/deploy" ci/staging/deploy
fi
./sh/bin/bazel test --config=ci --tool_tag=staging \
  --distdir="$GITHUB_WORKSPACE/third_party/bazel_distdir/ape" \
  --distdir="$GITHUB_WORKSPACE/third_party/bazel_distdir/rules_diff" \
  //ci/staging/deploy:bundle //ci/staging/deploy:bundle_test
