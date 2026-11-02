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

fixer="$(rlocation "${BAZEL_SOURCE_VERSION_FIXER}")"
test_workspace="$(mktemp -d)"
trap 'rm -rf "${test_workspace}"' EXIT

assert_versions() {
	local expected="$1"
	local executable_version
	local source_version

	executable_version="$(tr -d '[:space:]' <"${test_workspace}/.bazelversion")"
	source_version="$(
		sed -n 's/^BAZEL_SOURCE_VERSION = "\([^"]*\)"$/\1/p' \
			"${test_workspace}/MODULE.bazel"
	)"

	[[ "${executable_version}" == "${expected}" ]]
	[[ "${source_version}" == "${expected}" ]]
}

printf '%s\n' '8.7.0' >"${test_workspace}/.bazelversion"
printf '%s\n' 'BAZEL_SOURCE_VERSION = "9.2.0"' >"${test_workspace}/MODULE.bazel"
"${fixer}" "${test_workspace}"
assert_versions '9.2.0'

printf '%s\n' '10.0.0' >"${test_workspace}/.bazelversion"
printf '%s\n' 'BAZEL_SOURCE_VERSION = "9.2.0"' >"${test_workspace}/MODULE.bazel"
"${fixer}" "${test_workspace}"
assert_versions '10.0.0'

"${fixer}" "${test_workspace}"
assert_versions '10.0.0'
