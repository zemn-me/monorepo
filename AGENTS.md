hello robot

this is a bazel monorepo. You must invoke bazel via ./sh/bin/bazel.

please run ./sh/bin/gazelle also! Or the presubmit will fail.

Changes must THEN be tested via ./sh/bin/bazel test path/to/your/changes/...

Bazel WILL take a long time! please don't interrupt the process! let it time out naturally...

don't forget to write tests!

toolchain
-------------------------------------------------------------------------------
Use the wrappers under `./sh/bin` for all tools.  This directory provides
`bazel`, `gazelle`, `go`, `pnpm`, formatters and other utilities pinned to
versions that work with this repo.  Prefer `./sh/bin/go`, `./sh/bin/gofmt`,
`./sh/bin/pnpm`, etc.

repository layout
-------------------------------------------------------------------------------
* `go/`  – Go modules and build files
* `py/`  – Python packages
* `rs/`  – Rust crates
* `js/`  – JavaScript tooling
* `ts/`  – TypeScript sources
* `bzl/` – helper Bazel rules
* `sh/bin/` – the wrapper binaries mentioned above
* `testing/` – small tests used in CI

Other folders hold configuration (`ci/`, `yml/`, `etc/`), assets (`css/`,
`html/`, `image/`), and assorted project-specific code.
