#!/usr/bin/env bash

echo "::group::Prepare CI environment"
DIR="$(realpath $(dirname ${bash_source[0]}))"
"$DIR/bootstrap_bazel_remote_cache.sh"

echo "::group::Set bazel lockfile mode to error"
echo "all --lockfile-mode error" >> .bazelrc
echo "::endgroup::"

echo "::endgroup::"

exit 0
