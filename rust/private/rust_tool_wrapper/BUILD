config_setting(
    name = "windows",
    constraint_values = [
        "@platforms//os:windows",
    ],
)

config_setting(
    name = "linux",
    constraint_values = [
        "@platforms//os:linux",
    ],
)

config_setting(
    name = "macos",
    constraint_values = [
        "@platforms//os:macos",
    ],
)

config_setting(
    name = "freebsd",
    constraint_values = [
        "@platforms//os:freebsd",
    ],
)

config_setting(
    name = "openbsd",
    constraint_values = [
        "@platforms//os:openbsd",
    ],
)

POSIX_SRCS = [
    "system_posix.cc",
]

cc_binary(
    name = "rust_tool_wrapper",
    srcs = [
        "rust_tool_wrapper.cc",
        "system.h",
        "system.cc",
    ] + select({
        ":windows": [
            "system_windows.cc",
        ],
        ":linux": POSIX_SRCS,
        ":macos": POSIX_SRCS,
        ":freebsd": POSIX_SRCS,
        ":openbsd": POSIX_SRCS,
    }),
    defines = [] + select({
        ":windows": [
            "UNICODE",
            "_UNICODE",
        ],
        "//conditions:default": [],
    }),
    visibility = ["//visibility:public"],
)
