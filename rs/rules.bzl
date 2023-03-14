load("@rules_rust//rust:defs.bzl", "rust_clippy", "rustfmt_test", _rust_binary = "rust_binary", _rust_doc = "rust_doc", _rust_library = "rust_library", _cargo_bootstrap_repository = "cargo_bootstrap_repository", _cargo_build_script = "cargo_build_script")

def _rust_source_tests(name, **kwargs):
    rustfmt_test(
        name = name + "_fmt",
        targets = [name],
        **kwargs
    )

    rust_clippy(
        name = name + "_lint",
        testonly = True,
        deps = [name],
        **kwargs
    )

def rust_binary(name, **kwargs):
    _rust_binary(name = name, **kwargs)
    _rust_source_tests(name, **kwargs)

def rust_doc(name, **kwargs):
    _rust_doc(name = name, **kwargs)

def rust_library(name, **kwargs):
    _rust_library(name = name, **kwargs)
    _rust_source_tests(name, **kwargs)

def cargo_bootstrap_repository(name, **kwargs):
    _cargo_bootstrap_repository(name, **kwargs)

def cargo_build_script(name, **kwargs):
    _cargo_build_script(name, **kwargs)