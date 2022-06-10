#!/usr/bin/env bash
BAZEL="${BAZEL:-yarn -s run bazel}"

FIXER_TARGETS=$($BAZEL test \
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
$BAZEL run $FIXER_TARGETS
