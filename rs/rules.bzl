load("@rules_rust//rust:defs.bzl", "rust_clippy", "rustfmt_test", _rust_binary = "rust_binary", _rust_doc = "rust_doc", _rust_library = "rust_library", _rust_test = "rust_test")

def _rust_source_tests(name, **kwargs):
    rustfmt_test(
        name = name + "_fmt",
        targets = [name],
    )

    rust_clippy(
        name = name + "_lint",
        testonly = True,
        deps = [name],
    )

def rust_binary(name, **kwargs):
    _rust_binary(name = name, **kwargs)
    _rust_source_tests(name, **kwargs)

def rust_doc(name, **kwargs):
    _rust_doc(name = name, **kwargs)

def rust_library(name, **kwargs):
    _rust_library(name = name, **kwargs)
    _rust_source_tests(name, **kwargs)

def rust_test(name, **kwargs):
    _rust_test(name = name, **kwargs)
