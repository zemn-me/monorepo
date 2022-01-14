load("@npm//yaml-validator:index.bzl", "yaml_validator_test")

def yaml_lint(name = None, srcs = None):
    yaml_validator_test(
        name = name,
        args = [ "$(location %s)" % x for x in srcs ],
        data = srcs
    )