load(
    "//rust:rust.bzl",
    "rust_binary",
    "rust_clippy",
    "rust_library",
    "rust_test",
)

# Declaration of passing targets.

rust_binary(
    name = "ok_binary",
    srcs = ["src/main.rs"],
    edition = "2018",
)

rust_library(
    name = "ok_library",
    srcs = ["src/lib.rs"],
    edition = "2018",
)

rust_test(
    name = "ok_test",
    srcs = ["src/lib.rs"],
    edition = "2018",
)

# Clippy analysis of passing targets.

rust_clippy(
    name = "ok_binary_clippy",
    deps = [":ok_binary"],
)

rust_clippy(
    name = "ok_library_clippy",
    deps = [":ok_library"],
)

rust_clippy(
    name = "ok_test_clippy",
    deps = [":ok_test"],
    testonly = True,
)

# Declaration of failing targets.

rust_binary(
    name = "bad_binary",
    srcs = ["bad_src/main.rs"],
    edition = "2018",
)

rust_library(
    name = "bad_library",
    srcs = ["bad_src/lib.rs"],
    edition = "2018",
)

rust_test(
    name = "bad_test",
    srcs = ["bad_src/lib.rs"],
    edition = "2018",
)

# Clippy analysis of failing targets.

rust_clippy(
    name = "bad_binary_clippy",
    deps = [":bad_binary"],
    tags = [ "manual" ],
)

rust_clippy(
    name = "bad_library_clippy",
    deps = [":bad_library"],
    tags = [ "manual" ],
)

rust_clippy(
    name = "bad_test_clippy",
    deps = [":bad_test"],
    tags = [ "manual" ],
    testonly = True,
)
