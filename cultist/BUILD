load("//:rules.bzl", "ts_project")

package(default_visibility = [ "//visibility:public" ])

ts_project(
    name = "cultist",
    srcs = glob(["*.ts"]),
    declaration = True,
    source_map = True,
    tsconfig = "//:tsconfig"
)