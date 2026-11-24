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

    _pulumi_image(name, src, component_name, out, visibility, [], "")

def pulumi_binary_image(name, image_name, binary, base, component_name, tools = [], visibility = None):
    """Package a native executable and expose the same executable to local Lambda runtimes.

    Args:
        name: Pulumi image component target.
        image_name: OCI image target.
        binary: Executable target whose basename is the image entrypoint.
        base: Base OCI image.
        component_name: Generated Pulumi class name.
        tools: Additional executables installed in /usr/local/bin.
        visibility: Visibility of the Pulumi component.
    """
    pkg_tar(name = image_name + "_entrypoint", srcs = [binary])
    layers = [":" + image_name + "_entrypoint"]
    if tools:
        pkg_tar(name = image_name + "_tools", srcs = tools, mode = "0755", package_dir = "/usr/local/bin")
        layers.append(":" + image_name + "_tools")
    oci_image(
        name = image_name,
        base = base,
        entrypoint = ["/" + native.package_relative_label(binary).name],
        tars = layers,
    )
    runtime = {
        "binary": "$(rlocationpath " + binary + ")",
        "tools": ["$(rlocationpath " + tool + ")" for tool in tools],
    }
    _pulumi_image(
        name = name,
        src = ":" + image_name,
        component_name = component_name,
        out = None,
        visibility = visibility,
        runtime_files = [binary] + tools,
        runtime_declaration = "readonly runtime = " + json.encode(runtime) + ";",
    )

def _pulumi_image(name, src, component_name, out, visibility, runtime_files, runtime_declaration):
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
        ] + runtime_files,
        substitutions = {
            "__ClassName": component_name,
            "// __BINARY_RUNTIME": runtime_declaration,
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
