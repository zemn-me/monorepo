load("//ts:rules.bzl", "eslint_test", "jest_test", "ts_lint", "ts_project")

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
