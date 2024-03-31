#!/usr/bin/env bash

set -e

echo "::group::Prepare CI environment"
DIR="$(realpath $(dirname ${BASH_SOURCE[0]}))"
"$DIR/bootstrap_bazel_remote_cache.sh"

echo "::endgroup::"


set +e
exit 0
