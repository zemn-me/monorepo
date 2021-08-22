load("//tools/jest:jest.bzl",  _jest_test = "jest_test")
load("@npm//@bazel/typescript:index.bzl", _ts_project = "ts_project")
load("@npm//prettier:index.bzl", "_prettier_test", "_prettier")

def jest_test(**kwargs):
    _jest_test(**kwargs)

def ts_project(name = None, deps = [], srcs = [], **kwargs):
    _ts_project(
	name = name,
        tsc = "@npm//ttypescript/bin:ttsc",
        deps = deps + ["@npm//typescript-transform-paths"],
        **kwargs,
    )

    prettier_test(
	    name = name + "_prettier",
	    srcs = srcs,
    )


def prettier(srcs = [], args = [], **kwargs):
	_prettier(
	    srcs = srcs + [ "//:.prettierrc.json", "//:.gitignore" ],
	    args = args + ["--config", "$(location //:.prettierrc.json)", "--ignore-path", "$(location //:.gitignore)"]
	)

def prettier_test(name = None, srcs = [], args = [], **kwargs):
    _prettier_test(
	    srcs = srcs + [ "//:.prettierrc.json", "//:.gitignore" ],
	    args = args + ["--config", "$(location //:.prettierrc.json)", "--ignore-path", "$(location //:.gitignore)"]
    )
