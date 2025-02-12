load("//bzl:golden_test.bzl", "golden_test")


def go_version_sync(name):
    native.genrule(
        name = name + "_gen_goldens",
        tools = [
            "//go/cmd/version_sync"
        ],
        cmd_bash = """
$(execpath //go/cmd/version_sync) \\
    -go-mod $(rootpath go.mod) \\
    -module-bazel $(rootpath MODULE.bazel) \\
    -output-go-mod $(location go.mod.golden) \\
    -output-module-bazel $(location MODULE.bazel.golden) \\
    -fix
        """,
        srcs = [
            "MODULE.bazel",
            "go.mod"
        ],
        outs = ["go.mod.golden", "MODULE.bazel.golden"],
    )

    golden_test(
        name = name + "_go_mod_test",
        src = "go.mod",
        golden = "go.mod.golden"
    )

    golden_test(
        name = name + "_bazel_mod_test",
        src = "MODULE.bazel",
        golden = "MODULE.bazel.golden"
    )

    native.test_suite(
        name = name,
        tests = [
            name + "_go_mod_test",
            name + "_bazel_mod_test"
        ]
    )
