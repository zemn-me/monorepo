"""Package allowlisted data from the pinned freeware ISO9660 discs."""
import argparse
import gzip
import json
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import zipfile

RA_MAIN = {"CONQUER.MIX", "RUSSIAN.MIX", "ALLIES.MIX", "SOUNDS.MIX", "SNOW.MIX", "INTERIOR.MIX", "TEMPERAT.MIX", "GENERAL.MIX"}
RA_INSTALL = {"LOCAL.MIX", "HIRES.MIX", "LORES.MIX", "SPEECH.MIX"}
TD_FILES = {"CONQUER.MIX", "GENERAL.MIX", "SOUNDS.MIX", "TEMPERAT.MIX", "WINTER.MIX", "DESERT.MIX"}
TD_INSTALL = {"CCLOCAL.MIX", "TRANSIT.MIX", "SPEECH.MIX", "LOCAL.MIX", "UPDATE.MIX", "UPDATEC.MIX", "WINTICNH.MIX", "DESEICNH.MIX", "TEMPICNH.MIX"}
MAGIC = b"VANILLD1"
SECTOR = 2048


class Disc:
    """Read plain 2048-byte ISO9660 images (the two pinned freeware discs)."""
    def __init__(self, stream):
        self.stream = stream
        stream.seek(0, 2)
        self.size = stream.tell()
        pvd = self.read(16 * SECTOR, SECTOR)
        if pvd[:7] != b"\x01CD001\x01":
            raise ValueError("Not a primary ISO9660 volume")
        self.files = {}
        self._walk(pvd[156:190], "", set())

    def read(self, offset, size):
        if offset < 0 or size < 0 or offset + size > self.size:
            raise ValueError("Disc extent is outside image")
        self.stream.seek(offset)
        data = self.stream.read(size)
        if len(data) != size:
            raise ValueError("Truncated disc")
        return data

    def _walk(self, record, parent, visited):
        extent, = struct.unpack_from("<I", record, 2)
        size, = struct.unpack_from("<I", record, 10)
        if extent in visited:
            raise ValueError("Repeated ISO directory")
        visited.add(extent)
        data = self.read(extent * SECTOR, size)
        offset = 0
        while offset < len(data):
            length = data[offset]
            if not length:
                offset = (offset // SECTOR + 1) * SECTOR
                continue
            entry = data[offset:offset + length]
            if length < 34 or len(entry) != length or 33 + entry[32] > length:
                raise ValueError("Invalid ISO directory record")
            offset += length
            raw = entry[33:33 + entry[32]]
            if raw in (b"\x00", b"\x01"):
                continue
            name = raw.decode("ascii").split(";", 1)[0].upper()
            if not name or "/" in name or name in (".", ".."):
                raise ValueError("Invalid ISO name")
            path = parent + name
            if entry[25] & 2:
                self._walk(entry, path + "/", visited)
            else:
                start, = struct.unpack_from("<I", entry, 2)
                count, = struct.unpack_from("<I", entry, 10)
                if path in self.files or start * SECTOR + count > self.size:
                    raise ValueError("Invalid ISO file extent")
                self.files[path] = (start * SECTOR, count)

    def extract(self, name, output):
        offset, count = self.files[name]
        self.stream.seek(offset)
        with Path(output).open("wb") as target:
            while count:
                block = self.stream.read(min(count, 1024 * 1024))
                if not block:
                    raise ValueError("Truncated disc file")
                target.write(block)
                count -= len(block)


def package(files, output):
    manifest = [{"name": name, "size": path.stat().st_size} for name, path in sorted(files.items())]
    header = json.dumps(manifest, separators=(",", ":")).encode()
    with Path(output).open("wb") as raw, gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as dest:
        dest.write(MAGIC + struct.pack("<I", len(header)) + header)
        for name in sorted(files):
            with files[name].open("rb") as source:
                shutil.copyfileobj(source, dest)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True)
    parser.add_argument("--game", choices=["ra", "td"], required=True)
    parser.add_argument("--mixtool", required=True)
    parser.add_argument("--unshield", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--notice-output", required=True)
    args = parser.parse_args()
    mixtool = str(Path(args.mixtool).absolute())
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        with zipfile.ZipFile(args.archive) as archive:
            images = [n for n in archive.namelist() if n.lower().endswith(".iso")]
            if len(images) != 1:
                raise ValueError("Expected one freeware disc image")
            with archive.open(images[0]) as source, (work / "disc.iso").open("wb") as target:
                shutil.copyfileobj(source, target)
        with (work / "disc.iso").open("rb") as stream:
            disc = Disc(stream)
            if args.game == "ra":
                for member, allowlist in [("MAIN.MIX", RA_MAIN), ("INSTALL/REDALERT.MIX", RA_INSTALL)]:
                    # RawFileClass lowercases new output paths on Linux. Use the
                    # same spelling for extracted and rebuilt containers on every host.
                    mix = work / Path(member).name.lower()
                    disc.extract(member, mix)
                    command = [mixtool, "-x", "-d", str(work)]
                    for name in sorted(allowlist):
                        command += ["-f", name.lower()]
                    subprocess.run([*command, str(mix)], check=True, capture_output=True)
                    # Keep the original container layout for the engine's local-disc
                    # detection, but rebuild it without excluded music and movies.
                    mix.unlink()
                    command = [mixtool, "-c", "-d", str(work)]
                    for name in sorted(allowlist):
                        command += ["-f", name.lower()]
                    subprocess.run([*command, str(mix)], check=True, capture_output=True)
                files = {name: work / name.lower() for name in ("MAIN.MIX", "REDALERT.MIX")}
                disc.extract("README.TXT", args.notice_output)
            else:
                files = {name: work / name for name in TD_FILES}
                for name, path in files.items():
                    disc.extract(name, path)
                disc.extract("INSTALL/SETUP.Z", work / "setup.z")
                (work / "installed").mkdir()
                subprocess.run([str(Path(args.unshield).absolute()), "extract", str(work / "setup.z"), str(work / "installed")], check=True, capture_output=True)
                installed = {path.name.upper(): path for path in (work / "installed").rglob("*") if path.is_file()}
                for name in TD_INSTALL:
                    files[name] = installed[name]
                disc.extract("README.WRI", args.notice_output)
            for name, path in files.items():
                if not path.is_file() or not path.stat().st_size:
                    raise ValueError(f"Missing required game file: {name}")
            package(files, args.output)


if __name__ == "__main__":
    main()
