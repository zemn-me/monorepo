"""Select original freeware game data and create a deterministic browser package."""
import argparse
import gzip
import json
from pathlib import Path, PurePosixPath
import re
import struct
import subprocess
import tempfile

ROOT = "EA Games/Command & Conquer The First Decade/Command & Conquer(tm) Tiberian Sun(tm)/SUN"
ARCHIVES = {
    "TIBSUN.MIX", "GMENU.MIX", "MAPS01.MIX", "MAPS02.MIX", "MULTI.MIX",
    "PATCH.MIX", "SIDECD01.MIX", "SIDECD02.MIX", "EXPAND01.MIX",
    "E01SCD01.MIX", "E01SCD02.MIX",
}
MAGIC = b"OPENTSD1"


def select_members(names):
    selected = {}
    for name in names:
        path = PurePosixPath(name)
        if str(path.parent) != ROOT:
            continue
        leaf = path.name.upper()
        if leaf not in ARCHIVES and not re.fullmatch(r"FS(GDI|NOD)[0-9]{2}\.MAP", leaf):
            continue
        if leaf in selected:
            raise ValueError(f"Duplicate game file: {leaf}")
        selected[leaf] = name
    missing = ARCHIVES - selected.keys()
    if missing:
        raise ValueError(f"Missing required game archives: {sorted(missing)}")
    return dict(sorted(selected.items()))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--unrar", required=True)
    parser.add_argument("--archive", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--license-output", required=True)
    args = parser.parse_args()
    unrar = str(Path(args.unrar).absolute())
    archive = str(Path(args.archive).absolute())
    license_member = ROOT.rsplit("/", 2)[0] + "/EA_CnCTiberianSunEULA.doc"
    Path(args.license_output).write_bytes(subprocess.check_output([unrar, "p", "-inul", archive, license_member]))
    names = subprocess.check_output([unrar, "lb", archive], text=True).splitlines()
    selected = select_members(names)
    with tempfile.TemporaryDirectory() as temporary:
        subprocess.run([unrar, "e", "-idq", "-o+", archive, *selected.values(), temporary + "/"], check=True)
        files = {p.name.upper(): p for p in Path(temporary).iterdir()}
        manifest = [{"name": name, "size": files[name].stat().st_size} for name in selected]
        header = json.dumps(manifest, separators=(",", ":")).encode()
        with open(args.output, "wb") as output, gzip.GzipFile(filename="", mode="wb", fileobj=output, mtime=0) as package:
            package.write(MAGIC + struct.pack("<I", len(header)) + header)
            for name in selected:
                with files[name].open("rb") as source:
                    while block := source.read(1024 * 1024):
                        package.write(block)


if __name__ == "__main__":
    main()
