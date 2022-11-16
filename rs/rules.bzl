load("@rules_rust//rust:defs.bzl", _rust_binary = "rust_binary", _rust_doc = "rust_doc")

def rust_binary(name, **kwargs):
    _rust_binary(name = name, **kwargs)

def rust_doc(name, **kwargs):
    _rust_doc(name = name, **kwargs)