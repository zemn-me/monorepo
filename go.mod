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
	github.com/go-delve/delve v1.22.0
	github.com/golang/protobuf v1.5.3
	golang.org/x/tools v0.16.1
	honnef.co/go/tools v0.4.6
)

require (
	github.com/BurntSushi/toml v1.2.1 // indirect
	github.com/cilium/ebpf v0.11.0 // indirect
	github.com/cosiner/argv v0.1.0 // indirect
	github.com/cpuguy83/go-md2man/v2 v2.0.2 // indirect
	github.com/derekparker/trie v0.0.0-20230829180723-39f4de51ef7d // indirect
	github.com/go-delve/gore v0.11.6 // indirect
	github.com/go-delve/liner v1.2.3-0.20220127212407-d32d89dd2a5d // indirect
	github.com/google/go-dap v0.11.0 // indirect
	github.com/hashicorp/golang-lru v1.0.2 // indirect
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/mattn/go-runewidth v0.0.13 // indirect
	github.com/rivo/uniseg v0.2.0 // indirect
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	github.com/sashabaranov/go-openai v1.20.2 // indirect
	github.com/sirupsen/logrus v1.9.3 // indirect
	github.com/spf13/cobra v1.7.0 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	go.starlark.net v0.0.0-20231101134539-556fd59b42f6 // indirect
	golang.org/x/arch v0.6.0 // indirect
	golang.org/x/exp v0.0.0-20230224173230-c95f2b4c22f2 // indirect
	golang.org/x/exp/typeparams v0.0.0-20221208152030-732eee02a75a // indirect
	golang.org/x/mod v0.14.0 // indirect
	golang.org/x/sys v0.13.0 // indirect
	google.golang.org/protobuf v1.26.0 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)
