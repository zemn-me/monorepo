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
            "https://mirror.bazel.build/github.com/bazelbuild/bazel-skylib/releases/download/1.4.1/bazel-skylib-1.4.1.tar.gz",
            "https://github.com/bazelbuild/bazel-skylib/releases/download/1.4.1/bazel-skylib-1.4.1.tar.gz",
        ],
        sha256 = "b8a1527901774180afc798aeb28c4634bdccf19c4d98e7bdd1ce79d1fe9aaad7",
    )

    http_archive(
        name = "build_bazel_rules_nodejs",
        sha256 = "94070eff79305be05b7699207fbac5d2608054dd53e6109f7d00d923919ff45a",
        urls = ["https://github.com/bazelbuild/rules_nodejs/releases/download/5.8.2/rules_nodejs-5.8.2.tar.gz"],
    )

    http_archive(
        name = "rules_python",
        sha256 = "ffc7b877c95413c82bfd5482c017edcf759a6250d8b24e82f41f3c8b8d9e287e",
        strip_prefix = "rules_python-0.19.0",
        url = "https://github.com/bazelbuild/rules_python/archive/refs/tags/0.19.0.tar.gz",
    )

    http_archive(
        name = "io_bazel_rules_go",
        sha256 = "6b65cb7917b4d1709f9410ffe00ecf3e160edf674b78c54a894471320862184f",
        urls = [
            "https://mirror.bazel.build/github.com/bazelbuild/rules_go/releases/download/v0.39.0/rules_go-v0.39.0.zip",
            "https://github.com/bazelbuild/rules_go/releases/download/v0.39.0/rules_go-v0.39.0.zip",
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
            "https://mirror.bazel.build/github.com/bazelbuild/rules_pkg/releases/download/0.9.0/rules_pkg-0.9.0.tar.gz",
            "https://github.com/bazelbuild/rules_pkg/releases/download/0.9.0/rules_pkg-0.9.0.tar.gz",
        ],
        sha256 = "335632735e625d408870ec3e361e192e99ef7462315caa887417f4d88c4c8fb8",
    )

    http_archive(
        name = "bazel_gazelle",
        sha256 = "727f3e4edd96ea20c29e8c2ca9e8d2af724d8c7778e7923a854b2c80952bc405",
        urls = [
            "https://mirror.bazel.build/github.com/bazelbuild/bazel-gazelle/releases/download/v0.30.0/bazel-gazelle-v0.30.0.tar.gz",
            "https://github.com/bazelbuild/bazel-gazelle/releases/download/v0.30.0/bazel-gazelle-v0.30.0.tar.gz",
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
        sha256 = "a75c337f4d046e560298f52ae95add73b9b933e4d6fb01ed86d57313e53b68e6",
        strip_prefix = "buildtools-6.1.0",
        urls = [
            "https://github.com/bazelbuild/buildtools/archive/refs/tags/6.1.0.tar.gz",
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
        name = "pulumi_cli_linux_x64",
        sha256 = "4ab2b0dd2ad4dc92cbed71a667ab74eace39b3c8dfd7054719dfa6de2d6f9433",
        urls = [
            "https://github.com/pulumi/pulumi/releases/download/v3.63.0/pulumi-v3.63.0-linux-x64.tar.gz",
        ],
        build_file_content = """
exports_files(glob(["**/*"]))
""",
    )

    http_archive(
        name = "pulumi_cli_darwin_arm64",
        urls = [
            "https://github.com/pulumi/pulumi/releases/download/v3.63.0/pulumi-v3.63.0-darwin-arm64.tar.gz",
        ],
        sha256 = "a33401037f04d728e0fb060415f40c27cb2689cd5f12ef2cd5420a30e462b0a6",
        build_file_content = """
exports_files(glob(["**/*"]))
""",
    )

    http_archive(
        name = "pulumi_cli_darwin_x64",
        urls = [
            "https://github.com/pulumi/pulumi/releases/download/v3.59.0/pulumi-v3.59.0-darwin-x64.tar.gz",
        ],
        
        build_file_content = """
exports_files(glob(["**/*"]))
""",
    )

    http_archive(
        name = "pulumi_cli_linux_arm64",
        urls = [
            "https://github.com/pulumi/pulumi/releases/download/v3.59.0/pulumi-v3.59.0-linux-arm64.tar.gz",
        ],
        sha256 = "28b12b585a080e833471af99ab4b3c1cc9a644c88d952d2a35034fcd143eaf05",
        build_file_content = """
exports_files(glob(["**/*"]))
""",
    )

    http_archive(
        name = "pulumi_cli_windows_arm64",
        urls = [
            "https://github.com/pulumi/pulumi/releases/download/v3.59.0/pulumi-v3.59.0-windows-arm64.zip",
        ],
        
        build_file_content = """
exports_files(glob(["**/*"]))
""",
    )

    http_archive(
        name = "pulumi_cli_windows_x64",
        urls = [
            "https://github.com/pulumi/pulumi/releases/download/v3.59.0/pulumi-v3.59.0-windows-x64.zip",
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
        sha256 = "814bc08efbbe4d5e238579c9b0cded519b199486fbc26709fcf6d4d47de08f50",
        strip_prefix = "rules_swc-0.20.2",
        url = "https://github.com/aspect-build/rules_swc/archive/refs/tags/v0.20.2.tar.gz",
    )

    http_archive(
        name = "rules_rust",
        sha256 = "dc8d79fe9a5beb79d93e482eb807266a0e066e97a7b8c48d43ecf91f32a3a8f3",
        urls = ["https://github.com/bazelbuild/rules_rust/releases/download/0.19.0/rules_rust-v0.19.0.tar.gz"],
    )
