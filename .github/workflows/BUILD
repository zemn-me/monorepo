load("@npm//yaml-validator:index.bzl", "yaml_validator_test")

yaml_validator_test(
    name = "validation",
    args = ["$(location :bazel.yml)"],
    data = ["bazel.yml"],
)
