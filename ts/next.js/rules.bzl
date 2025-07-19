load("@npm//:next/package_json.bzl", "bin")
load("//ts:rules.bzl", "ts_project")

def _next_js_project(name):
    # create a jsconfig allowing imports from root
    native.genrule(
        name = name,
        outs = ["jsconfig.json"],
        cmd_bash = """
            echo '{ "compilerOptions": { "baseUrl": \"""" + "/".join([".." for x in native.package_name().split("/")]) + """\" }}' > $@
        """,
    )

def _next_next_config(name):
    native.genrule(
        name = name + "_gen_next.config.ts",
        srcs = ["//ts/next.js:next.config.ts"],
        outs = ["next.config.ts"],
        cmd_bash = """
            cp $(location //ts/next.js:next.config.ts) $@
        """,
    )

    ts_project(
        name = name,
        srcs = [
            "next.config.ts",
        ],
        deps = [
            "//:node_modules/source-map-loader",
        ],
    )

def _next_srcset(
        name,
        jsproject_json = None,
        next_config = None,
        srcs = []):
    return srcs + [
        jsproject_json,
        next_config,
        "//:node_modules/@types/react",
        "//:node_modules/@types/node",
        "//:node_modules/typescript",
        "//:node_modules/next",
        "//:node_modules/sharp",
        "//:package_json",
    ]

def next_project(name, srcs, **kwargs):
    native.filegroup(
        name = name + "_git_analysis_srcs",
        srcs = srcs,
    )

    _next_js_project(
        name + "_jsconfig",
    )

    _next_next_config(
        name = name + "_next_config",
    )

    srcs = _next_srcset(
        name,
        jsproject_json = ":" + name + "_jsconfig",
        next_config = ":" + name + "_next_config",
        srcs = srcs,
    )

    bin.next(
        name = "build",
        srcs = srcs,
        args = ["build", native.package_name(), "--no-lint"],
        out_dirs = ["build"],
    )

    bin.next_binary(
        name = "dev",
        data = srcs,
        args = ["dev", native.package_name()],
    )

    bin.next_binary(
        name = "start",
        data = [":build"] + srcs,
        args = ["start", native.package_name()],
    )

    bin.next(
        out_dirs = ["out"],
        name = "out",
        srcs = [":build"] + srcs,
        args = ["build", native.package_name()],
        silent_on_success = True,
    )

    native.alias(
        name = name,
        actual = "out",
    )
