load("@aspect_bazel_lib//lib:expand_template.bzl", "expand_template_rule")
load("@rules_oci//oci:defs.bzl", "oci_image")
load("@rules_pkg//pkg:tar.bzl", "pkg_tar")
load("//ts:rules.bzl", "ts_project")

def ecr_image(
        name,
        srcs,
        entry_point,
        component_name,
        out,
        component_pulumi_name = None,
        visibility = None):
    """
    Generates a pulumi awsx/ecr.Image for a given set of srcs and entrypoint.

    Args:
        name: name of the ts_project rule
        srcs: content of the docker image
        entry_point: what to run when the image starts
        component_name: name of the exported pulumi class
        component_pulumi_name: used to construct the unique resource IDs for Pulumi
        out: ts filename
        visibility: bazel visibility
    """

    if component_pulumi_name == None:
        component_pulumi_name = "/".replace(native.package_name(), ":") + ":" + component_name

    pkg_tar(
        name = name + "_tar",
        srcs = srcs,
    )

    oci_image(
        name = name + "_image",
        base = "@distroless_base",
        tars = [name + "_tar"],
        entrypoint = entry_point,
        visibility = visibility,
    )

    # workaround for Pulumi's lack of 'just use this docker image.'
    expand_template_rule(
        name = name + "_dockerfile",
        template = "//ts/pulumi/lib/docker:Dockerfile.tmpl",
        out = "Dockerfile",
        substitutions = {
            "SOURCE_IMAGE": "$(rootpath :" + name + "_image)",
        },
    )

    expand_template_rule(
        name = name + "_tsfiles",
        template = "//ts/pulumi/lib/docker:oci_image.tmpl.ts",
        out = out,
        substitutions = {
            "__ClassName": component_name,
            "__TYPE": component_pulumi_name,
            "__DOCKERFILE_PATH": "$(rootpath :" + name + "_dockerfile)",
        },
    )

    ts_project(
        name = name,
        srcs = [name + "_tsfiles"],
        data = [
            name + "_dockerfile",
            name + "_image",
        ],
        deps = [
            "//:node_modules/@pulumi/aws",
            "//:node_modules/@pulumi/pulumi",
        ],
    )
