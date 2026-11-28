"""Convert a gzipped Bazel Central Registry index into Renovate JSON feeds."""

import argparse
import gzip
import json
from pathlib import Path

from py.ci.renovate_bcr.registry_pb2 import Registry


def write_feeds(index, directory):
    directory.mkdir(parents=True, exist_ok=True)
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("index", type=Path, help="path to registry.pb.gz")
    parser.add_argument("output", type=Path, help="directory for the module JSON files")
    args = parser.parse_args()
    with gzip.open(args.index, "rb") as data:
        write_feeds(Registry.FromString(data.read()), args.output)


if __name__ == "__main__":
    main()
