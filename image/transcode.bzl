"Transcode images across formats."

def _transcode_img_impl(ctx):
    args = ctx.actions.args()
    args.add("-input", ctx.file.src.path)
    args.add("-output", ctx.outputs.output.path)

    if ctx.attr.width:
        args.add("-width", ctx.attr.width)
    if ctx.attr.height:
        args.add("-height", ctx.attr.height)
    if ctx.attr.fit:
        args.add("-fit", ctx.attr.fit)
    if ctx.attr.crop_scale:
        args.add("-crop_scale", ctx.attr.crop_scale)
    if ctx.attr.quality:
        args.add("-quality", ctx.attr.quality)
    if ctx.attr.progressive_jpeg:
        args.add("-progressive_jpeg")

    ctx.actions.run(
        outputs = [ctx.outputs.output],
        inputs = [ctx.file.src],
        executable = ctx.executable.transcode_bin,
        arguments = [args],
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
        "width": attr.int(doc = "Optional output width in pixels."),
        "height": attr.int(doc = "Optional output height in pixels."),
        "fit": attr.string(doc = "Optional resize fit mode: contain or cover."),
        "crop_scale": attr.string(doc = "Optional inward crop factor for cover fit."),
        "quality": attr.int(doc = "Optional lossy output quality from 1 to 100."),
        "progressive_jpeg": attr.bool(doc = "Encode JPEG output in progressive mode."),
    },
)

def transcode_img(name, src, output_file_name, width = None, height = None, fit = None, crop_scale = None, quality = None, progressive_jpeg = False):
    """
    Transcode an image from one format to another.

        name: Label name for the action
        input: An input image.
        output_file_name: an output image. Format is determined by its extension.
        width: Optional output width in pixels.
        height: Optional output height in pixels.
        fit: Optional resize fit mode: contain or cover.
        crop_scale: Optional inward crop factor for cover fit.
        quality: Optional lossy output quality from 1 to 100.
        progressive_jpeg: Encode JPEG output in progressive mode.
    """

    kwargs = {}
    if width != None:
        kwargs["width"] = width
    if height != None:
        kwargs["height"] = height
    if fit != None:
        kwargs["fit"] = fit
    if crop_scale != None:
        kwargs["crop_scale"] = crop_scale
    if quality != None:
        kwargs["quality"] = quality
    if progressive_jpeg:
        kwargs["progressive_jpeg"] = progressive_jpeg

    _transcode_img_rule(
        name = name,
        src = src,
        output = output_file_name,
        transcode_bin = "//go/img/cmd/transcode",
        **kwargs
    )
