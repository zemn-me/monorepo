load("//ts:rules.bzl", "eslint_test", "jest_test", "ts_lint", "ts_project")
load("//bzl/versioning:rules.bzl", "semver_version")
load("@build_bazel_rules_nodejs//:index.bzl", "generated_file_test")

semver_version(
    name = "version",
    major = "MAJOR",
    minor = "MINOR",
    patch = "PATCH",
)

generated_file_test(
    name = "version_concat_test",
    src = "expected.txt",
    generated = ":version",
)
