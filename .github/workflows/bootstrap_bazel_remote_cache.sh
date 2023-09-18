#! /usr/bin/env bash

if [[ -z "${BAZEL_REMOTE_CACHE_URL}" ]]; then
	exit 0
else
	echo "Using bazel remote cache."
	echo "build --remote_cache=${BAZEL_REMOTE_CACHE_URL}" > .bazelrc
	echo "test --remote_cache=${BAZEL_REMOTE_CACHE_URL}" > .bazelrc
fi

exit 0
