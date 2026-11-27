#!/usr/bin/env bash
set -euo pipefail

# The slim Renovate container lacks patch, which Bazel needs for npm patches.
# Install bootstrap tools before dropping back to the image's normal user.
apt-get update
apt-get install -y --no-install-recommends patch python3
# Keep the exact selected release’s date on range pins and rollbacks, as in
# the Bazel-tested npm package.
patch --batch --forward --fuzz=0 -d /usr/local/renovate -p0 < /renovate-target-dates.patch
exec runuser -u ubuntu -- renovate "$@"
