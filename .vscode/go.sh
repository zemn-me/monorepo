#!/usr/bin/env bash
cd $1
exec bazel run --tool_tag=go -- @io_bazel_rules_go//go "${@}"
