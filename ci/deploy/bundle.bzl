"""Package the deploy launcher and the Bazel runfile aliases used by its child tools."""

load("@aspect_rules_js//js:defs.bzl", "js_image_layer")
load("@rules_pkg//pkg:providers.bzl", "PackageFilesInfo")
load("@rules_pkg//pkg:tar.bzl", "pkg_tar")
load("@rules_shell//shell:sh_test.bzl", "sh_test")

def _runfile_aliases_impl(ctx):
    binary = ctx.attr.binary[DefaultInfo]
    label = ctx.attr.binary.label
    root = label.package + "/" + label.name + ".runfiles/"
    runfiles = binary.default_runfiles
    files = {root + link.path: link.target_file for link in runfiles.root_symlinks.to_list()}
    for link in runfiles.symlinks.to_list():
        path = link.path[3:] if link.path.startswith("../") else ctx.workspace_name + "/" + link.path
        files[root + path] = link.target_file
    return [
        DefaultInfo(files = depset(files.values())),
        PackageFilesInfo(dest_src_map = files, attributes = {"mode": "0555"}),
    ]

_runfile_aliases = rule(
    implementation = _runfile_aliases_impl,
    attrs = {"binary": attr.label(mandatory = True)},
)

def deploy_bundle():
    """Build and exercise the two archives published together as one Actions artifact."""
    js_image_layer(
        name = "layers",
        binary = ":deploy",
        layer_groups = {"bundle": ""},
        tags = ["manual"],
    )
    native.filegroup(
        name = "program_archive",
        srcs = [":layers"],
        output_group = "bundle",
        tags = ["manual"],
    )

    # js_image_layer copies default_runfiles.files, omitting the other logical
    # paths Bazel declares for those files (including the Bash runfiles library).
    _runfile_aliases(name = "deploy_aliases", binary = ":deploy")
    pkg_tar(
        name = "runfile_aliases",
        srcs = [":deploy_aliases"],
        tags = ["manual"],
    )
    native.filegroup(
        name = "bundle",
        srcs = [":program_archive", ":runfile_aliases"],
        tags = ["manual"],
    )
    sh_test(
        name = "bundle_test",
        size = "medium",
        srcs = ["bundle_test.sh"],
        args = [
            "$(rootpath run.sh)",
            "$(rootpath :program_archive)",
            "$(rootpath deploy_failure_test.sh)",
        ],
        data = [
            ":program_archive",
            ":runfile_aliases",
            "deploy_failure_test.sh",
            "run.sh",
        ],
    )
