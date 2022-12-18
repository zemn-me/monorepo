# Third-party dependencies fetched by Bazel
# Unlike WORKSPACE, the content of this file is unordered.
# We keep them separate to make the WORKSPACE file more maintainable.

# Install the nodejs "bootstrap" package
# This provides the basic tools for running and packaging nodejs programs in Bazel
load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive", "http_file")
load("@bazel_tools//tools/build_defs/repo:git.bzl", "git_repository")

def fetch_dependencies():
    http_archive(
        name = "bazel_skylib",
        urls = [
            "https://mirror.bazel.build/github.com/bazelbuild/bazel-skylib/releases/download/1.3.0/bazel-skylib-1.3.0.tar.gz",
            "https://github.com/bazelbuild/bazel-skylib/releases/download/1.3.0/bazel-skylib-1.3.0.tar.gz",
        ],
        sha256 = "74d544d96f4a5bb630d465ca8bbcfe231e3594e5aae57e1edbf17a6eb3ca2506",
    )

    http_archive(
        name = "build_bazel_rules_nodejs",
        sha256 = "dcc55f810142b6cf46a44d0180a5a7fb923c04a5061e2e8d8eb05ccccc60864b",
        urls = ["https://github.com/bazelbuild/rules_nodejs/releases/download/5.8.0/rules_nodejs-5.8.0.tar.gz"],
    )

    http_archive(
        name = "rules_python",
        sha256 = "497ca47374f48c8b067d786b512ac10a276211810f4a580178ee9b9ad139323a",
        strip_prefix = "rules_python-0.16.1",
        url = "https://github.com/bazelbuild/rules_python/archive/refs/tags/0.16.1.tar.gz",
    )

    http_archive(
        name = "io_bazel_rules_go",
        sha256 = "56d8c5a5c91e1af73eca71a6fab2ced959b67c86d12ba37feedb0a2dfea441a6",
        urls = [
            "https://mirror.bazel.build/github.com/bazelbuild/rules_go/releases/download/v0.37.0/rules_go-v0.37.0.zip",
            "https://github.com/bazelbuild/rules_go/releases/download/v0.37.0/rules_go-v0.37.0.zip",
        ],
    )

    http_archive(
        name = "io_bazel_rules_docker",
        sha256 = "b1e80761a8a8243d03ebca8845e9cc1ba6c82ce7c5179ce2b295cd36f7e394bf",
        strip_prefix = "rules_docker-0.25.0",
        urls = ["https://github.com/bazelbuild/rules_docker/releases/download/v0.25.0/rules_docker-v0.25.0.tar.gz"],
    )

    http_archive(
        name = "rules_proto",
        sha256 = "66bfdf8782796239d3875d37e7de19b1d94301e8972b3cbd2446b332429b4df1",
        strip_prefix = "rules_proto-4.0.0",
        urls = [
            "https://mirror.bazel.build/github.com/bazelbuild/rules_proto/archive/refs/tags/4.0.0.tar.gz",
            "https://github.com/bazelbuild/rules_proto/archive/refs/tags/4.0.0.tar.gz",
        ],
    )

    http_archive(
        name = "com_google_protobuf",
        sha256 = "543395bc2ae58e72f7be674221db08b8f14e3bd7e3a19158f76105b3b61570a0",
        strip_prefix = "protobuf-3.21.8",
        urls = [
            "https://github.com/protocolbuffers/protobuf/archive/v3.21.8.tar.gz",
        ],
    )

    http_archive(
        name = "rules_typescript_proto",
        sha256 = "aac6dec2c8d55da2b2c2689b7a2afe44b691555cab32e2eaa2bdd29627d950e9",
        strip_prefix = "rules_typescript_proto-1.0.1",
        urls = [
            "https://github.com/Dig-Doug/rules_typescript_proto/archive/1.0.1.tar.gz",
        ],
    )

    http_archive(
        name = "rules_pkg",
        urls = [
            "https://mirror.bazel.build/github.com/bazelbuild/rules_pkg/releases/download/0.8.0/rules_pkg-0.8.0.tar.gz",
            "https://github.com/bazelbuild/rules_pkg/releases/download/0.8.0/rules_pkg-0.8.0.tar.gz",
        ],
        sha256 = "eea0f59c28a9241156a47d7a8e32db9122f3d50b505fae0f33de6ce4d9b61834",
    )

    http_archive(
        name = "bazel_gazelle",
        sha256 = "448e37e0dbf61d6fa8f00aaa12d191745e14f07c31cabfa731f0c8e8a4f41b97",
        urls = [
            "https://mirror.bazel.build/github.com/bazelbuild/bazel-gazelle/releases/download/v0.28.0/bazel-gazelle-v0.28.0.tar.gz",
            "https://github.com/bazelbuild/bazel-gazelle/releases/download/v0.28.0/bazel-gazelle-v0.28.0.tar.gz",
        ],
    )

    http_archive(
        name = "com_google_protobuf",
        sha256 = "9b4ee22c250fe31b16f1a24d61467e40780a3fbb9b91c3b65be2a376ed913a1a",
        strip_prefix = "protobuf-3.13.0",
        urls = [
            "https://github.com/protocolbuffers/protobuf/archive/v3.13.0.tar.gz",
        ],
    )

    http_archive(
        name = "com_github_bazelbuild_buildtools",
        sha256 = "e3bb0dc8b0274ea1aca75f1f8c0c835adbe589708ea89bf698069d0790701ea3",
        strip_prefix = "buildtools-5.1.0",
        urls = [
            "https://github.com/bazelbuild/buildtools/archive/refs/tags/5.1.0.tar.gz",
        ],
    )

    http_file(
        name = "inkscape_linux",
        sha256 = "b7a99b6c0ee2817706e77803643f4a6caf9e35bdec928e963c1d2ae86e5e4beb",
        urls = ["https://inkscape.org/es/gallery/item/31669/Inkscape-0a00cf5-x86_64.AppImage"],
        executable = True,
        downloaded_file_path = "bin",
    )

    http_archive(
        name = "pulumi_cli",
        sha256 = "d96ac680cc0f8aa6774adaf6777f276cb2178c01d398b0f503d443d92124e2f3",
        urls = [
            "https://github.com/pulumi/pulumi/releases/download/v3.49.0/pulumi-v3.49.0-linux-x64.tar.gz",
        ],
        build_file_content = """
exports_files(glob(["**/*"]))
        """,
    )

    http_archive(
        name = "cultistsimulator",
        strip_prefix = "cultistsimulator-visible-2022.3.n.1",
        urls = [
            "https://github.com/weatherfactory/cultistsimulator-visible/archive/refs/tags/v2022.3.n.1.tar.gz",
        ],
        sha256 = "c640c454db8bd2ef4b53cf00edffa959d6c6147718bafce9a43f48db286f2ea2",
        build_file_content = """
filegroup(
    name = "core",
    srcs = glob(["Assets/StreamingAssets/content/core/**/*.json"]),
    visibility = [ "//visibility:public" ]
)
exports_files(glob(["**/*"], exclude_directories=0))
        """,
        # exports_files(glob(["**/*"]), visibility=["//visibility:public"])
    )

    git_repository(
        name = "bazel_tools",
        branch = "master",
        remote = "git@github.com:attilaolah/bazel-tools.git",
    )

    http_archive(
        name = "aspect_rules_swc",
        sha256 = "9a68901c258b8a91ce721df1f9b1dc62c9dd6b2822143e31a0280396b98db543",
        strip_prefix = "rules_swc-0.20.1",
        url = "https://github.com/aspect-build/rules_swc/archive/refs/tags/v0.20.1.tar.gz",
    )

    http_archive(
        name = "rules_rust",
        sha256 = "5c2b6745236f8ce547f82eeacbbcc81d736734cc8bd92e60d3e3cdfa6e167bb5",
        urls = ["https://github.com/bazelbuild/rules_rust/releases/download/0.15.0/rules_rust-v0.15.0.tar.gz"],
    )

