load("@aspect_bazel_lib//lib:expand_template.bzl", "expand_template")
load("@aspect_rules_js//npm:defs.bzl", "npm_package")
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

    # -------- module interface test ...
    expand_template(
        name = name + "_interface_test_gen",
        template = "//ts/pulumi/lib/aws/lambda:interface_test.tmpl.ts",
        out = out + ".interface_test.ts",
        data = [
            entry_point,
        ],
        substitutions = {
            "__modulename": "$(rootpath " + entry_point + ")",
            "@ts-expect-error": "[remove expect error]",
        },
    )

    ts_project(
        name = name + "_test_ts_project",
        srcs = [out + ".interface_test.ts"],
        deps = [
            "//:node_modules/@types/aws-lambda",
            "//:node_modules/@types/jest",
        ] + deps,
    )

    jest_test(
        name = name + "_test_interface",
        data = [name + "_test_ts_project"],
        srcs = [out + ".interface_test.js"],
    )

    # ---------------------

    # package up all our js deps into one bundle so
    # node can resolve them without bazel intervention
    npm_package(
        name = name + "_npm_pkg",
        srcs = deps,
        include_external_repositories = ["*"],
    )

    # probably layer on https://github.com/aws/aws-lambda-base-images/tree/provided.al2023
    ecr_image(
        name = name + "_image",
        # need to instrument a binary that runs aws-lambda-rit ...
        src = name + "_npm_pkg",
        out = out + ".image.ts",
        base = "@ecr_lambda_base",
        component_name = component_name,
    )

    expand_template(
        name = name + "_pulumi_lambda_gen",
        template = "//ts/pulumi/lib/aws/lambda:lambda.tmpl.ts",
        out = out,
        data = [
            out + ".image.js",
        ],
        substitutions = {
            "__modulename": "$(rootpath " + out + ".image.js" + ")",
            "@ts-expect-error": "[remove expect error]",
        },
    )

    ts_project(
        name = name,
        srcs = [out],
        deps = [
            name + "_image",
            "//:node_modules/@pulumi/aws",
            "//:node_modules/@pulumi/awsx",
            "//:node_modules/@pulumi/pulumi",
        ],
    )
