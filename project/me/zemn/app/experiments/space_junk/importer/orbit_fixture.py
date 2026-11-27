"""Extract the spatula's catalogue entry and observation from the pinned archives."""

import json
import sys
from pathlib import Path

def write_fixture(catalogue_file, elements_file, output_file):
    objects = json.loads(catalogue_file.read_text())["objects"]
    spatula = next(obj for obj in objects if obj["piece"] == "1998-067AJ")
    lines = elements_file.read_text().splitlines()
    first, second = next(
        (a, b) for a, b in zip(lines, lines[1:])
        if a.startswith(f"1 {spatula['id']}") and b.startswith(f"2 {spatula['id']} ")
    )
    output_file.write_text(
        "import type { SpaceObject } from './chart.js';\n"
        f"export const spatula: SpaceObject = {json.dumps(spatula)};\n"
        f"export const tleLines = {json.dumps([first, second])};\n"
        "export const tle = tleLines.join('\\n');\n"
    )


if __name__ == "__main__":
    write_fixture(*map(Path, sys.argv[1:]))
