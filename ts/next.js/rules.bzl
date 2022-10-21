load("@npm//next:index.bzl", "next")
load("//ts:rules.bzl", "ts_project")
load("@build_bazel_rules_nodejs//:providers.bzl", "DeclarationInfo", "JSEcmaScriptModuleInfo")

def _with_runfiles_impl(ctx):
    deps = []

    for src in ctx.attr.srcs:
        if DefaultInfo in src:
            deps += [ src[DefaultInfo].files ]
            if src[DefaultInfo].default_runfiles != None:
                deps += [ src[DefaultInfo].default_runfiles.files ]
        
        if DeclarationInfo in src:
            deps += [ src[DeclarationInfo].transitive_declarations ]

        if JSEcmaScriptModuleInfo in src:
            deps += [ src[JSEcmaScriptModuleInfo].sources ]

    return DefaultInfo(
        files = depset(transitive=deps)
    )


_with_runfiles = rule(
    implementation = _with_runfiles_impl,
    attrs = {
        "srcs": attr.label_list(mandatory = True, doc = "The rule to merge runfiles and compile-time files for.", providers = [
            DefaultInfo
        ])
    }
)


def next_project(name, srcs, **kwargs):
    distDir = "build"
    target = "node_modules/monorepo/" + native.package_name()
    #target = "bazel-out/k8-fastbuild/bin/" + native.package_name()

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

    next_sources_name = name + "_collated_sources"
    # This should not need a copy_to_bin rule, as the sources themselves should provide one.
    # If they don't, they won't work outside of this rule, which isn't a good look.
    _with_runfiles(
        name = next_sources_name,
        srcs = srcs
    )

    next(
        name = name + ".dev",
        data = [ next_sources_name ],
        link_workspace_root = True,
        args = ["dev", target],
    )

    next(
        name = distDir,
        data = [ next_sources_name ],
        link_workspace_root = True,
        args = ["build", target],
        output_dir = True,
        silent_on_success = True,
    )

    next(
        name = "out",
        data = [":build", next_sources_name ],
        args = ["export", target],
        link_workspace_root = True,
        output_dir = True,
        silent_on_success = True,
    )

    native.alias(
        name = name,
        actual = "out",
    )
