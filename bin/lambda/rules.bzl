"""



note from future thomas!!!

a lot of this code should be replaced with js_image_layer!!!

"""


load("@rules_oci//oci:defs.bzl", "oci_image")
load("@rules_pkg//pkg:tar.bzl", "pkg_tar")

def _lambda_docker_image(
        name,
        src,  # the target binary
        visibility = None):
    archive_tag = name + "_archive"
    pkg_tar(
        name = archive_tag,
        srcs = [src],
    )

    oci_image(
        name = name,
        base = "@distroless_base",
        tars = [archive_tag],
        entrypoint = ["$(rootpath archive_tag)"],
        visibility = visibility,
    )


def pulumi_lambda_function(
    name,
    src,
    visibility = None,
):
