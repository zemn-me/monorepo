load("@rules_rust//rust:defs.bzl", "rust_clippy", _rust_binary = "rust_binary", _rust_doc = "rust_doc", "rustfmt_test")

def rust_binary(name, **kwargs):
    _rust_binary(name = name, **kwargs)
    rustfmt_test(
        name = name + "_fmt",
        targets = [ name ]
    )
    
    rust_clippy(
        name = name + "_lint",
        testonly = True,
        deps = [ name ]
    )

def rust_doc(name, **kwargs):
    _rust_doc(name = name, **kwargs)