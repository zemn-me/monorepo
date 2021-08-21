load("//tools/jest:jest.bzl",  _jest_test = "jest_test")
load("@npm//@bazel/typescript:index.bzl", _ts_project = "ts_project")

def jest_test(**kwargs):
    _jest_test(**kwargs)

def ts_project(deps = [], **kwargs):
    _ts_project(
        tsc = "@npm//ttypescript/bin:ttsc",
        deps = deps + ["@npm//typescript-transform-paths"],
        **kwargs,
    )
