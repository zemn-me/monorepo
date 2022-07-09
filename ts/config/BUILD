load("//ts:rules.bzl", "jest_test")

package(default_visibility = ["//visibility:public"])

load("//:rules.bzl", "ts_config")

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
