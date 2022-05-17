alias(
    name = "app_image",
    actual = "@inkscape_linux//file:bin",
    visibility = ["//:__subpackages__"],
)

# Required to bypass FUSE restrictions on bazel.
sh_binary(
   name = "bin",
   srcs = [ "run.sh" ],
   data = [ ":app_image" ],
   env = { "APP_IMAGE": "$(location :app_image)" },
   deps = ["@bazel_tools//tools/bash/runfiles"],
)
