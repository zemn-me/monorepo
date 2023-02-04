load("@npm//:next/package_json.bzl", "bin")
load("//git:rules.bzl", "commit_affecting_rule")
load("//ts:rules.bzl", "ts_project")

def next_project(name, srcs, **kwargs):
    distDir = "build"
    target = "node_modules/monorepo/" + native.package_name()

    native.filegroup(
        name = name + "_git_analysis_srcs",
        srcs = srcs,
    )

    commit_affecting_rule(
        name = name + "_latest_commit",
        rule = ":" + name + "_git_analysis_srcs",
    )

    # absolutely horrible engineering here. i'm so sorry.
    native.genrule(
        name = name + "_sed_command",
        outs = ["buildid.sed"],
        srcs = [name + "_latest_commit"],
        cmd_bash = """
            echo "s|/\\*REPLACE\\*/ throw new Error() /\\*REPLACE\\*/|return \\"$$(cat $(location """ +
                   name +
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

    bin.next(
        name = name + ".dev",
        srcs = srcs,
        args = ["dev", target],
    )

    bin.next(
        name = distDir,
        srcs = srcs,
        args = ["build", target],
        output_dir = True,
        silent_on_success = True,
    )

    bin.next(
        name = "out",
        srcs = [":build"] + srcs,
        args = ["export", target],
        output_dir = True,
        silent_on_success = True,
    )

    native.alias(
        name = name,
        actual = "out",
    )
