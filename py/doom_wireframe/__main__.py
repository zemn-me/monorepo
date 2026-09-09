"""Generate a typed wire model at build time, without shipping the WAD."""

import argparse
import gzip
import json
from pathlib import Path

from py.doom_wireframe.lib import wireframe


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("level")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    wad = args.source.read_bytes()
    if wad.startswith(b"\x1f\x8b"):
        wad = gzip.decompress(wad)
    edges = wireframe(wad, args.level)
    rows = [list(a + b) for a, b in edges]
    args.output.write_text(
        "// Generated from the pinned Doom WAD by Bazel.\n"
        "export const segments: readonly (readonly "
        "[number, number, number, number, number, number])[] = "
        + json.dumps(rows, separators=(",", ":"))
        + ";\n"
    )


if __name__ == "__main__":
    main()
