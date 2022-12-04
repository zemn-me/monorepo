load("@npm//next:index.bzl", "next")
load("//git:rules.bzl",  "commit_affecting_rule")
load("//ts:rules.bzl", "ts_project")

def next_project(name, srcs, **kwargs):
    distDir = "build"
    target = "node_modules/monorepo/" + native.package_name()

    native.filegroup(
        name = name + "_git_analysis_srcs",
        srcs = srcs
    )

    commit_affecting_rule(
        name = name + "_latest_commit",
        rule = ":" + name + "_git_analysis_srcs"
    )

    # absolutely horrible engineering here. i'm so sorry.
    native.genrule(
        name = name + "_sed_command",
        outs = [ "buildid.sed" ],
        srcs = [ name + "_latest_commit" ],
        cmd_bash = """
            echo "s|/\\*REPLACE\\*/ throw new Error() /\\*REPLACE\\*/|return \\"$$(cat $(location """
                + name +
            """_latest_commit))\\"|g" >$@
        """,
    )

    # copy the next config over
    native.genrule(
        name = name + "_gen_next.config.ts",
        srcs = ["//ts/next.js:next.config.ts", "buildid.sed"],
        outs = ["next.config.ts"],
        cmd_bash = """
            sed -f $(location buildid.sed) $(location //ts/next.js:next.config.ts) >$@
        """,
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
