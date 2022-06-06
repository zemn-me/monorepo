load("//bzl/versioning:rules.bzl", "bump_on_change_test")

bump_on_change_test(
    name = "version",
    srcs = [ "contents.txt" ],
    version_lock = "version.lock",
    version = "MAJOR",
    run_on_main = True
)