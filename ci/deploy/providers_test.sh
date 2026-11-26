#!/usr/bin/env bash
set -euo pipefail

export HOME="$TEST_TMPDIR" PULUMI_SKIP_UPDATE_CHECK=true
export HTTPS_PROXY=http://127.0.0.1:9 HTTP_PROXY=http://127.0.0.1:9 NO_PROXY=localhost,127.0.0.1
exec "$1" verify
