load("@aspect_bazel_lib//lib:expand_template.bzl", "expand_template")
load("@aspect_bazel_lib//lib:tar.bzl", "mtree_mutate", "mtree_spec", "tar")
load("@rules_oci//oci:defs.bzl", "oci_image")
load("//ts:rules.bzl", "ts_project")
load("//ts/pulumi/lib/docker:mtree.bzl", "mtree_content_paths")

def ecr_image(
        name,
        srcs,
        component_name,
        out,
        base = "@distroless_base",
        component_pulumi_name = None,
        visibility = None):
    """
    Generates a pulumi awsx/ecr.Image for a given set of srcs and entrypoint.

    Args:
        name: name of the ts_project rule
        srcs: List of bazel binary entrypoints.
        component_name: name of the exported pulumi class
        component_pulumi_name: used to construct the unique resource IDs for Pulumi
        out: ts filename
        base: the base docker image. Defaults to @distroless_base
        visibility: bazel visibility
    """

    package_dir = "monorepo"

    if component_pulumi_name == None:
        component_pulumi_name = native.package_name().replace("/", ":") + ":" + component_name

    mtree_files_spec_out = name + "_container_tar_files_spec.mtree"
    mtree_spec(
        name = name + "_container_tar_files_spec",
        srcs = srcs,
        out = mtree_files_spec_out,
    )

    mtree_mutate(
        name = name + "_container_tar_spec",
        mtree = mtree_files_spec_out,
        package_dir = "monorepo",
    )

    mtree_content_paths(
        name = name + "_entrypoints",
        mtree_file = name + "_container_tar_spec",
        content_paths = srcs,
        out = name + "_entrypoints.txt",
    )

    tar(
        name = name + "_tar",
        srcs = srcs,
        mtree = name + "_container_tar_spec",
    )

    oci_image(
        name = name + "_image",
        base = base,
        tars = [name + "_tar"],
        workdir = package_dir,
        entrypoint = name + "_entrypoints",
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
        visibility = visibility,
    )
