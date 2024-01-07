#!/usr/bin/env bash
# runs a binary built by bazel in this repo
cd $(dirname ${BASH_SOURCE[0]})

bazel run --ui_event_filters=-info,-stdout,-stderr --noshow_progress -- "${@}"

