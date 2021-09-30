load("@npm//yaml-validator:index.bzl", "yaml_validator_test")

yaml_validator_test(
    name = "validation",
    data = [ "bazel.yml" ],
    args = [ "$(location :bazel.yml)" ]
)