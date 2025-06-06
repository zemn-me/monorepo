hello robot

this is a bazel monorepo. `bazel` is provided in `$PATH`. It maps to ./sh/bin/bazel. There are many tools in ./sh/bin that can be used and they are all added to $PATH.

please run gazelle also! Or the presubmit will fail.

Changes must be tested via bazel test path/to/your/changes/...

Bazel WILL take a long time! please don't interrupt the process! let it time out naturally...

don't forget to write tests!
