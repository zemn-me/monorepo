#!/usr/bin/env bash
mkdir -p $HOME/.bazelisk
BAZELISK_HOME=$HOME/.bazelisk CARGO_BAZEL_REPIN=true bazelisk run --tool_tag=postupgrade //ci:postupgrade
