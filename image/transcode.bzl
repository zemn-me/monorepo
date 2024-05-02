"Transcode images across formats."

def _transcode_img_impl(ctx):
    ctx.actions.run(
        outputs = [ctx.outputs.output],
        inputs = [ctx.file.src],
        executable = ctx.executable.transcode_bin,
        arguments = ["-input", ctx.file.src.path, "-output", ctx.outputs.output.path],
        mnemonic = "ImageTranscode",
        progress_message = "Transcoding image",
    )

    return [
        DefaultInfo(
            files = depset([ctx.outputs.output]),
        ),
    ]

_transcode_img_rule = rule(
    implementation = _transcode_img_impl,
    attrs = {
        "src": attr.label(doc = "Input image file.", mandatory = True, allow_single_file = True),
        "output": attr.output(doc = "Output image file."),
        "transcode_bin": attr.label(doc = "Transcode binary.", mandatory = True, executable = True, cfg = "target"),
    },
)

def transcode_img(name, src, output_file_name):
    """
    Transcode an image from one format to another.

        name: Label name for the action
        input: An input image.
        output_file_name: an output image. Format is determined by its extension.
    """

    _transcode_img_rule(
        name = name,
        src = src,
        output = output_file_name,
        transcode_bin = "//go/img/cmd/transcode",
    )
