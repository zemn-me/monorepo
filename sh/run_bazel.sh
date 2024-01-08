#!/usr/bin/env bash
# runs a binary built by bazel in this repo
BAZEL="$(realpath $(dirname ${BASH_SOURCE[0]})/bin/bazel)"
cd $(dirname ${BASH_SOURCE[0]})

$BAZEL run --ui_event_filters=-info,-stdout,-stderr --noshow_progress -- "${@}"

