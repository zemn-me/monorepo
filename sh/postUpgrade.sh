#!/usr/bin/env bash
echo "let's find out what that mysterious file is..."
ls -la $HOME/.cache
cat $HOME/.cache
cat $HOME/.cache/bazelisk
CARGO_BAZEL_REPIN=true npx --yes @bazel/bazelisk run -- //ci:postupgrade
ls -la $HOME/.cache
cat $HOME/.cache
cat $HOME/.cache/bazelisk
