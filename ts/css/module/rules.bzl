
load("@npm//typed-css-modules:index.bzl", "tcm")

def ts_css_module(name, srcs, **kwargs):
    pattern = "$(rootpath " + srcs[0] + ")" if len(srcs) == 1 else "{" + ",".join([
                "$(rootpath " + src + ")"
                for src in srcs
            ]) + "}"
    args = [
            "-c", "-e",
            "-p", pattern,
            "."
        ]
    print(args)
    tcm(
        name = name,
        data = srcs,
        outs = [
            file + ".d.ts" for file in srcs
        ],
        link_workspace_root = True,
#        silent_on_success = True,
        args = args
    )
