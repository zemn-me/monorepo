load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

def remote_deps():
    http_archive(
        name = "bzip2",
        url = "https://crates-io.s3-us-west-1.amazonaws.com/crates/bzip2/bzip2-0.3.3.crate",
        sha256 = "42b7c3cbf0fa9c1b82308d57191728ca0256cb821220f4e2fd410a72ade26e3b",
        type = "tar.gz",
        strip_prefix = "bzip2-0.3.3",
        build_file = "@examples//hello_sys:bzip2-0.3.3.BUILD",
    )

    http_archive(
        name = "bzip2_sys",
        url = "https://crates-io.s3-us-west-1.amazonaws.com/crates/bzip2-sys/bzip2-sys-0.1.9+1.0.8.crate",
        sha256 = "ad3b39a260062fca31f7b0b12f207e8f2590a67d32ec7d59c20484b07ea7285e",
        type = "tar.gz",
        strip_prefix = "bzip2-sys-0.1.9+1.0.8",
        build_file = "@examples//hello_sys:bzip2-sys-0.1.9+1.0.8.BUILD",
    )

    http_archive(
        name = "cc",
        url = "https://crates-io.s3-us-west-1.amazonaws.com/crates/cc/cc-1.0.54.crate",
        sha256 = "7bbb73db36c1246e9034e307d0fba23f9a2e251faa47ade70c1bd252220c8311",
        type = "tar.gz",
        strip_prefix = "cc-1.0.54",
        build_file = "@examples//hello_sys:cc-1.0.54.BUILD",
    )

    http_archive(
        name = "pkg_config",
        url = "https://crates-io.s3-us-west-1.amazonaws.com/crates/pkg-config/pkg-config-0.3.17.crate",
        sha256 = "05da548ad6865900e60eaba7f589cc0783590a92e940c26953ff81ddbab2d677",
        type = "tar.gz",
        strip_prefix = "pkg-config-0.3.17",
        build_file = "@examples//hello_sys:pkg-config-0.3.17.BUILD",
    )
