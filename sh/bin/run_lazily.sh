#!/usr/bin/env bash
# runs a bazel binary, but invokes bazel only when not cached.

SH_BINDIR="$(dirname ${BASH_SOURCE[0]})"

BAZEL="$SH_BINDIR/bazel"

WORKSPACE_ROOT="$($BAZEL info workspace)"
BAZEL_OUT="$WORKSPACE_ROOT/dist"
LAZY_CACHE_DIR="$WORKSPACE_ROOT/.script_cache"

mkdir -p $LAZY_CACHE_DIR

TARGET="$1"
TARGET_SCRIPT_LOCATION="$LAZY_CACHE_DIR/$TARGET"

shift


if find "$TARGET_SCRIPT_LOCATION" -mmin -120 | read > /dev/null; then
    $TARGET_SCRIPT_LOCATION $@
    exit
fi


mkdir -p "$(dirname $TARGET_SCRIPT_LOCATION)"

$BAZEL run --ui_event_filters=-info,-stdout,-stderr --script_path="$TARGET_SCRIPT_LOCATION" $TARGET
$TARGET_SCRIPT_LOCATION $@
