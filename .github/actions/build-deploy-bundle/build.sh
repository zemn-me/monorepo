#!/usr/bin/env bash
set -euo pipefail

./.github/workflows/prepare_ci.sh

# Pinned main can predate the bundle targets during rollout. Supply only the
# packaging rules and tests; its Pulumi program must still come from main.
if [[ ! -f ci/deploy/bundle.bzl ]]; then
  cp "$GITHUB_WORKSPACE"/ci/deploy/{bundle.bzl,bundle_test.sh,deploy_failure_test.sh,run.sh} ci/deploy/
  {
    echo 'load(":bundle.bzl", "deploy_bundle")'
    cat ci/deploy/BUILD.bazel
    echo 'deploy_bundle()'
  } > ci/deploy/BUILD.bazel.bundle
  mv ci/deploy/BUILD.bazel.bundle ci/deploy/BUILD.bazel
fi
./sh/bin/bazel test --config=ci --tool_tag=deploy-bundle \
  --distdir="$GITHUB_WORKSPACE/third_party/bazel_distdir/ape" \
  --distdir="$GITHUB_WORKSPACE/third_party/bazel_distdir/rules_diff" \
  //ci/deploy:bundle //ci/deploy:bundle_test
