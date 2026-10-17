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

BuildBuddy provides remote caching and execution. From the repo
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
The executor image is built by `//bzl/remote_execution:image` from Canonical’s
digest-pinned official Ubuntu 22.04 image and checksum-pinned Ubuntu snapshot
packages for GCC and basic build utilities. No third-party executor base is used. Chromium and
ChromeDriver declare their shared libraries as Bazel runtime inputs, Cargo
builds vendored OpenSSL, and the API server embeds Go's timezone database.
The browser libraries, OpenSSL, and timezone data are Bazel dependencies rather
than packages installed in the executor image.

The base is [`docker.io/library/ubuntu:22.04`](https://hub.docker.com/_/ubuntu),
maintained by Canonical; `MODULE.bazel` pins its amd64 manifest digest. The
bootstrap package list uses Ubuntu’s dated snapshot, with archive checksums in
`MODULE.bazel.lock`. `rules_oci` assembles these inputs without executing package
installation scripts. The image publication workflow runs locally on a GitHub
runner, checks C/C++ compilation inside the image, and publishes to
`ghcr.io/zemn-me/monorepo-rbe-ubuntu`. After changing image inputs, publish first,
then update `buildbuddy.platform` to the resulting immutable digest and run the
full uncached presubmit suite before merging.

It produces Linux artifacts even when Bazel runs on macOS. Use ordinary Bazel
commands without `--config=remote` for native builds and locally launched tools
such as development servers; `bazel run` launches its output on your machine.
Actions marked for local execution still run locally, so targets that depend on
host-installed tools may need further changes before they support this profile.

The `ci` profile includes `remote`. Regular PR presubmits use `ci-presubmit`,
which adds `--remote_upload_local_results=false` and disables build-event
uploads. Their isolated BuildBuddy credential must be **CAS-only**: it allows
uploading execution inputs, but denies action-cache updates at the server.
A fully read-only key cannot upload new inputs and therefore cannot support
RBE. Staging and submit retain their read/write key. Jobs without credentials
fall back to `ci-local`; it also remains available for native runner builds.
Presubmit passes its chosen profile to the nested Bazel test command.
To force actual test execution, rerun the GitHub workflow with debug logging
enabled, or set `BAZEL_TEST_UNCACHED=true` when launching `//ci:presubmit`.

<!-- -->
