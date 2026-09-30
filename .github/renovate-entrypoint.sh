#!/usr/bin/env bash
set -euo pipefail

# The slim Renovate container lacks patch, which Bazel needs for npm patches.
# Install bootstrap tools before dropping back to the image's normal user.
apt-get update
apt-get install -y --no-install-recommends patch python3
exec runuser -u ubuntu -- renovate "$@"
