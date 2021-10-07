load("//:rules.bzl", "ts_project")

def css_module(name = None, srcs = [], **kwargs):
    tsfilerulename = name + "_gen_ts"
    outputtsfiles = [ x + ".ts" for x in srcs ]
    native.genrule(
        name = tsfilerulename,
        outs = outputtsfiles,
        srcs = [ "//css:rule.ts" ],
        cmd = """
            cat $< | tee $@
        """,
        message = "Generating typescript declaration files for " +
            " ".join(srcs)
    )

    ts_project(
        name = name,
        srcs = outputtsfiles + srcs,
        ignores_lint = srcs
    )


