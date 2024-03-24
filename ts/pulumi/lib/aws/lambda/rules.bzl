load("@aspect_rules_js//npm:defs.bzl", "npm_package")

def js_lambda_func(
        name,
        srcs,
        entry_point,
        out,
        component_name):
    # needs to be altered to wrap the standard runtime
    npm_package(
        name = name + "_npm_pkg",
        srcs = srcs,
        include_external_repositories = ["*"],
    )

    js_binary(
        name = name + "_js_bin",
        srcs = [name + "_npm_pkg"],
        entry_point = entry_point,
    )

    ecr_image(
        name = name,
        src = name + "_js_bin",
        out = out,
        component_name = component_name,
    )
