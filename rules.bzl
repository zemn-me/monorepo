load("//tools/jest:jest.bzl",  _jest_test = "jest_test")
load("@npm//@bazel/typescript:index.bzl", _ts_project = "ts_project")
load("@npm//prettier:index.bzl", _prettier_test = "prettier_test", _prettier = "prettier")

def jest_test(**kwargs):
    _jest_test(**kwargs)

def ts_project(name, tags = [], deps = [], srcs = [], **kwargs):
    _ts_project(
        name = name,
        tsc = "@npm//ttypescript/bin:ttsc",
	srcs = srcs,
        deps = deps + ["@npm//typescript-transform-paths"],
        tags = tags,
        **kwargs,
    )

    prettier_test(
            name = name + "_prettier",
            data = srcs,
            tags = tags + ["+formatting"],
            args = ["$(location %s)" % x for x in srcs]
    )


"""
def prettier(data = [], args = [], **kwargs):
        _prettier(
            data = data + [ "//:.prettierrc.json", "//:.gitignore" ],
            args = args + ["--config", "$(location //:.prettierrc.json)", "--ignore-path", "$(location //:.gitignore)", "--write", "-l"]
        )
"""

def prettier_test(name = None, data = [], args = [], **kwargs):
    _prettier_test(
            name = name,
            data = data + [ "//:.prettierrc.json", "//:.gitignore", "//:.editorconfig" ],
            args = args + ["--config", "$(location //:.prettierrc.json)", "--ignore-path", "$(location //:.gitignore)", "--check"]
    )
