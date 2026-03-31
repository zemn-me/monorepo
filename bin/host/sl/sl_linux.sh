#!/usr/bin/env bash
set -euo pipefail

find_runfiles_root() {
  if [[ -n "${RUNFILES_DIR:-}" && -d "${RUNFILES_DIR}" ]]; then
    echo "${RUNFILES_DIR}"
    return
  fi
  if [[ -d "$0.runfiles" ]]; then
    echo "$0.runfiles"
    return
  fi

  local p
  p="$(cd "$(dirname "$0")" && pwd)"
  while [[ "$p" != "/" ]]; do
    if [[ "$p" == *.runfiles ]]; then
      echo "$p"
      return
    fi
    p="$(dirname "$p")"
  done

  echo "Unable to locate Bazel runfiles for $0" >&2
  exit 1
}

TARGET_WORKDIR="${BUILD_WORKING_DIRECTORY:-${BUILD_WORKSPACE_DIRECTORY:-}}"
if [[ -n "${TARGET_WORKDIR}" && -d "${TARGET_WORKDIR}" ]]; then
  cd "${TARGET_WORKDIR}"
fi

# Force the Bazel-managed binary to answer directly instead of routing through
# a long-lived chg server from a different Sapling build on the same machine.
export CHGDISABLE="${CHGDISABLE:-1}"

if [[ -n "${SL_BINARY_OVERRIDE:-}" ]]; then
  exec "${SL_BINARY_OVERRIDE}" "$@"
fi

RUNFILES_ROOT="$(find_runfiles_root)"
for BUILT_BINARY in \
  "${RUNFILES_ROOT}/bin/host/sl/sl_linux_built_bin_wrapper.sh" \
  "${RUNFILES_ROOT}/_main/bin/host/sl/sl_linux_built_bin_wrapper.sh" \
  "${RUNFILES_ROOT}/bin/host/sl/sl_linux_built_bin" \
  "${RUNFILES_ROOT}/_main/bin/host/sl/sl_linux_built_bin"
do
  if [[ -x "${BUILT_BINARY}" ]]; then
    export RUNFILES_DIR="${RUNFILES_ROOT}"
    exec "${BUILT_BINARY}" "$@"
  fi
done

echo "Expected Bazel-built Sapling launcher in ${RUNFILES_ROOT}" >&2
exit 1
