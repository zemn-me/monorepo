"""
Linter configuration for aspect_rules_lint.
"""

load("@aspect_rules_lint//lint:eslint.bzl", "lint_eslint_aspect")
load("@aspect_rules_lint//lint:lint_test.bzl", "lint_test")
load("@aspect_rules_lint//lint:ruff.bzl", "lint_ruff_aspect")

eslint = lint_eslint_aspect(
    binary = "@@//bzl/lint:eslint",
    # We trust that eslint will locate the correct configuration file for a given source file.
    # See https://eslint.org/docs/latest/use/configure/configuration-files#cascading-and-hierarchy
    configs = [
        "@@//:eslintrc",
    ],
)

ruff = lint_ruff_aspect(
    binary = "@@//bin/host/ruff",
    configs = [
        "@@//:ruff.toml",
    ],
)

eslint_test = lint_test(aspect = eslint)
ruff_test = lint_test(aspect = ruff)
