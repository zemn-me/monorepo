# Install the nodejs "bootstrap" package
# This provides the basic tools for running and packaging nodejs programs in Bazel
load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

def fetch_dependencies():
    http_archive(
        name = "io_bazel_rules_docker",
        sha256 = "b1e80761a8a8243d03ebca8845e9cc1ba6c82ce7c5179ce2b295cd36f7e394bf",
        strip_prefix = "rules_docker-0.25.0",
        urls = ["https://github.com/bazelbuild/rules_docker/releases/download/v0.25.0/rules_docker-v0.25.0.tar.gz"],
    )

    http_archive(
        name = "rules_proto",
        sha256 = "14a225870ab4e91869652cfd69ef2028277fc1dc4910d65d353b62d6e0ae21f4",
        strip_prefix = "rules_proto-7.1.0",
        url = "https://github.com/bazelbuild/rules_proto/archive/refs/tags/7.1.0.tar.gz",
    )

    http_archive(
        name = "com_google_protobuf",
        sha256 = "63150aba23f7a90fd7d87bdf514e459dd5fe7023fdde01b56ac53335df64d4bd",
        strip_prefix = "protobuf-29.2",
        urls = [
            "https://github.com/protocolbuffers/protobuf/archive/v29.2.tar.gz",
        ],
    )

    http_archive(
        name = "com_google_protobuf",
        sha256 = "63150aba23f7a90fd7d87bdf514e459dd5fe7023fdde01b56ac53335df64d4bd",
        strip_prefix = "protobuf-29.2",
        urls = [
            "https://github.com/protocolbuffers/protobuf/archive/v29.2.tar.gz",
        ],
    )

    http_archive(
        name = "rules_rust",
        sha256 = "af4f56caae50a99a68bfce39b141b509dd68548c8204b98ab7a1cafc94d5bb02",
        urls = ["https://github.com/bazelbuild/rules_rust/releases/download/0.54.1/rules_rust-v0.54.1.tar.gz"],
    )
