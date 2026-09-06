#!/usr/bin/env bash
set -euo pipefail

# Git is already required by Renovate. Accept the zero-context npm patches
# without depending on a separately installed system patch executable.
exec git apply --no-index --unidiff-zero "$@"
