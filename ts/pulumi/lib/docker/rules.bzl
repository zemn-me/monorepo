load("@aspect_bazel_lib//lib:expand_template.bzl", "expand_template")
load("@aspect_bazel_lib//lib:tar.bzl", "tar")
load("@rules_oci//oci:defs.bzl", "oci_image")
load("//ts:rules.bzl", "ts_project")

def ecr_image(
        name,
        src,
        component_name,
        out,
        base = "@distroless_base",
        component_pulumi_name = None,
        visibility = None):
    """
    Generates a pulumi awsx/ecr.Image for a given set of srcs and entrypoint.

    Args:
        name: name of the ts_project rule
        src: content of the docker image. Must be a bazel-style binary.
        component_name: name of the exported pulumi class
        component_pulumi_name: used to construct the unique resource IDs for Pulumi
        out: ts filename
        base: the base docker image. Defaults to @distroless_base
        visibility: bazel visibility
    """

    if component_pulumi_name == None:
        component_pulumi_name = native.package_name().replace("/", ":") + ":" + component_name

    tar(
        name = name + "_tar",
        srcs = [src],
    )

    oci_image(
        name = name + "_image",
        base = base,
        tars = [name + "_tar"],
        # below eventually needs to be a dynamically calculated file.
        # https://docs.aspect.build/rulesets/rules_oci/docs/image/#entrypoint
        # entrypoint = "ts/pulumi/lib/docker/testing/example/simple/main_bin.sh",
        visibility = visibility,
    )

    # workaround for Pulumi's lack of 'just use this docker image.'
    expand_template(
        name = name + "_dockerfile",
        template = "//ts/pulumi/lib/docker:Dockerfile.tmpl",
        out = "Dockerfile",
        data = [":" + name + "_image"],
        substitutions = {
            "SOURCE_IMAGE": "$(rootpath :" + name + "_image)",
        },
    )

    expand_template(
        name = name + "_tsfiles",
        template = "//ts/pulumi/lib/docker:oci_image.tmpl.ts",
        out = out,
        data = [":" + name + "_dockerfile"],
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
            "//:node_modules/@types/node",
            "//:node_modules/@pulumi/awsx",
        ],
    )
