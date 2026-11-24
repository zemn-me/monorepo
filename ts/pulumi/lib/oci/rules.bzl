"Push an OCI image with Pulumi."

load("@aspect_bazel_lib//lib:expand_template.bzl", "expand_template_rule")
load("@rules_oci//oci:defs.bzl", "oci_image", "oci_push")
load("@rules_pkg//pkg:tar.bzl", "pkg_tar")
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

    _pulumi_image(name, src, component_name, out, visibility)

def pulumi_binary_image(name, image_name, srcs, base, component_name, visibility = None):
    """Package a native executable and expose the same executable to local Lambda runtimes.

    Args:
        name: Pulumi image component target.
        image_name: OCI image target.
        srcs: Exactly one executable target, used as the image entrypoint.
        base: Base OCI image.
        component_name: Generated Pulumi class name.
        visibility: Visibility of the Pulumi component.
    """
    if len(srcs) != 1:
        fail("pulumi_binary_image srcs must contain exactly one entrypoint executable")
    entrypoint = srcs[0]
    pkg_tar(
        name = image_name + "_entrypoint",
        srcs = srcs,
        include_runfiles = True,
        mode = "",  # Preserve which runfiles are executable.
    )
    oci_image(
        name = image_name,
        base = base,
        entrypoint = ["/" + native.package_relative_label(entrypoint).name],
        tars = [":" + image_name + "_entrypoint"],
    )
    _pulumi_image(
        name = name,
        src = ":" + image_name,
        component_name = component_name,
        out = None,
        visibility = visibility,
        entrypoint = entrypoint,
    )

def _pulumi_image(name, src, component_name, out, visibility, entrypoint = None):
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
        repository = "None",
    )

    expand_template_rule(
        name = name + "_tsfiles",
        template = "//ts/pulumi/lib/oci:oci_image.tmpl.ts",
        out = out,
        data = [
            ":" + name + "_push_bin",
            src + ".digest",
        ] + ([entrypoint] if entrypoint else []),
        substitutions = {
            "__ClassName": component_name,
            "// __BINARY_RUNTIME": 'readonly binary = "$(rlocationpath {})";'.format(entrypoint) if entrypoint else "",
            "__TYPE": native.package_name().replace("/", ":"),
            "__PUSH_BIN": "$(rootpath :" + name + "_push_bin" + ")",
            "__DIGEST": "$(rootpath " + src + ".digest)",
        },
    )

    ts_project(
        name = name,
        srcs = [name + "_tsfiles"],
        data = [":" + name + "_tsfiles"],
        deps = [
            "//:node_modules/@pulumi/pulumi",
            "//:node_modules/@types/node",
            "//ts/pulumi/lib/oci",
            "//ts/pulumi/lib",
        ],
        visibility = visibility,
    )
