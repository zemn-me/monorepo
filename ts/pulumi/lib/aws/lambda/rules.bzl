load("@aspect_bazel_lib//lib:expand_template.bzl", "expand_template")
load("@aspect_rules_js//npm:defs.bzl", "npm_package")
load("//js:rules.bzl", "js_binary")
load("//ts:rules.bzl", "jest_test", "ts_project")
load("//ts/pulumi/lib/docker:rules.bzl", "ecr_image")

def js_lambda_func(
        name,
        deps,
        entry_point,
        out,
        component_name):
    """
    Construct a pulumi docker.Image from a lambda Handler.

    Args:
        name: name of the ts_project containing the new pulumi class
        deps: set of js sources
        entry_point: the js module file name that exposes .handler: Handler
        out: generated module file name
        component_name: generated module component name
    """

    npm_package(
        name = name + "_npm_pkg",
        srcs = deps,
        include_external_repositories = ["*"],
    )

    expand_template(
        name = name + "_interface_test_gen",
        template = "//ts/pulumi/lib/aws/lambda:interface_test.tmpl.ts",
        out = out + ".interface_test.ts",
        data = [
            entry_point,
        ],
        substitutions = {
            "__modulename": "$(rootpath " + entry_point + ")",
        },
    )

    ts_project(
        name = name + "_test_ts_project",
        srcs = [out + ".interface_test.ts"],
        deps = [
            "//:node_modules/@types/aws-lambda",
        ] + deps,
    )

    jest_test(
        name = name + "_test_interface",
        data = [name + "_test_ts_project"],
        srcs = [out + ".interface_test.js"],
    )

    js_binary(
        name = name + "_js_bin",
        data = [name + "_npm_pkg"],
        entry_point = entry_point,
    )

    ecr_image(
        name = name,
        src = name + "_js_bin",
        out = out,
        component_name = component_name,
    )
