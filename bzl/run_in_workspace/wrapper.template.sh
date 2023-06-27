#!/usr/bin/env bash

# $1 -> binary location to run in working directory
# $2...$∞ -> args to pass to the binary at runtime


# Runfiles lookup library for Bazel-built Bash binaries and tests, version 3.
#
# VERSION HISTORY:
# - version 3: Fixes a bug in the init code on macOS and makes the library aware
#              of Bzlmod repository mappings.
#   Features:
#     - With Bzlmod enabled, rlocation now takes the repository mapping of the
#       Bazel repository containing the calling script into account when
#       looking up runfiles. The new, optional second argument to rlocation can
#       be used to specify the canonical name of the Bazel repository to use
#       instead of this default. The new runfiles_current_repository function
#       can be used to obtain the canonical name of the N-th caller's Bazel
#       repository.
#   Fixed:
#     - Sourcing a shell script that contains the init code from a shell script
#       that itself contains the init code no longer fails on macOS.
#   Compatibility:
#     - The init script and the runfiles library are backwards and forwards
#       compatible with version 2.
# - version 2: Shorter init code.
#   Features:
#     - "set -euo pipefail" only at end of init code.
#       "set -e" breaks the source <path1> || source <path2> || ... scheme on
#       macOS, because it terminates if path1 does not exist.
#     - Not exporting any environment variables in init code.
#       This is now done in runfiles.bash itself.
#   Compatibility:
#     - The v1 init code can load the v2 library, i.e. if you have older source
#       code (still using v1 init) then you can build it with newer Bazel (which
#       contains the v2 library).
#     - The reverse is not true: the v2 init code CANNOT load the v1 library,
#       i.e. if your project (or any of its external dependencies) use v2 init
#       code, then you need a newer Bazel version (which contains the v2
#       library).
# - version 1: Original Bash runfiles library.
#
# ENVIRONMENT:
# - If RUNFILES_LIB_DEBUG=1 is set, the script will print diagnostic messages to
#   stderr.
#
# USAGE:
# 1.  Depend on this runfiles library from your build rule:
#
#       sh_binary(
#           name = "my_binary",
#           ...
#           deps = ["@bazel_tools//tools/bash/runfiles"],
#       )
#
# 2.  Source the runfiles library.
#
#     The runfiles library itself defines rlocation which you would need to look
#     up the library's runtime location, thus we have a chicken-and-egg problem.
#     Insert the following code snippet to the top of your main script:
#
# --- begin runfiles.bash initialization v3 ---
# Copy-pasted from the Bazel Bash runfiles library v3.
set -uo pipefail; set +e; f=bazel_tools/tools/bash/runfiles/runfiles.bash
source "${RUNFILES_DIR:-/dev/null}/$f" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "${RUNFILES_MANIFEST_FILE:-/dev/null}" | cut -f2- -d' ')" 2>/dev/null || \
  source "$0.runfiles/$f" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "$0.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
  source "$(grep -sm1 "^$f " "$0.exe.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
  { echo>&2 "ERROR: cannot find $f"; exit 1; }; f=; set -e
# --- end runfiles.bash initialization v3 ---
#
#
# 3.  Use rlocation to look up runfile paths.
#
#       cat "$(rlocation my_workspace/path/to/my/data.txt)"
#

cd $BUILD_WORKING_DIRECTORY

# ATAL: aspect_rules_js[js_binary]: BAZEL_BINDIR must be set in environment to
# the makevar $(BINDIR) in js_binary build actions (which run in the execroot) so
# that build actions can change directories to always run out of the root of the Bazel
# output tree. See https://docs.bazel.build/versions/main/be/make-variables.html#predefined_variables.
# This is automatically set by 'js_run_binary' (https://github.com/aspect-build/rules_js/blob/main/docs/js_run_binary.md) which is the recommended rule to use for using a js_binary as the tool of a build action. If this is not a build action you can set the BAZEL_BINDIR to '.' instead to supress this error. For more context on this design decision, please read the aspect_rules_js README https://github.com/aspect-build/rules_js/tree/dbb5af0d2a9a2bb50e4cf4a96dbc582b27567155#running-nodejs-programs.
export BAZEL_BINDIR="."

TARGET=$(rlocation monorepo/$TARGET_PROGRAM)

echoerr() { echo "$@" 1>&2; }

function rootpath {
    # the following will be horrible for compatibility with bash 3.
    # arguably this whole thing should be a Python script.
    $ROOTPATHS

    echoerr Unknown label: "$1"
    exit 1
}

function location {
    rootpath $@
}

if [ -z "$TARGET" ]; then
    echo "Cannot locate monorepo/$TARGET_PROGRAM."
    exit 2
fi

echo "Running $TARGET."

$TARGET $@ $BUILD_TIME_ARGS