#!/usr/bin/env bash
# https://github.com/bazelbuild/rules_go/wiki/Editor-setup#2-launcher-script
exec bazel run --tool_tag=gopackagesdriver -- @io_bazel_rules_go//go/tools/gopackagesdriver "${@}"
