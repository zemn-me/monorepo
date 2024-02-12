load("@com_github_bazelbuild_buildtools//buildifier:buildifier.bzl", "buildifier_test")

def bazel_lint(name = None, **kwargs):
    buildifier_test(
        name = name,
        srcs = native.glob(["**/*.bzl", "**/*.bazel", "**/WORKSPACE"]),
        **kwargs
    )
