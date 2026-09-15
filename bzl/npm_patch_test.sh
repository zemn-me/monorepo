#!/usr/bin/env bash
set -euo pipefail

patch_tool="$PWD/$1"
cd "$TEST_TMPDIR"
mkdir -p dist
printf "import ts from 'typescript';\n" > dist/test.mjs
cat > change.patch <<'PATCH'
--- dist/test.mjs
+++ dist/test.mjs
@@ -1 +1 @@
-import ts from 'typescript';
+import ts from 'typescript5';
PATCH

"$patch_tool" -p0 < change.patch
printf "import ts from 'typescript5';\n" > expected.mjs
cmp expected.mjs dist/test.mjs

# A mismatched patch must fail rather than silently leave an unpatched package.
if "$patch_tool" -p0 < change.patch; then
    echo 'Expected an already-applied patch to fail' >&2
    exit 1
fi
