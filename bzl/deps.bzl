# Install the nodejs "bootstrap" package
# This provides the basic tools for running and packaging nodejs programs in Bazel
load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive", "http_file")

def fetch_dependencies():
    http_archive(
        name = "io_bazel_rules_go",
        sha256 = "33acc4ae0f70502db4b893c9fc1dd7a9bf998c23e7ff2c4517741d4049a976f8",
        url = "https://github.com/bazelbuild/rules_go/releases/download/v0.48.0/rules_go-v0.48.0.zip",
    )

    http_archive(
        name = "io_bazel_rules_docker",
        sha256 = "b1e80761a8a8243d03ebca8845e9cc1ba6c82ce7c5179ce2b295cd36f7e394bf",
        strip_prefix = "rules_docker-0.25.0",
        urls = ["https://github.com/bazelbuild/rules_docker/releases/download/v0.25.0/rules_docker-v0.25.0.tar.gz"],
    )

    http_archive(
        name = "rules_proto",
        sha256 = "303e86e722a520f6f326a50b41cfc16b98fe6d1955ce46642a5b7a67c11c0f5d",
        strip_prefix = "rules_proto-6.0.0",
        url = "https://github.com/bazelbuild/rules_proto/archive/refs/tags/6.0.0.tar.gz",
    )

    http_archive(
        name = "com_google_protobuf",
        sha256 = "6fbe2e6f703bcd3a246529c2cab586ca12a98c4e641f5f71d51fde09eb48e9e7",
        strip_prefix = "protobuf-27.1",
        urls = [
            "https://github.com/protocolbuffers/protobuf/archive/v27.1.tar.gz",
        ],
    )

    http_archive(
        name = "bazel_gazelle",
        sha256 = "d76bf7a60fd8b050444090dfa2837a4eaf9829e1165618ee35dceca5cbdf58d5",
        urls = [
            "https://mirror.bazel.build/github.com/bazelbuild/bazel-gazelle/releases/download/v0.37.0/bazel-gazelle-v0.37.0.tar.gz",
            "https://github.com/bazelbuild/bazel-gazelle/releases/download/v0.37.0/bazel-gazelle-v0.37.0.tar.gz",
        ],
    )

    http_archive(
        name = "com_google_protobuf",
        sha256 = "6fbe2e6f703bcd3a246529c2cab586ca12a98c4e641f5f71d51fde09eb48e9e7",
        strip_prefix = "protobuf-27.1",
        urls = [
            "https://github.com/protocolbuffers/protobuf/archive/v27.1.tar.gz",
        ],
    )

    http_archive(
        name = "com_github_bazelbuild_buildtools",
        sha256 = "39c59cb5352892292cbe3174055aac187edcb5324c9b4e2d96cb6e40bd753877",
        strip_prefix = "buildtools-7.1.2",
        urls = [
            "https://github.com/bazelbuild/buildtools/archive/refs/tags/v7.1.2.tar.gz",
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
        sha256 = "78d3f3df10da77569942944c622eddf5fa34e12eba6791025eb83753d108630f",
        urls = [
            "https://github.com/pulumi/pulumi/releases/download/v3.119.0/pulumi-v3.119.0-linux-x64.tar.gz",
        ],
        build_file_content = """
exports_files(glob(["**/*"]))
""",
    )

    http_archive(
        name = "pulumi_cli_darwin_arm64",
        urls = [
            "https://github.com/pulumi/pulumi/releases/download/v3.119.0/pulumi-v3.119.0-darwin-arm64.tar.gz",
        ],
        sha256 = "456068b245b4677cce6c80965577d5fb9cdfdcb9eff5e39cb6e2dd45c313618d",
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
            "https://github.com/pulumi/pulumi/releases/download/v3.119.0/pulumi-v3.119.0-linux-arm64.tar.gz",
        ],
        sha256 = "85a9ba0dae67f4b68c52308a5e4673661ef1f1ce32573086752760a42e8e1f54",
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
        name = "rules_nodejs",
        sha256 = "dd04117521ba593f9c4fa45af782e18c85411ff4516bc561497682cd735b819d",
        strip_prefix = "rules_nodejs-6.1.3",
        url = "https://github.com/bazelbuild/rules_nodejs/releases/download/v6.1.3/rules_nodejs-v6.1.3.tar.gz",
    )

    # Got no idea why but MS doesn't publish versions of this...
    http_archive(
        name = "microsoft_json_schemas",
        url = "https://github.com/microsoft/json-schemas/archive/86dec4c116377a0c34bd9513c54ba54397dd282d.zip",
        strip_prefix = "json-schemas-86dec4c116377a0c34bd9513c54ba54397dd282d",
        build_file_content = """
exports_files(glob(["**/*"]))
        """,
        sha256 = "f259d289b01bf789e6fcdac1f3286b618c0d8f4370beb8333e3f7ad857b1a395",
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
        sha256 = "2cd9e57d4c38675d321731d65c15258f3a66438ad531ae09cb8bb14217dc8572",
        strip_prefix = "bazel_features-1.11.0",
        url = "https://github.com/bazel-contrib/bazel_features/releases/download/v1.11.0/bazel_features-v1.11.0.tar.gz",
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
