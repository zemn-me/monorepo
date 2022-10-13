load("@npm//next:index.bzl", "next")
load("//ts:rules.bzl", "ts_project")

def _get_files_for_next_impl(ctx):
    return [
        DefaultInfo(
            files = [
                src[DefaultInfo]
            ]
        )
    ]

_get_files_for_next_rule = rule(
    implementation = _get_files_for_next_impl,
    attrs = {
        "srcs": attr.label(mandatory = True),
    }
)


def next_project(name, srcs, **kwargs):
    distDir = "build"
    target = "node_modules/monorepo/" + native.package_name()

    # copy the next config over
    native.genrule(
        name = name + "_gen_next.config.ts",
        srcs = ["//ts/next.js:next.config.ts"],
        outs = ["next.config.ts"],
        cmd_bash = "cp $< $@",
    )

    ts_project(
        name = name + "_next_config",
        srcs = ["next.config.ts"],
    )

    srcs = srcs + [":" + name + "_next_config"]

    next(
        name = name + ".dev",
        data = srcs,
        link_workspace_root = True,
        args = ["dev", target],
    )

    next(
        name = distDir,
        data = srcs,
        link_workspace_root = True,
        args = ["build", target],
        output_dir = True,
        silent_on_success = True,
    )

    next(
        name = "out",
        data = [":build"] + srcs,
        args = ["export", target],
        link_workspace_root = True,
        output_dir = True,
        silent_on_success = True,
    )

    native.alias(
        name = name,
        actual = "out",
    )
