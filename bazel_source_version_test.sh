#!/usr/bin/env bash
set -euo pipefail

set +e
runfiles_lib=bazel_tools/tools/bash/runfiles/runfiles.bash
source "${RUNFILES_DIR:-/dev/null}/${runfiles_lib}" 2>/dev/null ||
	source "$(grep -sm1 "^${runfiles_lib} " "${RUNFILES_MANIFEST_FILE:-/dev/null}" | cut -f2- -d' ')" 2>/dev/null ||
	source "$0.runfiles/${runfiles_lib}" 2>/dev/null ||
	{
		echo "Could not find Bazel's runfiles library" >&2
		exit 1
	}
set -e

bazel_version="$(tr -d '[:space:]' <"$(rlocation "${BAZEL_VERSION_FILE}")")"
bazel_source_version="$(
	sed -n 's/^BAZEL_SOURCE_VERSION = "\([^"]*\)"$/\1/p' \
		"$(rlocation "${BAZEL_SOURCE_MODULE}")"
)"

if [[ -z "${bazel_source_version}" ]]; then
	echo "Could not read BAZEL_SOURCE_VERSION from MODULE.bazel" >&2
	exit 1
fi

if [[ "${bazel_version}" != "${bazel_source_version}" ]]; then
	echo "Bazel versions must match: .bazelversion=${bazel_version}, BAZEL_SOURCE_VERSION=${bazel_source_version}" >&2
	exit 1
fi
