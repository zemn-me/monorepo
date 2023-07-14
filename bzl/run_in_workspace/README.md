# run_in_workspace

This is a bazel rule which will take a binary and associated args and deps and proxy it so that
it runs inside the bazel workspace (i.e. the developer's git repo).

By default, 'bazel run \[binary\]' runs in a bazel-specific working directory.
