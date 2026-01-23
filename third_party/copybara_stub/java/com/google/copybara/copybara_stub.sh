#!/usr/bin/env bash
set -euo pipefail

if [[ "${1-}" == "version" ]]; then
  echo "copybara stub (awaiting upstream Bazel 6 update)"
  exit 0
fi

echo "copybara stub: unsupported command" >&2
exit 1
