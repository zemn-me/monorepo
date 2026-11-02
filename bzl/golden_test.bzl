load("@aspect_bazel_lib//lib:diff_test.bzl", "diff_test")
load("//py/copy_to_workspace:copy_to_workspace.bzl", "copy_to_workspace")

def golden_test(
        name,
        src,
        golden,  # must be a file in this package.
        **kwargs):
    diff_test(
        name = name,
        file1 = src,
        file2 = golden,
        **kwargs
    )

    package = native.package_name()

    if package != "":
        package += "/"

    copy_to_workspace(
        name = name + ".fix",
        src = golden,
        dst = package + src,
    )
