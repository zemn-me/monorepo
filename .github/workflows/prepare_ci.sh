#!/usr/bin/env bash

set -e

echo "::group::Prepare CI environment"
DIR="$(realpath $(dirname ${BASH_SOURCE[0]}))"
"$DIR/bootstrap_bazel_remote_cache.sh"

echo "::group::Set bazel lockfile mode to error"
test -f .bazelrc
echo "common --lockfile-mode error" >> .bazelrc
echo "Success."
echo "::endgroup::"

echo "::endgroup::"


set +e
exit 0
