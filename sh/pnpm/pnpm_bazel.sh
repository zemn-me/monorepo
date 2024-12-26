#!/usr/bin/env bash
#
# Attaches bazel's workspace directory to pnpm so it can be run directly
# under bazel and it will change the workspace correctly.
#

$PNPM_BINARY --dir "$BUILD_WORKSPACE_DIRECTORY" $@
