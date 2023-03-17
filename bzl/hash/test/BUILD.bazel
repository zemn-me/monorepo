load("//bzl/hash:rules.bzl", "hashes")
load("@build_bazel_rules_nodejs//:index.bzl", "generated_file_test")

hashes(
    name = "hashes",
    srcs = [
        "input1.txt",
        "input2.txt",
    ],
)

generated_file_test(
    name = "version_concat_test",
    src = "expected.txt",
    generated = ":hashes",
)
