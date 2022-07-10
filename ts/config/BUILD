load("//:rules.bzl", "ts_config")

package(default_visibility = ["//visibility:public"])

ts_config(
    name = "node",
    src = "node.tsconfig.json",
    deps = ["//:tsconfig"],
)

ts_config(
    name = "jsx",
    src = "jsx.tsconfig.json",
    deps = ["//:tsconfig"],
)
