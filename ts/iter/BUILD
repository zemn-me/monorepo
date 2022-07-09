load("//ts:rules.bzl", "ts_project")
load("//:rules.bzl", "jest_test")

package(default_visibility = ["//:__subpackages__"])

tstestfiles = glob(["*_test.ts"])

ts_project(
    name = "iter",
    srcs = glob(
        include = ["*.ts"],
        exclude = ["*_test.ts"],
    ),
    composite = True,
    incremental = True,
)

ts_project(
    name = "tests_lib",
    srcs = tstestfiles,
    composite = True,
    incremental = True,
    tsconfig = "//:tsconfig_node",
    deps = [
        ":iter",
        "@npm//@types/jest",
    ],
)

jest_test(
    name = "test",
    srcs = [f[:-len(".ts")] + ".js" for f in tstestfiles],
    deps = [
        ":iter",
    ],
)
