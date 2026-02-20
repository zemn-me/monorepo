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

RUNFILES_ROOT="$(find_runfiles_root)"
SL_BINARY="${RUNFILES_ROOT}/+_repo_rules+sapling_linux_amd64/usr/bin/sl"
PYTHON_SO="${RUNFILES_ROOT}/+_repo_rules+ubuntu2004_libpython3_8/usr/lib/x86_64-linux-gnu/libpython3.8.so.1.0"
LIBSSL_SO="${RUNFILES_ROOT}/+_repo_rules+ubuntu2004_libssl1_1/usr/lib/x86_64-linux-gnu/libssl.so.1.1"
LIBCRYPTO_SO="${RUNFILES_ROOT}/+_repo_rules+ubuntu2004_libssl1_1/usr/lib/x86_64-linux-gnu/libcrypto.so.1.1"
PY_MIN_MARKER="${RUNFILES_ROOT}/+_repo_rules+ubuntu2004_libpython3_8_minimal/usr/lib/python3.8/encodings/__init__.py"
PY_STDLIB_MARKER="${RUNFILES_ROOT}/+_repo_rules+ubuntu2004_libpython3_8_stdlib/usr/lib/python3.8/dataclasses.py"

PY_MIN_DIR="$(dirname "$(dirname "$PY_MIN_MARKER")")"
PY_STDLIB_DIR="$(dirname "$PY_STDLIB_MARKER")"

export LD_LIBRARY_PATH="$(dirname "$PYTHON_SO"):$(dirname "$LIBSSL_SO"):$(dirname "$LIBCRYPTO_SO")${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export PYTHONPATH="$PY_MIN_DIR:$PY_MIN_DIR/lib-dynload:$PY_STDLIB_DIR:$PY_STDLIB_DIR/lib-dynload${PYTHONPATH:+:$PYTHONPATH}"

exec "$SL_BINARY" "$@"
