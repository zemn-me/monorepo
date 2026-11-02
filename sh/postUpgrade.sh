#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
# Repair changed archive URLs before Bazel loads repositories needed by the
# repair tools themselves. This bootstrap deliberately uses only Python stdlib.
python3 py/ci/post_upgrade/pnpm.py
python3 py/ci/post_upgrade/integrity.py MODULE.bazel
CARGO_BAZEL_REPIN=true ./sh/bin/bazel run //ci:postupgrade
