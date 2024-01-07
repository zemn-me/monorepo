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

require (
	github.com/golang/protobuf v1.5.3
	golang.org/x/tools/gopls v0.14.2
)

require (
	github.com/BurntSushi/toml v1.2.1 // indirect
	github.com/google/go-cmp v0.5.9 // indirect
	github.com/sergi/go-diff v1.1.0 // indirect
	golang.org/x/exp/typeparams v0.0.0-20221212164502-fae10dda9338 // indirect
	golang.org/x/mod v0.14.0 // indirect
	golang.org/x/sync v0.4.0 // indirect
	golang.org/x/sys v0.14.0 // indirect
	golang.org/x/telemetry v0.0.0-20231114163143-69313e640400 // indirect
	golang.org/x/text v0.13.0 // indirect
	golang.org/x/tools v0.14.1-0.20231114185516-c9d3e7de13fd // indirect
	golang.org/x/vuln v1.0.1 // indirect
	google.golang.org/protobuf v1.26.0 // indirect
	honnef.co/go/tools v0.4.5 // indirect
	mvdan.cc/gofumpt v0.4.0 // indirect
	mvdan.cc/xurls/v2 v2.4.0 // indirect
)
