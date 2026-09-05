"""Serve the exported production build for browser regression tests."""

import functools
import http.server
import os
import sys

from python.runfiles import runfiles


def main() -> None:
    resolver = runfiles.Create()
    if resolver is None:
        raise RuntimeError("Bazel runfiles are unavailable")
    directory = resolver.Rlocation(os.environ["PARK_BUILD_DIR"])
    if directory is None:
        raise RuntimeError("The exported park build was not found")
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=directory)
    with http.server.ThreadingHTTPServer(
        ("127.0.0.1", int(sys.argv[1])), handler
    ) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()
