"validate security.txt file"

load("@rules_python//python:defs.bzl", "py_test")

def test_sectxt(name, srcs = []):
    for src in srcs:
        py_test(
            name = name + "_" + src,
            srcs = ["//py/sectxt:__main__.py"],
            main = "//py/sectxt:__main__.py",
            data = [src],
            args = ["$(location " + src + ")"],
            deps = [
                "@pip//sectxt",
            ],
        )
    native.test_suite(
        name = name,
        tests = [
            name + "_" + src
            for src in srcs
        ],
    )
