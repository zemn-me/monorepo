#!/usr/bin/env bash
BAZEL_CMD="${BAZEL_CMD:-yarn -s run bazel}"

FIXER_TARGETS=$($BAZEL_CMD test \
    --test_summary=terse \
    --test_tag_fitlers=fixable \
    $@ | \
    awk '{print $1}' | \
    sed 's/$/.fix/g')

# Run all fixers
$BAZEL_CMD run $FIXER_TARGETS
