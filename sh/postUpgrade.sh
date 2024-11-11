#!/usr/bin/env bash
# double check assumptions
whoami
groups
ls $HOME/.cache/
touch $HOME/.cache/testtesttest
ls $HOME/.cache/
ls -la $HOME
# try it out
CARGO_BAZEL_REPIN=true bazelisk run --tool_tag=postupgrade //ci:postupgrade
# the real yolo
chmod o+w $HOME/.cache/
CARGO_BAZEL_REPIN=true bazelisk run --tool_tag=postupgrade //ci:postupgrade
