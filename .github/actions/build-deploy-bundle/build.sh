#!/usr/bin/env bash
set -euo pipefail

./.github/workflows/prepare_ci.sh

# Bootstrap the launcher on main the first time this workflow runs.
if [ ! -d ci/deploy ]; then
  cp -R "$GITHUB_WORKSPACE/ci/deploy" ci/deploy
fi
./sh/bin/bazel test --config=ci --tool_tag=deploy-bundle \
  --distdir="$GITHUB_WORKSPACE/third_party/bazel_distdir/ape" \
  --distdir="$GITHUB_WORKSPACE/third_party/bazel_distdir/rules_diff" \
  //ci/deploy:bundle //ci/deploy:bundle_test
