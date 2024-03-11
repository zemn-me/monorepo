# Install the nodejs "bootstrap" package
# This provides the basic tools for running and packaging nodejs programs in Bazel
load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive", "http_file")

def fetch_dependencies():
    http_archive(
        name = "bazel_skylib",
        urls = [
            "https://mirror.bazel.build/github.com/bazelbuild/bazel-skylib/releases/download/1.5.0/bazel-skylib-1.5.0.tar.gz",
            "https://github.com/bazelbuild/bazel-skylib/releases/download/1.5.0/bazel-skylib-1.5.0.tar.gz",
        ],
        sha256 = "cd55a062e763b9349921f0f5db8c3933288dc8ba4f76dd9416aac68acee3cb94",
    )

    http_archive(
        name = "rules_python",
        sha256 = "c68bdc4fbec25de5b5493b8819cfc877c4ea299c0dcb15c244c5a00208cde311",
        strip_prefix = "rules_python-0.31.0",
        url = "https://github.com/bazelbuild/rules_python/archive/refs/tags/0.31.0.tar.gz",
    )

    http_archive(
        name = "io_bazel_rules_go",
        sha256 = "80a98277ad1311dacd837f9b16db62887702e9f1d1c4c9f796d0121a46c8e184",
        url = "https://github.com/bazelbuild/rules_go/releases/download/v0.46.0/rules_go-v0.46.0.zip",
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
        url = "https://github.com/bazelbuild/rules_proto/archive/refs/tags/4.0.0.tar.gz",
    )

    http_archive(
        name = "com_google_protobuf",
        sha256 = "d19643d265b978383352b3143f04c0641eea75a75235c111cc01a1350173180e",
        strip_prefix = "protobuf-25.3",
        urls = [
            "https://github.com/protocolbuffers/protobuf/archive/v25.3.tar.gz",
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
            "https://mirror.bazel.build/github.com/bazelbuild/rules_pkg/releases/download/0.10.1/rules_pkg-0.10.1.tar.gz",
            "https://github.com/bazelbuild/rules_pkg/releases/download/0.10.1/rules_pkg-0.10.1.tar.gz",
        ],
        sha256 = "d250924a2ecc5176808fc4c25d5cf5e9e79e6346d79d5ab1c493e289e722d1d0",
    )

    http_archive(
        name = "bazel_gazelle",
        sha256 = "32938bda16e6700063035479063d9d24c60eda8d79fd4739563f50d331cb3209",
        urls = [
            "https://mirror.bazel.build/github.com/bazelbuild/bazel-gazelle/releases/download/v0.35.0/bazel-gazelle-v0.35.0.tar.gz",
            "https://github.com/bazelbuild/bazel-gazelle/releases/download/v0.35.0/bazel-gazelle-v0.35.0.tar.gz",
        ],
    )

    http_archive(
        name = "com_google_protobuf",
        sha256 = "d19643d265b978383352b3143f04c0641eea75a75235c111cc01a1350173180e",
        strip_prefix = "protobuf-25.3",
        urls = [
            "https://github.com/protocolbuffers/protobuf/archive/v25.3.tar.gz",
        ],
    )

    http_archive(
        name = "com_github_bazelbuild_buildtools",
        sha256 = "05c3c3602d25aeda1e9dbc91d3b66e624c1f9fdadf273e5480b489e744ca7269",
        strip_prefix = "buildtools-6.4.0",
        urls = [
            "https://github.com/bazelbuild/buildtools/archive/refs/tags/v6.4.0.tar.gz",
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
        sha256 = "88c972f1c03016586c213929f78c6dc4b951f4345a1787a8b2474fde5dcc9b1f",
        urls = [
            "https://github.com/pulumi/pulumi/releases/download/v3.109.0/pulumi-v3.109.0-linux-x64.tar.gz",
        ],
        build_file_content = """
exports_files(glob(["**/*"]))
""",
    )

    http_archive(
        name = "pulumi_cli_darwin_arm64",
        urls = [
            "https://github.com/pulumi/pulumi/releases/download/v3.109.0/pulumi-v3.109.0-darwin-arm64.tar.gz",
        ],
        sha256 = "f5c2e1a4725c2313cb72980af677be84e929c7a8eb3a25542c6fa13f1cadd95a",
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
            "https://github.com/pulumi/pulumi/releases/download/v3.109.0/pulumi-v3.109.0-linux-arm64.tar.gz",
        ],
        sha256 = "fb2a1a7c6ce0c1105bd574dae6658f15261f9437c62a70ce68f38c295574cd8e",
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

    http_archive(
        name = "rules_rust",
        sha256 = "c30dfdf1e86fd50650a76ea645b3a45f2f00667b06187a685e9554e167ca97ee",
        urls = ["https://github.com/bazelbuild/rules_rust/releases/download/0.40.0/rules_rust-v0.40.0.tar.gz"],
    )

    http_archive(
        name = "aspect_rules_ts",
        strip_prefix = "rules_ts-2.2.0",
        sha256 = "c77f0dfa78c407893806491223c1264c289074feefbf706721743a3556fa7cea",
        url = "https://github.com/aspect-build/rules_ts/releases/download/v2.2.0/rules_ts-v2.2.0.tar.gz",
    )

    http_archive(
        name = "rules_nodejs",
        sha256 = "a50986c7d2f2dc43a5b9b81a6245fd89bdc4866f1d5e316d9cef2782dd859292",
        strip_prefix = "rules_nodejs-6.0.5",
        url = "https://github.com/bazelbuild/rules_nodejs/releases/download/v6.0.5/rules_nodejs-v6.0.5.tar.gz",
    )

    http_archive(
        name = "aspect_rules_js",
        sha256 = "edc7b0255114fafdbbd593ea5d5fdfd54b2a603f33b3a49518910ac618e1bf2b",
        strip_prefix = "rules_js-1.38.0",
        url = "https://github.com/aspect-build/rules_js/releases/download/v1.38.0/rules_js-v1.38.0.tar.gz",
    )

    http_archive(
        name = "aspect_rules_swc",
        sha256 = "cde09df7dea773adaed896612434559f8955d2dfb2cfd6429ee333f30299ed34",
        strip_prefix = "rules_swc-1.2.2",
        url = "https://github.com/aspect-build/rules_swc/archive/refs/tags/v1.2.2.tar.gz",
    )

    # Got no idea why but MS doesn't publish versions of this...
    http_archive(
        name = "microsoft_json_schemas",
        url = "https://github.com/microsoft/json-schemas/archive/238972e02f381681f77ef7fe26fe2dfd6f993a7f.zip",
        strip_prefix = "json-schemas-238972e02f381681f77ef7fe26fe2dfd6f993a7f",
        build_file_content = """
exports_files(glob(["**/*"]))
        """,
        sha256 = "dff226ca8f5dc498580a2cc55654af893d425b00afd642908f99aba5facb9d56",
    )

    ##########
    # FFMPEG #
    ##########

    http_archive(
        name = "ffmpeg_linux_x64",
        url = "https://www.johnvansickle.com/ffmpeg/old-releases/ffmpeg-5.1.1-amd64-static.tar.xz",
        strip_prefix = "ffmpeg-5.1.1-amd64-static",
        build_file_content = """
exports_files(glob(["**/*"]))
        """,
        sha256 = "2d848c37f7f276be0262d9123a84fbfe72bb159921ffcce3bd7106f143d29f42",
    )

    http_archive(
        name = "ffmpeg_linux_i686",
        url = "https://www.johnvansickle.com/ffmpeg/old-releases/ffmpeg-5.1.1-i686-static.tar.xz",
        strip_prefix = "ffmpeg-6.0-i686-static",
        build_file_content = """
exports_files(glob(["**/*"]))
        """,
        sha256 = "df4ff17a39758f9e3af2aafe337f2661711161ebade6b20516110ed207c6a94e",
    )

    http_archive(
        name = "ffmpeg_linux_arm64",
        url = "https://www.johnvansickle.com/ffmpeg/old-releases/ffmpeg-5.1.1-arm64-static.tar.xz",
        strip_prefix = "ffmpeg-5.1.1-arm64-static",
        build_file_content = """
exports_files(glob(["**/*"]))
        """,
        sha256 = "49f9beb7690afcbd4832d3577d9f0c87374d63c39cde5097dfd52d61b24b4855",
    )

    http_archive(
        name = "ffmpeg_macos_x64",
        url = "https://evermeet.cx/pub/ffmpeg/ffmpeg-6.0.zip",
        build_file_content = """
exports_files(glob(["**/*"]))
        """,
        sha256 = "9a810d222862a7230fd7035c91e32beb605af7501c3517580f2bc1eb8faddacc",
    )

    http_archive(
        name = "ffmpeg_macos_arm64",
        url = "https://www.osxexperts.net/ffmpeg6arm.zip",
        build_file_content = """
exports_files(glob(["**/*"]))
        """,
        sha256 = "15e67ff413d3d2436ddb3efd282344e50b8f1c6f834979b984371b90ebaf0449",
    )

    http_archive(
        name = "bazel_features",
        sha256 = "06f02b97b6badb3227df2141a4b4622272cdcd2951526f40a888ab5f43897f14",
        strip_prefix = "bazel_features-1.9.0",
        url = "https://github.com/bazel-contrib/bazel_features/releases/download/v1.9.0/bazel_features-v1.9.0.tar.gz",
    )

    chromedriver_buildfile = """
load("@aspect_bazel_lib//lib:copy_to_bin.bzl", "copy_to_bin")

copy_to_bin(
    name = "in_bin",
    srcs = [ "chromedriver" ],
    visibility = [ "//visibility:public" ]
)
    """

    http_archive(
        name = "com_googleapis_storage_chromedriver_linux64",
        sha256 = "a7787ef8b139170cab4abfca4a0284fd5d006bfd979624b4af25b64d583a6f44",
        url = "https://chromedriver.storage.googleapis.com/114.0.5735.90/chromedriver_linux64.zip",
        build_file_content = chromedriver_buildfile,
    )

    http_archive(
        name = "com_googleapis_storage_chromedriver_mac64",
        sha256 = "6abdc9d358c2bc4668bef7b23048de2a9dbd3ad82cfbc6dfe322e74d4cff1650",
        url = "https://chromedriver.storage.googleapis.com/114.0.5735.90/chromedriver_mac64.zip",
        build_file_content = chromedriver_buildfile,
    )

    http_archive(
        name = "com_googleapis_storage_chromedriver_mac_arm64",
        sha256 = "14eb3a1642a829fcbc11ef22e113b2f6a2340c4f4e235e5494b414c4834fa47c",
        url = "https://chromedriver.storage.googleapis.com/114.0.5735.90/chromedriver_mac_arm64.zip",
        build_file_content = chromedriver_buildfile,
    )

    http_archive(
        name = "com_googleapis_storage_chromedriver_win32",
        sha256 = "14eb3a1642a829fcbc11ef22e113b2f6a2340c4f4e235e5494b414c4834fa47c",
        url = "https://chromedriver.storage.googleapis.com/114.0.5735.90/chromedriver_mac_arm64.zip",
        build_file_content = chromedriver_buildfile,
    )

    chromium_buildfile = """
load("@aspect_bazel_lib//lib:copy_to_bin.bzl", "copy_to_bin")
load("@bazel_skylib//rules:native_binary.bzl", "native_binary")

copy_to_bin(
    name = "in_bin",
    srcs = [ ":binary" ],
    visibility = [ "//visibility:public" ]
)

native_binary(
    name = "binary",
    src = "chrome-linux64/chrome",
    data = glob(["**/*"], ["chrome-linux64/chrome"]),
    out = "chromium"
)
    """

    http_archive(
        name = "com_googleapis_storage_chromium_linux_x64",
        sha256 = "cc8ae96ccba9010425abf2481ecdca343d53623151e0b4f2c180f58ec55b66a4",
        url = "https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/114.0.5735.90/linux64/chrome-linux64.zip",
        build_file_content = chromium_buildfile,
    )

    http_archive(
        name = "com_github_factoriolab",
        strip_prefix = "factoriolab-4ac80cb416e779819a73b871dd3e32ab7e0cda0c",
        url = "https://github.com/factoriolab/factoriolab/archive/4ac80cb416e779819a73b871dd3e32ab7e0cda0c.zip",
        build_file_content = """
exports_files(glob(["**/*"]))

            """,
    )
