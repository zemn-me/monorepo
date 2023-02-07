load("@aspect_bazel_lib//lib:copy_to_directory.bzl", "copy_to_directory")

def _api_documenter_impl(ctx):
    dir = ctx.actions.declare_directory(
        ctx.attr.output_directory,
    )

    ctx.actions.run(
        outputs = [dir],
        inputs = [ctx.file.input_directory],
        executable = ctx.executable.api_documenter_binary,
        arguments = ["markdown", "-i", ctx.file.input_directory.path, "-o", dir.path],
        mnemonic = "APIDocumenter",
        progress_message = "Running api-documeneter (https://api-extractor.com)",
    )

    return [
        DefaultInfo(
            files = depset([dir]),
        ),
    ]

_api_documenter_rule = rule(
    implementation = _api_documenter_impl,
    attrs = {
        "input_directory": attr.label(mandatory = True, allow_single_file = True),
        "output_directory": attr.string(default = "api_docs"),
        "api_documenter_binary": attr.label(mandatory = True, executable = True, cfg = "target"),
    },
)

def api_documenter(name, docModel = None, **kwargs):
    copy_to_directory(
        name = name + "_docModel_dir",
        srcs = [docModel],
    )

    _api_documenter_rule(
        name = name,
        api_documenter_binary = "//js/api-documenter:api_documenter_binary",
        input_directory = ":" + name + "_docModel_dir",
        **kwargs
    )
