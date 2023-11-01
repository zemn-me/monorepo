// do not manually update this file, instead run go mod tidy
// to automatically pick up and or remove any dependencies.
//
// if you do this, you must // bazel run //:gazelle-update-repos and
// bazel run //:gazelle to appropriately bump the repo definitions
// that bazel uses.
//
// I'm eventually planning to just put a FIX file in root that performs all
// these busywork tasks.
//
// This comment seems to imply that you can do this with such a command:
// https://stackoverflow.com/questions/71613426/run-gazelle-in-dry-run-or-warn-mode
// however, annoyingly, this would have to be run outside of the bazel test runner
// as I don't think you can implicitly just depend on every bazel file
module github.com/zemn-me/monorepo

go 1.19

require github.com/golang/protobuf v1.5.3

require google.golang.org/protobuf v1.31.0
