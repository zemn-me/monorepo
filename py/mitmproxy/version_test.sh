#!/usr/bin/env bash
set -euo pipefail
output=$("$1" --version)
printf '%s\n' "$output"
[[ "$output" == *"Mitmproxy:"* ]]
[[ "$output" == *"Python:"*"3.14."* ]]
