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
            "https://mirror.bazel.build/github.com/bazelbuild/bazel-skylib/releases/download/1.4.2/bazel-skylib-1.4.2.tar.gz",
            "https://github.com/bazelbuild/bazel-skylib/releases/download/1.4.2/bazel-skylib-1.4.2.tar.gz",
        ],
        sha256 = "66ffd9315665bfaafc96b52278f57c7e2dd09f5ede279ea6d39b2be471e7e3aa",
    )

    http_archive(
        name = "rules_python",
        sha256 = "5868e73107a8e85d8f323806e60cad7283f34b32163ea6ff1020cf27abef6036",
        strip_prefix = "rules_python-0.25.0",
        url = "https://github.com/bazelbuild/rules_python/archive/refs/tags/0.25.0.tar.gz",
    )

    http_archive(
        name = "io_bazel_rules_go",
        sha256 = "6b65cb7917b4d1709f9410ffe00ecf3e160edf674b78c54a894471320862184f",
        urls = [
            "https://mirror.bazel.build/github.com/bazelbuild/rules_go/releases/download/v0.39.0/rules_go-v0.39.0.zip",
            "https://github.com/bazelbuild/rules_go/releases/download/v0.42.0/rules_go-v0.39.0.zip",
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
            "https://mirror.bazel.build/github.com/bazelbuild/rules_pkg/releases/download/0.9.1/rules_pkg-0.9.1.tar.gz",
            "https://github.com/bazelbuild/rules_pkg/releases/download/0.9.1/rules_pkg-0.9.1.tar.gz",
        ],
        sha256 = "8f9ee2dc10c1ae514ee599a8b42ed99fa262b757058f65ad3c384289ff70c4b8",
    )

    http_archive(
        name = "bazel_gazelle",
        sha256 = "d3fa66a39028e97d76f9e2db8f1b0c11c099e8e01bf363a923074784e451f809",
        urls = [
            "https://mirror.bazel.build/github.com/bazelbuild/bazel-gazelle/releases/download/v0.33.0/bazel-gazelle-v0.33.0.tar.gz",
            "https://github.com/bazelbuild/bazel-gazelle/releases/download/v0.33.0/bazel-gazelle-v0.33.0.tar.gz",
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
        sha256 = "42968f9134ba2c75c03bb271bd7bb062afb7da449f9b913c96e5be4ce890030a",
        strip_prefix = "buildtools-6.3.3",
        urls = [
            "https://github.com/bazelbuild/buildtools/archive/refs/tags/v6.3.3.tar.gz",
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
        sha256 = "3227b656f624410f745cef4977430f96fd3daab1118f2180ab4bda8ce029168c",
        urls = [
            "https://github.com/pulumi/pulumi/releases/download/v3.86.0/pulumi-v3.86.0-linux-x64.tar.gz",
        ],
        build_file_content = """
exports_files(glob(["**/*"]))
""",
    )

    http_archive(
        name = "pulumi_cli_darwin_arm64",
        urls = [
            "https://github.com/pulumi/pulumi/releases/download/v3.86.0/pulumi-v3.86.0-darwin-arm64.tar.gz",
        ],
        sha256 = "5514673cfbead3ac0726ca8c5469ae2bc13f849ac1bd375b00742df9d78e1443",
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
            "https://github.com/pulumi/pulumi/releases/download/v3.86.0/pulumi-v3.86.0-linux-arm64.tar.gz",
        ],
        sha256 = "a33d0b61a1308f9d8c746afb4d7a3ccba55db98208c16fbb7d6640de99c0f725",
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
        name = "rules_rust",
        sha256 = "c46bdafc582d9bd48a6f97000d05af4829f62d5fee10a2a3edddf2f3d9a232c1",
        urls = ["https://github.com/bazelbuild/rules_rust/releases/download/0.28.0/rules_rust-v0.28.0.tar.gz"],
    )

    http_archive(
        name = "aspect_rules_ts",
        strip_prefix = "rules_ts-1.4.0",
        url = "https://github.com/aspect-build/rules_ts/releases/download/v1.4.0/rules_ts-v1.4.0.tar.gz",
    )
    http_archive(
        name = "rules_nodejs",
        sha256 = "162f4adfd719ba42b8a6f16030a20f434dc110c65dc608660ef7b3411c9873f9",
        strip_prefix = "rules_nodejs-6.0.2",
        url = "https://github.com/bazelbuild/rules_nodejs/releases/download/v6.0.2/rules_nodejs-v6.0.2.tar.gz",
    )

    http_archive(
        name = "aspect_rules_js",
        sha256 = "8563dd34e75ce989fd2e45ad6dd527c6e6fafacb2dcf6f7dd36ca6e7fb0ca670",
        strip_prefix = "rules_js-1.32.5",
        url = "https://github.com/aspect-build/rules_js/releases/download/v1.32.5/rules_js-v1.32.5.tar.gz",
    )

    http_archive(
        name = "aspect_rules_swc",
        sha256 = "c35e633c2c90a4cd6796e66d66bcf37d31a81737afc76030201a9ef8599abc58",
        strip_prefix = "rules_swc-0.21.3",
        url = "https://github.com/aspect-build/rules_swc/archive/refs/tags/v0.21.3.tar.gz",
    )

    # Got no idea why but MS doesn't publish versions of this...
    http_archive(
        name = "microsoft_json_schemas",
        url = "https://github.com/microsoft/json-schemas/archive/cc26e9c614cf9bf3455a3bf9409c9516e9803653.zip",
        strip_prefix = "json-schemas-cc26e9c614cf9bf3455a3bf9409c9516e9803653",
        build_file_content = """
exports_files(glob(["**/*"]))
        """,
        sha256 = "7d7842c27def0b076b4b7f90406f8ca0e86ece9a9fa631e9e90d283c5545372c",
    )

    ##########
    # FFMPEG #
    ##########

    http_archive(
        name = "ffmpeg_linux_x64",
        url = "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz",
        strip_prefix = "ffmpeg-6.0-amd64-static",
        build_file_content = """
exports_files(glob(["**/*"]))
        """,
        sha256 = "af3ca630347de28dde516f0ee70279e5fab6e35a9dc9ad889581f9bc66bcb750",
    )

    http_archive(
        name = "ffmpeg_linux_i686",
        url = "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-i686-static.tar.xz",
        strip_prefix = "ffmpeg-6.0-i686-static",
        build_file_content = """
exports_files(glob(["**/*"]))
        """,
        sha256 = "df4ff17a39758f9e3af2aafe337f2661711161ebade6b20516110ed207c6a94e",
    )

    http_archive(
        name = "ffmpeg_linux_arm64",
        url = "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz",
        strip_prefix = "ffmpeg-6.0-arm64-static",
        build_file_content = """
exports_files(glob(["**/*"]))
        """,
        sha256 = "df4ff17a3af58f9e3af2aafe337f2661711161ebade6b20516110ed207c6a94e",
    )

    http_archive(
        name = "ffmpeg_macos_x64",
        url = "https://evermeet.cx/pub/ffmpeg/ffmpeg-6.0.zip",
        strip_prefix = "[ fix this when i use this on macos... ]",
        build_file_content = """
exports_files(glob(["**/*"]))
        """,
        sha256 = "df4ff17a3af58f9e3af2aafe337f266171f161ebade6b20516110ed207c6a94e",
    )

    http_archive(
        name = "ffmpeg_macos_arm64",
        url = "https://www.osxexperts.net/ffmpeg6arm.zip",
        build_file_content = """
exports_files(glob(["**/*"]))
        """,
        sha256 = "15e67ff413d3d2436ddb3efd282344e50b8f1c6f834979b984371b90ebaf0449",
    )
