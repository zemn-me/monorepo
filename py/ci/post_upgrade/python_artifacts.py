"""Refresh Python artifacts through their owning Bazel rules."""

from collections.abc import Callable


def refresh(bazel: Callable, bazel_run: Callable) -> None:
    """Resolve every lock before regenerating manifests which depend on it.

    Native Renovate pip-compile output uses the container's interpreter and
    working directory. The Bazel rules own both those choices and the command
    header checked by presubmit. Discover rules instead of listing packages so
    additional isolated environments participate automatically.
    """
    for generator in ("pip_compile", "gazelle_python_manifest"):
        query = (
            'filter("\\.update$", '
            f'attr(generator_function, "^{generator}$", //...))'
        )
        targets = bazel(["query", query], capture_output=True, text=True).stdout.splitlines()
        for target in sorted(targets):
            # Use the updater itself: a nested .fix alias can copy read-only
            # outputs, and the generic fixer can swallow failed pipelines.
            bazel_run([target])
