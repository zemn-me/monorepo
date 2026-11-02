#!/usr/bin/env bash
# runs a binary built by bazel in this repo
BAZEL="$(realpath $(dirname ${BASH_SOURCE[0]})/bin/bazel)"
cd $(dirname ${BASH_SOURCE[0]})

$BAZEL run --run_under "cd $PWD &&" --ui_event_filters=-info,-stdout,-stderr -- "${@}"

