#!/usr/bin/env bash

set -e

echo "::group::Configure Bazel Remote Cache"

if [[ -z "${BUILDBUDDY_API_KEY:-}" ]]; then
	echo "::warning file=.github/workflows/bootstrap_bazel_remote_cache.sh,line=8,endLine=8,title=Running without bazel cache:: BUILDBUDDY_API_KEY was not specified."
else
	echo "Using bazel remote cache."
	echo "build --bes_results_url=https://app.buildbuddy.io/invocation/" > .auth.bazelrc
	echo "build --bes_backend=grpcs://remote.buildbuddy.io" >> .auth.bazelrc
	echo "build --remote_cache=grpcs://remote.buildbuddy.io" >> .auth.bazelrc
	echo "build --remote_timeout=3600" >> .auth.bazelrc
	echo "build --experimental_remote_cache_compression" >> .auth.bazelrc
	echo "build --nolegacy_important_outputs" >> .auth.bazelrc
	echo "build --remote_build_event_upload=minimal" >> .auth.bazelrc
	echo "build --remote_header=x-buildbuddy-api-key=${BUILDBUDDY_API_KEY}" >> .auth.bazelrc
	if [[ "${CI:-}" == "true" ]]; then
		echo "Running on CI."
	else
		echo "Running locally."
	fi
fi

echo "::endgroup::"

set +e

exit 0
