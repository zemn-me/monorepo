#! /usr/bin/env bash

bazel query //... | \
grep '.fix$' | \
sed 's/\.fix$//g' | \
xargs bazel test --keep_going | \
grep FAILED | \
awk '{ print $1 }' | \
sed 's/$/.fix/g' |
while read COMMAND; do
    bazel run $COMMAND
done
