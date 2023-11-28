#!/usr/bin/env bash
#
# Copyright 2015 The Bazel Authors. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


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

files="$(sl status --change . --no-status)"

bazel query \
	--keep_going \
	"rdeps(//..., set($files))" | xargs -t bazel test

