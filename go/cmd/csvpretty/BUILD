load("//:rules.bzl", "go_binary")
load("@bazel_skylib//rules:diff_test.bzl", "diff_test")

go_binary(
    name = "csvpretty",
    srcs = glob(["*.go"]),
    visibility = ["//visibility:public"],
)

genrule(
    name = "csvpretty_integration_gen",
    srcs = [":test.csv"],
    outs = ["test_output.csv"],
    cmd = """
$(execpath :csvpretty) --input $(rootpath :test.csv) --output $@
    """,
    tools = [":csvpretty"],
)

diff_test(
    name = "csvpretty_integration",
    file1 = "test_output.csv",
    file2 = "test_out.csv",
)
