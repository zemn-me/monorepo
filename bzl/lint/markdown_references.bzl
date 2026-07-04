"""A no-op rules_lint aspect for markdown reference filegroups."""

load("@aspect_rules_lint//lint/private:lint_aspect.bzl", "LintOptionsInfo", "noop_lint_action", "output_files", "should_visit")

_MNEMONIC = "AspectRulesLintMarkdownReferences"

def _markdown_references_aspect_impl(target, ctx):
    if not should_visit(ctx.rule, ctx.attr._rule_kinds):
        return []

    outputs, info = output_files(_MNEMONIC, target, ctx)
    noop_lint_action(ctx, outputs)
    return [info]

def lint_markdown_references_aspect(rule_kinds = ["filegroup"]):
    """Create a linter aspect whose analysis validates markdown file refs."""

    return aspect(
        implementation = _markdown_references_aspect_impl,
        attrs = {
            "_options": attr.label(
                default = "@aspect_rules_lint//lint:options",
                providers = [LintOptionsInfo],
            ),
            "_rule_kinds": attr.string_list(
                default = rule_kinds,
            ),
        },
    )
