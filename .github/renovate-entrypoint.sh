#!/usr/bin/env bash
set -euo pipefail

# The slim Renovate container lacks patch, which Bazel needs for npm patches.
# Install bootstrap tools before dropping back to the image's normal user.
apt-get update
apt-get install -y --no-install-recommends patch python3
# Renovate already selected a dated release for a rollback. Preserve that date
# in the report and the branch candidate, as in the Bazel-tested npm package.
patch --batch --forward --fuzz=0 -d /usr/local/renovate -p0 < /renovate-rollback-date.patch
exec runuser -u ubuntu -- renovate "$@"
