load("//ts:rules.bzl", "eslint_test", "jest_test", "ts_lint", "ts_project")
load("//bzl/versioning:rules.bzl", "bump_on_change_test")

bump_on_change_test(
    name = "version",
    srcs = ["contents.txt"],
    run_on_main = True,
    version = "MAJOR",
    version_lock = "version.lock",
)
