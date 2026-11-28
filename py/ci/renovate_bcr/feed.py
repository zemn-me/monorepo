"""Serve BCR module publication dates to Renovate's JSON custom datasource."""

import gzip
import json
import os
import subprocess
import sys
import zlib
from functools import partial
from http.client import HTTPException
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from urllib.request import urlopen

from google.protobuf.message import DecodeError

from py.ci.renovate_bcr.registry_pb2 import Registry


def write_feeds(index, directory):
    for module in index.modules:
        # A module's name becomes a single URL path component and filename.
        if not module.name or not module.name.isascii() or not all(
            ch.isalnum() or ch in "._-" for ch in module.name
        ):
            continue
        dates = {v.version: v.commit.date for v in module.versions if v.commit.date}
        releases = []
        for version in module.metadata.versions:
            release = {"version": version}
            if date := dates.get(version):
                release["releaseTimestamp"] = date
            if version in module.metadata.yanked_versions:
                release["isDeprecated"] = True
            releases.append(release)
        feed = {"releases": releases, "homepage": module.metadata.homepage}
        (directory / f"{module.name}.json").write_text(json.dumps(feed))


def main():
    with TemporaryDirectory() as work:
        directory = Path(work)
        try:
            with urlopen("https://registry.bazel.build/registry.pb.gz", timeout=30) as response:
                with gzip.GzipFile(fileobj=response) as data:
                    index = Registry.FromString(data.read())
        except (OSError, EOFError, HTTPException, zlib.error, DecodeError) as error:
            # Keep unrelated managers running when the registry is unavailable.
            print(f"BCR index unavailable, skipping public Bazel modules: {error}", file=sys.stderr)
        else:
            write_feeds(index, directory)
        handler = partial(SimpleHTTPRequestHandler, directory=work)
        with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
            Thread(target=server.serve_forever, daemon=True).start()
            url = f"http://127.0.0.1:{server.server_port}/" + "{{packageName}}.json"
            sources = json.loads(os.environ.get("RENOVATE_CUSTOM_DATASOURCES", "{}"))
            sources["bcr"] = {"defaultRegistryUrlTemplate": url}
            return subprocess.call(
                ["renovate", *sys.argv[1:]],
                env={**os.environ, "RENOVATE_CUSTOM_DATASOURCES": json.dumps(sources)},
            )


if __name__ == "__main__":
    sys.exit(main())
