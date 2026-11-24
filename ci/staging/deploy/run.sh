#!/usr/bin/env bash
set -euo pipefail

# Pulumi records some runfile paths in resource inputs. Give both revisions
# the same location and extract into an empty tree so removed files stay gone.
directory="$RUNNER_TEMP/staging-program"
mkdir "$directory"
trap 'rm -rf -- "$directory"' EXIT
tar -xf "$1" -C "$directory"
launcher="$directory/ci/staging/deploy/deploy"
export RUNFILES_DIR="$launcher.runfiles"
cd "$RUNFILES_DIR/_main"
"$launcher" "$2"
