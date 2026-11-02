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

BuildBuddy provides remote caching and execution. Create the ignored
`.auth.bazelrc` with the key from
[BuildBuddy Quickstart](https://app.buildbuddy.io/docs/setup/):

```bazelrc
build --remote_header=x-buildbuddy-api-key=EDIT_AND_REPLACE
```

Replace the placeholder in your editor. Alternatively, run
`./.github/workflows/bootstrap_bazel_remote_cache.sh` with an existing key in
`BUILDBUDDY_API_KEY`. Keep keys out of shell history and version control.

```sh
./sh/bin/bazel test --config=remote //go/encoding/jsonc/...
```

`remote` selects Linux amd64 execution and target platforms, GCC, caching, and
build results in BuildBuddy. It uses BuildBuddy’s official Ubuntu 22.04 image
from `gcr.io/flame-public`, pinned by digest. Browser libraries/fonts, vendored
OpenSSL, and Go timezone data are declared Bazel dependencies.

Outputs are Linux artifacts, including when launched from macOS. Omit
`--config=remote` for native builds and development servers. `bazel run` and
actions marked for local execution still run on your machine.

`ci` includes `remote`. PR presubmits use `ci-presubmit`, which disables local
result and build-event uploads. Their isolated credential must be **CAS-only**:
RBE needs permission to upload input blobs, while action-cache updates remain
denied server-side. Staging and submit use their writable key; jobs without
credentials use `ci-local`. The selected profile also reaches nested tests.

For uncached tests, rerun the GitHub workflow with debug logging enabled, or set
`BAZEL_TEST_UNCACHED=true` when launching `//ci:presubmit`.

<!-- -->
