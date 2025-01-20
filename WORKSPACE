# Bazel workspace created by @bazel/create 3.7.0

# Needed by Protobuf
bind(
    name = "python_headers",
    actual = "@com_google_protobuf//:protobuf_headers",
)

# Declares that this directory is the root of a Bazel workspace.
# See https://docs.bazel.build/versions/master/build-ref.html#workspace
workspace(
    # How this workspace would be referenced with absolute labels from another workspace
    name = "monorepo",
)

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

http_archive(
    name = "rules_proto",
    sha256 = "14a225870ab4e91869652cfd69ef2028277fc1dc4910d65d353b62d6e0ae21f4",
    strip_prefix = "rules_proto-7.1.0",
    url = "https://github.com/bazelbuild/rules_proto/archive/refs/tags/7.1.0.tar.gz",
)

# ruff is a special snowflake because it's a pip package that
# is actually a rust binary, and the rust binary is not on
# cargo for some reason.
load("@aspect_rules_lint//lint:ruff.bzl", "fetch_ruff")

fetch_ruff(
    "v0.4.10",
)
