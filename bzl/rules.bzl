load("@com_github_bazelbuild_buildtools//buildifier:buildifier.bzl", "buildifier_test")

def bazel_lint(name = None, srcs = None, **kwargs):
    if srcs == None:
        srcs = native.glob(["**/*.bzl", "**/*.bazel", "**/WORKSPACE"])
    buildifier_test(
        name = name,
        srcs = srcs,
        **kwargs
    )
