"""
Linter configuration for aspect_rules_lint.
"""

load("@aspect_rules_lint//lint:lint_test.bzl", "lint_test")
load("@aspect_rules_lint//lint:ruff.bzl", "lint_ruff_aspect")
load("//bzl/lint:biome.bzl", "lint_biome_aspect")
load("//bzl/lint:markdown_references.bzl", "lint_markdown_references_aspect")

biome = lint_biome_aspect(
    binary = "@@//bzl/lint:biome",
    config = "@@//:biome.json",
    extra_configs = [
        "@@//:.gitignore",
    ],
)

markdown_references = lint_markdown_references_aspect()

ruff = lint_ruff_aspect(
    binary = "@@//bin/host/ruff",
    configs = [
        "@@//:ruff.toml",
    ],
)

biome_test = lint_test(aspect = biome)
markdown_references_test = lint_test(aspect = markdown_references)
ruff_test = lint_test(aspect = ruff)
