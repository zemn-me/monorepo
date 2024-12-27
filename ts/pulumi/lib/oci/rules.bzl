"Push an OCI image with Pulumi."

load("@aspect_bazel_lib//lib:expand_template.bzl", "expand_template_rule")
load("@rules_oci//oci:defs.bzl", "oci_push")
load("//ts:rules.bzl", "ts_project")

def pulumi_image(
        name,
        src,
        component_name = None,
        out = None,
        visibility = None):
    """
    Generate Pulumi component to push a container image to a repo.

    Args:
        name: name of the resulting ts_project module.
        src: content of the OCI image.
        component_name: name of the exported pulumi class
        out: ts filename (defaults to ${component_name}.ts)
        visibility: bazel visibility
    """

    if component_name == None:
        component_name = "".join([
            segment.capitalize()
            for segment in name.split("_")
        ])

    if out == None:
        out = component_name + ".ts"

    oci_push(
        name = name + "_push_bin",
        image = src,
        repository = "",
    )

    expand_template_rule(
        name = name + "_tsfiles",
        template = "//ts/pulumi/lib/oci:oci_image.tmpl.ts",
        out = out,
        data = [
            ":" + name + "_push_bin",
        ],
        substitutions = {
            "__ClassName": component_name,
            "__TYPE": native.package_name().replace("/", ":"),
            "__PUSH_BIN": "$(rootpath :" + name + "_push_bin" + ")",
        },
    )

    ts_project(
        name = name,
        srcs = [name + "_tsfiles"],
        data = [
            ":" + name + "_push_bin",
        ],
        deps = [
            "//:node_modules/@pulumi/pulumi",
            "//:node_modules/@pulumi/command",
            "//:node_modules/@types/node",
        ],
        visibility = visibility,
    )
