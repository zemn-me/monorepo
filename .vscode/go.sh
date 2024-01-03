#!/usr/bin/env bash
exec bazel run --tool_tag=go -- @io_bazel_rules_go//go "${@}"
