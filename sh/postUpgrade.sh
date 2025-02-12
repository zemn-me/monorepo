#!/usr/bin/env bash
CARGO_BAZEL_REPIN=true $(dirname ${BASH_SOURCE[0]})/bin/bazel run //ci:postupgrade
