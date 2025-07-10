"""Prettier formatting tests.

Add a target label to ``exempt_targets.bzl`` to skip Prettier for that rule.
"""

load("@aspect_rules_lint//format:defs.bzl", "format_test")
load("//ts/fmt:exempt_targets.bzl", "FMT_EXEMPT_LABELS")

def test_ts_fmt(name, srcs = [], tags = [], **kwargs):
    """Run Prettier unless exempted by tag or label."""

    label = "//%s:%s" % (native.package_name(), name)

    if label in FMT_EXEMPT_LABELS:
        return

    format_test(
        name = name,
        srcs = srcs,
        javascript = "//ts/fmt:prettier",
        tags = tags,
        disable_git_attribute_checks = True,
        **kwargs
    )
