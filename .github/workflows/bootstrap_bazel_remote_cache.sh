#! /usr/bin/env bash

if [[ -z "${BAZEL_REMOTE_CACHE_URL}" ]]; then
	echo "::warning file=.github/workflows/bootstrap_bazel_remote_cache.sh,line=3,endLine=3,title=Running without bazel cache!:: BAZEL_REMOTE_CACHE_URL was not specified, so tests will be doing all the work from scratch."
	exit 0
else
	echo "Using bazel remote cache."
	echo "build --remote_cache=${BAZEL_REMOTE_CACHE_URL}" > .bazelrc
	echo "test --remote_cache=${BAZEL_REMOTE_CACHE_URL}" > .bazelrc
fi

exit 0
