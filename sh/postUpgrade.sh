#!/usr/bin/env bash
CARGO_BAZEL_REPIN=true npx --yes @bazel/bazelisk run -- //ci:postupgrade
