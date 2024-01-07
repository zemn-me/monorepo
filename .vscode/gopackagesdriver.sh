#!/usr/bin/env bash
# https://github.com/bazelbuild/rules_go/wiki/Editor-setup#2-launcher-script
"$(dirname ${BASH_SOURCE[0]})/../sh/bin/gopackagesdriver" "${@}"
