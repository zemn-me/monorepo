load("//:rules.bzl", "ts_project")

package(default_visibility = ["//:__subpackages__"])

ts_project(
    name = "ts",
    srcs = glob(
        include = ["*.ts"],
        exclude = ["*_test.ts"],
    ),
    composite = True,
    declaration = True,
    incremental = True,
)
