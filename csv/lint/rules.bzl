load("@bazel_skylib//rules:diff_test.bzl", "diff_test")
load("//csv/format:rules.bzl", "csv_format")

def csv_lint_test(name, srcs = [], **kwargs):
    for src in srcs:
        csv_format(
            name = name + src + "_format",
            src = src,
            **kwargs
        )

        diff_test(
            name = name + src + "_test",
            file1 = name + src + "_format",
            file2 = src,
        )

    native.test_suite(
        name = name,
        tests = [name + src + "_test" for src in srcs],
    )
