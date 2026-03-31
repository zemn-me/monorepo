#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/linuxbrew/.linuxbrew/bin:${PATH}"
exec /home/linuxbrew/.linuxbrew/bin/corepack yarn "$@"
