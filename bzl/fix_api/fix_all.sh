#! /usr/bin/env bash

PATTERN="${1:-//...}"

if [ ! -z  "$BUILD_WORKING_DIRECTORY" ]; then
    pushd $BUILD_WORKING_DIRECTORY
fi

bazel query $PATTERN | \
grep '.fix$' | \
sed 's/\.fix$//g' | \
xargs bazel test --keep_going | \
grep FAILED | \
awk '{ print $1 }' | \
sed 's/$/.fix/g' |
while read COMMAND; do
    bazel run $COMMAND
done


popd