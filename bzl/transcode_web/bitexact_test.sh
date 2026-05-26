#!/usr/bin/env bash

set -euo pipefail

while [[ $# -gt 0 ]]; do
  left="$1"
  right="$2"
  label="$3"
  shift 3

  if ! cmp -s "$left" "$right"; then
    echo "$label encodes are not bitexact" >&2
    exit 1
  fi
done
