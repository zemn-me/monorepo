"""Extract both discs into deterministic, individually downloadable movies."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import zipfile

from project.vanilla_conquer.assets.package_data import Disc, package


def extract_mix(mixtool, mix, output, members=()):
    output.mkdir(parents=True, exist_ok=True)
    command = [mixtool, "-x", "-d", str(output)]
    for member in members:
        command += ["-f", member]
    subprocess.run([*command, str(mix)], check=True, capture_output=True)


def extract_disc(archive_path, root, mixtool, movie_archive, palettes=False):
    root.mkdir()
    with zipfile.ZipFile(archive_path) as archive:
        images = [name for name in archive.namelist() if name.lower().endswith(".iso")]
        if len(images) != 1:
            raise ValueError("Expected one freeware disc image")
        with archive.open(images[0]) as source, (root / "disc.iso").open("wb") as target:
            shutil.copyfileobj(source, target)
    with (root / "disc.iso").open("rb") as stream:
        disc = Disc(stream)
        disc.extract("MAIN.MIX", root / "main.mix")
        extract_mix(mixtool, root / "main.mix", root, [movie_archive])
        extract_mix(mixtool, root / movie_archive, root / "files")
        if palettes:
            disc.extract("INSTALL/REDALERT.MIX", root / "install.mix")
            extract_mix(mixtool, root / "install.mix", root, ["nchires.mix"])
            extract_mix(mixtool, root / "nchires.mix", root / "files")
    files = {}
    for path in sorted((root / "files").iterdir()):
        if re.fullmatch(r"[A-Z0-9_]{1,16}\.(VQA|VQP)", path.name.upper()):
            files[path.name.upper()] = path
        # Unnamed archive entries have no game-addressable filename. Keep the
        # catalog limited to movies the engine can request by their original names.
    return files


def write_catalog(files, public_dir, module):
    public_dir.mkdir(parents=True, exist_ok=True)
    catalog = {}
    for filename in sorted(files):
        if not filename.endswith(".VQA"):
            continue
        name = filename[:-4]
        if not re.fullmatch(r"[A-Z0-9_]{1,16}", name):
            raise ValueError("Invalid cinematic name")
        members = {filename: files[filename]}
        palette = name + ".VQP"
        if palette in files:
            members[palette] = files[palette]
        output = public_dir / "movie.gz"
        package(members, output)
        with output.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        final = digest + ".cinematic.gz"
        output.rename(public_dir / final)
        catalog[name] = "/sha256/" + final
    if not catalog:
        raise ValueError("No cinematics found")
    module.write_text("export const raCinematics: Readonly<Record<string, string>> = " + json.dumps(catalog, sort_keys=True) + ";\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("allied", "soviet", "mixtool", "public-dir", "module"):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    mixtool = str(Path(args.mixtool).absolute())
    with tempfile.TemporaryDirectory() as temporary:
        root = Path(temporary)
        files = extract_disc(args.allied, root / "allied", mixtool, "movies1.mix", palettes=True)
        # Match the native engine's precedence for files shared by both discs.
        files.update(extract_disc(args.soviet, root / "soviet", mixtool, "movies2.mix"))
        write_catalog(files, Path(args.public_dir), Path(args.module))


if __name__ == "__main__":
    main()
