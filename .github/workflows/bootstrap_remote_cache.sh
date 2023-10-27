#!/usr/bin/env bash

echo "::group::Configure Bazel Remote Cache"

if [[ -z "${BUILDBUDDY_API_KEY}" ]]; then
	echo "::warning file=.github/workflows/bootstrap_bazel_remote_cache.sh,line=3,endLine=3,title=Running without bazel cache!:: BUILDBUDDY_API_KEY was not specified, so tests will be doing all the work from scratch."
else
	echo "Using bazel remote cache."
	echo "build --bes_results_url=https://app.buildbuddy.io/invocation/" > .auth.bazelrc
	echo "build --bes_backend=grpcs://remote.buildbuddy.io" >> .auth.bazelrc
	echo "build --remote_cache=grpcs://remote.buildbuddy.io" >> .auth.bazelrc
	echo "build --remote_timeout=3600" >> .auth.bazelrc
	echo "build --experimental_remote_cache_compression" >> .auth.bazelrc
	echo "build --nolegacy_important_outputs" >> .auth.bazelrc
	echo "build --experimental_remote_build_event_upload=minimal" >> .auth.bazelrc
	echo "build --build_metadata=REPO_URL=https://github.com/zemn-me/monorepo.git" >> .auth.bazelrc
	echo "build --remote_header=x-buildbuddy-api-key=${BUILDBUDDY_API_KEY}" >> .auth.bazelrc
fi

echo "::endgroup::"

exit 0
