"""Allow pip-compile's networked validation to run on its target platform."""

load("@rules_python//python:py_test.bzl", "py_test")

def pip_requirements_test(name, tags = [], **kwargs):
    """A compile_pip_requirements test factory with explicit RBE networking."""
    py_test(
        name = name,
        # This check already needs the network to validate the pinned lockfile.
        # Running it on RBE also keeps platform-specific dependencies consistent.
        tags = [tag for tag in tags if tag != "no-remote-exec"],
        exec_properties = {"test.network": "external"},
        **kwargs
    )
