package(default_visibility=["//ext/public/rust/cargo:__subpackages__"])

licenses([
    "notice",  # "MIT,Apache-2.0"
])

load(
    "@io_bazel_rules_rust//rust:rust.bzl",
    "rust_library",
    "rust_binary",
)

genrule(
    name="touch_config_header",
    outs=[
        "config.h",
    ],
    cmd="touch $@",
)

genrule(
    name="touch_backtrace_supported_header",
    outs=[
        "backtrace-supported.h",
    ],
    cmd="touch $@",
)

cc_library(
    name="backtrace_native",
    srcs=[
        ":touch_config_header",
        ":touch_backtrace_supported_header",
        "src/libbacktrace/internal.h",
        "src/libbacktrace/backtrace.h",
        "src/libbacktrace/alloc.c",
        "src/libbacktrace/dwarf.c",
        "src/libbacktrace/fileline.c",
        "src/libbacktrace/posix.c",
        "src/libbacktrace/read.c",
        "src/libbacktrace/sort.c",
        "src/libbacktrace/state.c",
        "src/libbacktrace/elf.c",
    ],
    includes=["."],
    copts=[
        "-fvisibility=hidden",
        "-fPIC",
    ],
    defines=[
        "BACKTRACE_ELF_SIZE=64",
        "BACKTRACE_SUPPORTED=1",
        "BACKTRACE_USES_MALLOC=1",
        "BACKTRACE_SUPPORTS_THREADS=0",
        "BACKTRACE_SUPPORTS_DATA=0",
        "_GNU_SOURCE=1",
        "_LARGE_FILES=1",
    ],
)

rust_library(
    name="backtrace_sys",
    crate_root="src/lib.rs",
    crate_type="lib",
    srcs=glob(["**/*.rs"]),
    deps=[
        "@raze__libc__0_2_58//:libc",
        ":backtrace_native",
    ],
    visibility = ["//visibility:public"],
)

