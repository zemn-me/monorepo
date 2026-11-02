"Prepare image sources for the web."

load("//image:transcode.bzl", "transcode_img")

def image_source(name, src, target_formats = [".png", ".webp"]):
    """
    Creates a set of <source> elements corresponding to the input image
    transcoded into several formats for web.
    """

    for format in target_formats:
        transcode_img
