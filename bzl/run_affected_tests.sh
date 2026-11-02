#!/usr/bin/env bash

# This script looks at the files changed in git against origin/master
# (actually a common ancestor of origin/master and the current commit) and
# queries for all build and test targets associated with those files.
#
# Running this script on a CI server should allow you to only test the targets
# that have changed since the last time your merged or fast forwarded.
#
# This script can be used to recreate the benefits that TAP provides to
# Google's developers as describe by Mike Bland on his article on Google's
# infrastructure.
# https://mike-bland.com/2012/10/01/tools.html#tools-tap-sponge
#
# "Every single change submitted to Google's Perforce depot is built and
# tested, and only those targets affected by a particular change are
# built and tested"

if test "$BUILD_WORKSPACE_DIRECTORY" = ""; then
	echo "Please run from bazel."
	exit 1
fi

cd $BUILD_WORKSPACE_DIRECTORY

if ! test -d .sl; then
	echo "You must be using Sapling."
	exit 1
fi

files="$(sl status --change . --no-status)"

bazel query \
	--keep_going \
	"rdeps(//..., set($files))" | xargs -t bazel test

