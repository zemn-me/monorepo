#!/usr/bin/env python3
"""Launch Next.js dev server and Go backend together."""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from typing import List

from python.runfiles import runfiles


def launch(cmd: List[str], *, env: dict[str, str]) -> subprocess.Popen:
    """Start a subprocess in its own process group and stream its output."""
    return subprocess.Popen(
        cmd,
        env=env,
        stdout=sys.stdout,
        stderr=sys.stderr,
        text=True,
        start_new_session=True,  # gives each child its own PGID
    )


def main() -> int:
    r = runfiles.Create()
    if r is None:
        raise RuntimeError("unable to create runfiles")

    next_rlocation = os.environ.get("NEXTSERVER")
    api_backend_rlocation = os.environ.get("APIBACKEND")
    wd = os.environ.get("BUILD_WORKSPACE_DIRECTORY")
    bazel_bindir = os.environ.get("BAZEL_BINDIR")

    for var, name in [
        (next_rlocation, "NEXTSERVER"),
        (api_backend_rlocation, "APIBACKEND"),
        (wd, "BUILD_WORKSPACE_DIRECTORY"),
        (bazel_bindir, "BAZEL_BINDIR"),
    ]:
        if var is None:
            raise RuntimeError(f"{name} environment variable not set")

    next_dev = r.Rlocation(next_rlocation)
    server_bin = r.Rlocation(api_backend_rlocation)

    if next_dev is None or server_bin is None:
        raise RuntimeError("unable to resolve runfiles locations")

    env = {**os.environ, **r.EnvVars(), "BAZEL_BINDIR": bazel_bindir}

    go_proc = launch([server_bin], env=env)
    next_proc = launch([next_dev, "project/zemn.me"], env=env)

    procs = [go_proc, next_proc]

    def shutdown(signum, frame):
        for p in procs:
            try:
                # terminate the entire process group
                os.killpg(p.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    exit_code = 0
    while procs:
        for p in procs[:]:
            ret = p.poll()
            if ret is not None:
                procs.remove(p)
                exit_code = ret if ret and exit_code == 0 else exit_code
        time.sleep(0.1)

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
