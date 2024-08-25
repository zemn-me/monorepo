Monorepo
===============================================================================

This is a bazel monorepo containing most of my side-projects and websites etc.
Using a monorepo in this way makes it much easier to ensure linting and
deployment are consistent across many projects, and prevents a lot of version
rot.

Prerequisites
-------------------------------------------------------------------------------

The only prerequisite is [bazelisk], which you can get on [brew]. You _can_ in
theory run it with npx via npx run @bazel/bazelisk, but it is very slow so I
don’t recommend it.

I recommend using the [VSCode] IDE. This repo is locally set up to configure it
to conform to various linting and formatting settings.

[bazelisk]: https://github.com/bazelbuild/bazelisk
[brew]: https://brew.sh
[VSCode]: https://code.visualstudio.com

Streamlining Bazel
===============================================================================

This repo uses [gazelle] to generate build instructions for projects. There is
support for Go, Bazel and Python.

[gazelle]: https://github.com/bazelbuild/bazel-gazelle


Remote Caching
-------------------------------------------------------------------------------

The project is configured to use a BuildBuddy cache for faster build times. If
you have an account, you can run `BUILDBUDDY_API_KEY=EDIT_AND_REPLACE
./.github/workflows/bootstrap_remote_cache.sh` from the project root, and it
will drop an .auth.bazelrc in there.

Once that's done, edit the file and replace EDIT_AND_REPLACE with your
BuildBuddy API key. I **do not** recommend changing "EDIT_AND_REPLACE" on the
bash commandline, or you'll end up having your secret API key stored in your
shell history.
