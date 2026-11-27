#!/usr/bin/env bash
set -euo pipefail

# Pulumi records some runfile paths in resource inputs. Give both revisions
# the same location and extract into an empty tree so removed files stay gone.
directory="$RUNNER_TEMP/pulumi-program"
mkdir "$directory"
trap 'rm -rf -- "$directory"' EXIT
tar -xf "$1/layers_bundle.tar.gz" -C "$directory"
tar -xf "$1/runfile_aliases.tar" -C "$directory"
program="$directory/$2"
shift 2
launcher="$directory/ci/deploy/deploy"
export RUNFILES_DIR="$launcher.runfiles"
cd "$RUNFILES_DIR/_main"
"$program" "$@"
