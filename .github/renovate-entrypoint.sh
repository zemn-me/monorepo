#!/usr/bin/env bash
set -euo pipefail

# The slim Renovate container lacks patch, which Bazel needs for npm patches.
# Install bootstrap tools before dropping back to the image's normal user.
apt-get update
apt-get install -y --no-install-recommends patch python3 protobuf-compiler python3-protobuf
bindings=$(mktemp -d)
chmod 0755 "$bindings"
protoc -I /bcr-adapter --python_out="$bindings" /bcr-adapter/py/ci/renovate_bcr/registry.proto
exec runuser -u ubuntu -- env PYTHONPATH="$bindings" /usr/bin/python3 /bcr-adapter/py/ci/renovate_bcr/feed.py "$@"
