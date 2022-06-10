#!/usr/bin/env bash
BAZEL_CMD="${BAZEL_CMD:-yarn -s run bazel}"

FIXER_TARGETS=$($BAZEL_CMD test \
    # Only print failing targets
    --test_summary=terse \
    # Only test fixable targets
    --test_tag_filers=fixable \
    # Necessary for overriding filters on
    # versioned branch
    $@ | \
    # Get list of failing targets
    awk '{print $1}' | \
    # append '.fix' to fixable targets
    sed 's/$/.fix/g')

# Run all fixers
$BAZEL_CMD run $FIXER_TARGETS
