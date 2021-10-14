load("//:rules.bzl", "jest_test", "ts_project")

package(default_visibility = ["//:__subpackages__"])

tstestfiles = glob(["*_test.ts"])

ts_project(
    name = "iter",
    srcs = glob(
        include = ["*.ts"],
        exclude = ["*_test.ts"],
    ),
    composite = True,
    declaration = True,
    incremental = True,
)

ts_project(
    name = "tests_lib",
    srcs = tstestfiles,
    composite = True,
    declaration = True,
    incremental = True,
    project_deps = [":iter"],
    tsconfig = "//:tsconfig_node",
    deps = [
        "@npm//@types/jest",
    ],
)

jest_test(
    name = "test",
    srcs = [f[:-len(".ts")] + ".js" for f in tstestfiles],
    deps = [
        ":iter_js",
    ],
)
