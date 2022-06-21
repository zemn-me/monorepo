load("@npm//stylelint:index.bzl", "stylelint_test")
load("//css/lint:providers.bzl", "css_library_info", "CSSLibraryInfo")

def css_lint(name = None, srcs = [], **kwargs):
    stylelint_test(
        name = name,
        data = [ "//css/lint:stylelint_config" ] + srcs,
        templated_args = [
            "--config", "$(rlocation //css/lint:stylelint-config.json)"
        ] + [
            # todo: a rule to collect these?
            "$(rlocation //" + native.package_name() + ":" + x + ")" for x in srcs
        ]
    )

def _css_library_impl(ctx):
    css_info = css_library_info(
            srcs = ctx.files.srcs,
            deps = ctx.attr.deps
    )
        
    return [
        css_info

        DefaultInfo(
            files = css_info.deps
        )
    ]

css_library = rule(
    implementation = _css_library_impl,
    attrs = {
        "srcs": attr.label_list(allow_files = True, doc = "A set of CSS files to group in a library."),
        "deps": attr.label_list(allow_files = False, providers = [ CSSLibraryInfo ], doc = "A set of CSS libraries this group depends on.")
    }
)

