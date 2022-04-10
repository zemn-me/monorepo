load("@rules_pkg//pkg:pkg.bzl", "pkg_zip")

filegroup(
    name = "all_files",
    srcs = glob(["**/*"]),
)

pkg_zip(
    name = "mod_zip",
    srcs = [":all_files"],
)
