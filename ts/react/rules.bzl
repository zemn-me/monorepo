load("//ts:rules.bzl", "ts_project", "ts_test")

ambient_deps = [
    "@npm//react",
    "@npm//react-dom",
    "@npm//@types/react",
    "@npm//@types/react-dom",
]

def react_project(name, deps = [], **kwargs):
    ts_project(
        name = name,
        deps = deps + ambient_deps,
        **kwargs
    )

def react_test(name, **kwargs):
    ts_test(
        name = name,
        **kwargs
    )
