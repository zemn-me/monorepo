# Install the nodejs "bootstrap" package
# This provides the basic tools for running and packaging nodejs programs in Bazel
load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive", "http_file")

def fetch_dependencies():
    http_archive(
        name = "rules_rust",
        sha256 = "319b1c35c11204ef56b1d94a549f6b9d3532813b778f02d709ef68c837036cf1",
        urls = ["https://github.com/bazelbuild/rules_rust/releases/download/0.50.1/rules_rust-v0.50.1.tar.gz"],
    )

    http_file(
        name = "inkscape_linux",
        sha256 = "b7a99b6c0ee2817706e77803643f4a6caf9e35bdec928e963c1d2ae86e5e4beb",
        urls = ["https://inkscape.org/es/gallery/item/31669/Inkscape-0a00cf5-x86_64.AppImage"],
        executable = True,
        downloaded_file_path = "bin",
    )
