Monorepo
===============================================================================

This is a bazel monorepo containing most of my side-projects and websites etc.
Using a monorepo in this way makes it much easier to ensure linting and
deployment are consistent across many projects, and prevents a lot of version
rot.

Prerequisites
-------------------------------------------------------------------------------

The only prerequisite is [bazelisk]. On unix-like systems you can simply run
'./[sh/bin/bazel]', which automatically downloads bazelisk and caches it. You
_can_ in theory run it with npx via npx run @bazel/bazelisk, but it is very
slow so I don’t recommend it.

I recommend using the [VSCode] IDE. This repo is locally set up to configure it
to conform to various linting and formatting settings. It also adds [sh/bin] to
the PATH of your VSCode terminal emulator, which adds [pnpm], [buildifier],
[go] and all the other tools bootstrapped and controlled by bazel.

[pnpm]: /sh/bin/pnpm
[buildifier]: /sh/bin/buildifier
[go]: /sh/bin/go
[sh/bin/bazel]: /sh/bin/bazel
[sh/bin]: /sh/bin
[bazelisk]: https://github.com/bazelbuild/bazelisk
[brew]: https://brew.sh
[VSCode]: https://code.visualstudio.com

Streamlining Bazel
===============================================================================

This repo uses [gazelle] to generate build instructions for projects. There is
support for Go, Bazel and Python.

[gazelle]: https://github.com/bazelbuild/bazel-gazelle


Remote caching and execution
-------------------------------------------------------------------------------

BuildBuddy provides remote caching and opt-in remote execution. From the repo
root, run `./.github/workflows/bootstrap_bazel_remote_cache.sh` with an existing
read/write BuildBuddy API key in `BUILDBUDDY_API_KEY`. The script writes the
ignored `.auth.bazelrc`; never commit credentials or put keys in shell history.
You can also create `.auth.bazelrc` yourself with:

```bazelrc
build --remote_header=x-buildbuddy-api-key=EDIT_AND_REPLACE
```

Replace the placeholder in your editor with the key from
[BuildBuddy Quickstart](https://app.buildbuddy.io/docs/setup/).

To build or test using BuildBuddy's Linux amd64 executors:

```sh
./sh/bin/bazel test --config=remote //go/encoding/jsonc/...
./sh/bin/bazel build --config=remote @sqlite4java//:libsqlite4java.so
```

The `remote` profile selects matching Linux execution and target platforms, the
BuildBuddy GCC toolchain, remote caching, and build results in the BuildBuddy UI.
It produces Linux artifacts even when Bazel runs on macOS. Use ordinary Bazel
commands without `--config=remote` for native builds and locally launched tools
such as development servers; `bazel run` launches its output on your machine.
Actions marked for local execution still run locally, so targets that depend on
host-installed tools may need further changes before they support this profile.

PR CI retains its read-only cache setup. Remote execution requires uploading
action inputs and a read/write key; do not substitute a writable key into the
PR workflow. The `remote` profile is opt-in and is not enabled by `--config=ci`.

<!-- -->
