"""Rules for markdown source files."""

load("//bzl/lint:linters.bzl", "markdown_references_test")

def _readme_impl(ctx):
    args = ctx.actions.args()
    args.add("--template", ctx.file.template)
    args.add("--output", ctx.outputs.out)
    args.add_all(ctx.files.examples, before_each = "--example")
    ctx.actions.run(
        executable = ctx.executable._renderer,
        arguments = [args],
        inputs = [ctx.file.template] + ctx.files.examples,
        outputs = [ctx.outputs.out],
        mnemonic = "RenderReadme",
        progress_message = "Rendering %{output}",
    )

_readme = rule(
    implementation = _readme_impl,
    attrs = {
        "examples": attr.label_list(allow_files = [".ts", ".tsx"]),
        "out": attr.output(mandatory = True),
        "template": attr.label(allow_single_file = [".template"], mandatory = True),
        "_renderer": attr.label(
            default = "//md:readme_main",
            executable = True,
            cfg = "exec",
        ),
    },
)

def readme(name, template, examples, out = "README.md", visibility = None):
    """Renders fenced code blocks carrying file= metadata from source files."""
    _readme(
        name = name,
        template = template,
        examples = examples,
        out = out,
        visibility = visibility,
    )

def md_files(name, srcs = None, refs = [], visibility = None, lint = True, **kwargs):
    if srcs == None:
        srcs = native.glob(["**/*.md"], allow_empty = True)

    native.filegroup(
        name = name,
        srcs = srcs + refs,
        visibility = visibility,
        **kwargs
    )

    if lint:
        markdown_references_test(
            name = name + "_markdown_references_lint",
            srcs = [name],
        )
