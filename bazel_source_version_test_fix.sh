#!/usr/bin/env bash
set -euo pipefail

workspace="${1:-${BUILD_WORKING_DIRECTORY:-}}"
if [[ -z "${workspace}" ]]; then
	echo "Run this fixer with 'bazel run //:bazel_source_version_test.fix' or pass a workspace path." >&2
	exit 1
fi

bazel_version_file="${workspace}/.bazelversion"
module_file="${workspace}/MODULE.bazel"
bazel_version="$(tr -d '[:space:]' <"${bazel_version_file}")"
bazel_source_version="$(
	sed -n 's/^BAZEL_SOURCE_VERSION = "\([^"]*\)"$/\1/p' "${module_file}"
)"

for version in "${bazel_version}" "${bazel_source_version}"; do
	if [[ ! "${version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
		echo "Expected a stable Bazel version in major.minor.patch form, got '${version}'." >&2
		exit 1
	fi
done

version_greater_than() {
	local left="$1"
	local right="$2"
	local left_parts
	local right_parts
	local index

	IFS=. read -r -a left_parts <<<"${left}"
	IFS=. read -r -a right_parts <<<"${right}"
	for index in 0 1 2; do
		if ((10#${left_parts[index]} > 10#${right_parts[index]})); then
			return 0
		fi
		if ((10#${left_parts[index]} < 10#${right_parts[index]})); then
			return 1
		fi
	done
	return 1
}

target_version="${bazel_version}"
if version_greater_than "${bazel_source_version}" "${bazel_version}"; then
	target_version="${bazel_source_version}"
fi

if [[ "${bazel_version}" == "${bazel_source_version}" ]]; then
	exit 0
fi

temporary_version="$(mktemp "${bazel_version_file}.XXXXXX")"
temporary_module="$(mktemp "${module_file}.XXXXXX")"
trap 'rm -f "${temporary_version}" "${temporary_module}"' EXIT
sed "1s/.*/${target_version}/" "${bazel_version_file}" >"${temporary_version}"
sed \
	's/^BAZEL_SOURCE_VERSION = "[^"]*"$/BAZEL_SOURCE_VERSION = "'"${target_version}"'"/' \
	"${module_file}" >"${temporary_module}"
cp "${temporary_version}" "${bazel_version_file}"
cp "${temporary_module}" "${module_file}"
trap - EXIT
rm -f "${temporary_version}" "${temporary_module}"
