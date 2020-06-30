#!/bin/bash

pushd ${0%/*}
bazel build //... && cp bazel-bin/*.md . && chmod 0644 *.md && git add *.md && git commit -m "Regenerate documentation"
popd

