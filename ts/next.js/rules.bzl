load("@npm//:next/package_json.bzl", "bin")
load("//ts:rules.bzl", "ts_project")
load("//js:rules.bzl", "copy_to_bin")

def next_project(name, srcs, **kwargs):
    target = "node_modules/monorepo/" + native.package_name()

    native.filegroup(
        name = name + "_git_analysis_srcs",
        srcs = srcs,
    )

    # absolutely horrible engineering here. i'm so sorry.
    native.genrule(
        name = name + "_sed_command",
        outs = ["buildid.sed"],
        srcs = ["//VERSION"],
        cmd_bash = """
            echo "s|/\\*REPLACE\\*/ throw new Error() /\\*REPLACE\\*/|return \\"$$(cat $(location //VERSION))\\"|g" >$@
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

    # create a jsconfig allowing imports from root
    native.genrule(
        name = name + "_jsconfig",
        outs = ["jsconfig.json"],
        cmd_bash = """
            echo '{ "compilerOptions": { "baseUrl": \"""" + "/".join([".." for x in native.package_name().split("/")]) + """\" }}' > $@
        """,
    )

    ts_project(
        name = name + "_next_config",
        srcs = ["next.config.ts"],
    )

    srcs = srcs + [
        ":" + name + "_next_config",
        name + "_jsconfig",
        "//:node_modules/@types/react",
        "//:node_modules/@types/node",
        "//:node_modules/typescript",
        "//:node_modules/next",
        "//:node_modules/sharp",
    ]

    bin.next(
        name = "build",
        srcs = srcs,
        args = ["build", native.package_name(), "--no-lint"],
        output_dir = True,
    )

    bin.next_binary(
        name = "dev",
        data = srcs,
        args = ["dev", native.package_name()],
    )

    bin.next(
        name = "out",
        srcs = [":build"] + srcs,
        args = ["build", native.package_name()],
        output_dir = True,
        silent_on_success = True,
    )

    native.alias(
        name = name,
        actual = "out",
    )
