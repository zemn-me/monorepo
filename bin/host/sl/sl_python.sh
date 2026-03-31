#!/usr/bin/env bash
set -euo pipefail

export PYTHONPATH="${EXT_BUILD_ROOT}/external/rules_python++pip+pip_314_setuptools/site-packages${PYTHONPATH:+:${PYTHONPATH}}"
export SETUPTOOLS_USE_DISTUTILS=local

PYTHON_BIN="${HERMETIC_PYTHON:-${EXT_BUILD_ROOT}/external/rules_python++python+python_3_10_x86_64-unknown-linux-gnu/bin/python3.10}"

if [[ $# -eq 0 || "$1" == "-c" || "$1" == "-m" || "$1" == "-" ]]; then
  exec "${PYTHON_BIN}" "$@"
fi

exec "${PYTHON_BIN}" -c '
import builtins
import setuptools
import sys

script = sys.argv[1]
sys.argv = sys.argv[1:]
with open(script, "rb") as f:
    code = compile(f.read(), script, "exec")
globals_dict = {
    "__builtins__": builtins,
    "__cached__": None,
    "__file__": script,
    "__name__": "__main__",
    "__package__": None,
}
exec(code, globals_dict)
' "$@"
