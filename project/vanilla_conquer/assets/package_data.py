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


def compact_shape(data):
    """Downsample Gold UI SHPs for the engine's original 320x200 layout.

    Decode LCW keyframes and XOR deltas as in Vanilla Conquer's keyframe.cpp;
    emit independent literal LCW frames so no delta dependencies survive resizing.
    """
    count, _, _, width, height, _, flags = struct.unpack_from("<7H", data)
    if flags:
        raise ValueError("Unsupported Gold UI shape")
    entries = [struct.unpack_from("<II", data, 14 + i * 8) for i in range(count)]

    def lcw(offset):
        result = bytearray()
        while len(result) < width * height:
            op = data[offset]
            offset += 1
            if op == 0x80:
                break
            if op < 0x80:
                size = (op >> 4) + 3
                source = len(result) - (((op & 15) << 8) + data[offset])
                offset += 1
            elif op < 0xC0:
                size = op & 63
                result.extend(data[offset:offset + size])
                offset += size
                continue
            elif op == 0xFE:
                size, = struct.unpack_from("<H", data, offset)
                result.extend(bytes([data[offset + 2]]) * size)
                offset += 3
                continue
            else:
                size = (op & 63) + 3
                if op == 0xFF:
                    size, = struct.unpack_from("<H", data, offset)
                    offset += 2
                source, = struct.unpack_from("<H", data, offset)
                offset += 2
            for i in range(size):
                result.append(result[source + i])
        if len(result) != width * height:
            raise ValueError("Invalid Gold UI keyframe")
        return result

    def delta(frame, offset):
        pos = 0
        while True:
            op = data[offset]
            offset += 1
            repeat = False
            size = op
            if op == 0:
                size = data[offset]
                offset += 1
                repeat = True
            elif op & 0x80:
                size = op & 127
                if size:
                    pos += size
                    continue
                size, = struct.unpack_from("<H", data, offset)
                offset += 2
                if not size:
                    return frame
                if not size & 0x8000:
                    pos += size
                    continue
                repeat = bool(size & 0x4000)
                size &= 0x3FFF
            for i in range(size):
                frame[pos + i] ^= data[offset if repeat else offset + i]
            offset += 1 if repeat else size
            pos += size

    decoded = []
    for index, (entry, reference) in enumerate(entries):
        offset, kind = entry & 0xFFFFFF, entry >> 24
        if kind == 0x80:
            frame = lcw(offset)
        elif kind == 0x40:
            frame = delta(lcw(reference & 0xFFFFFF), offset)
        elif kind == 0x20:
            frame = delta(bytearray(decoded[index - 1]), offset)
        else:
            raise ValueError("Unsupported Gold UI frame")
        decoded.append(frame)
    small_width, small_height = width // 2, height // 2
    payload = bytearray()
    table = bytearray()
    start = 14 + (count + 2) * 8
    for frame in decoded:
        table.extend(struct.pack("<II", (start + len(payload)) | 0x80000000, 0))
        pixels = bytes(frame[y * width + x] for y in range(0, small_height * 2, 2) for x in range(0, small_width * 2, 2))
        for pos in range(0, len(pixels), 63):
            chunk = pixels[pos:pos + 63]
            payload.extend(bytes([0x80 | len(chunk)]) + chunk)
        payload.append(0x80)
    table.extend(struct.pack("<IIII", start + len(payload), 0, 0, 0))
    return struct.pack("<7H", count, 0, 0, small_width, small_height, small_width * small_height, 0) + table + payload


def compact_font(data, gradient=False):
    """Fit Gold's doubled six-point glyphs into the DOS control layout."""
    offsets, widths, _, heights = struct.unpack_from("<4H", data, 6)
    count, height, width = data[17] + 1, data[18], data[19]
    small_height = (height + 1) // 2
    header = bytearray(data[:20])
    bitmap = bytearray()
    new_offsets = bytearray()
    new_widths = bytearray()
    start = 20 + count * 3
    for char in range(count):
        offset, = struct.unpack_from("<H", data, offsets + char * 2)
        top, lines = data[heights + char * 2:heights + char * 2 + 2]
        old_width = data[widths + char]
        small_width = (old_width + 1) // 2
        # DOS text subtracts two pixels of spacing. Retain a blank column
        # so adjacent glyphs (especially i/l) do not overlap after reduction.
        new_widths.append(small_width + 1)
        new_offsets.extend(struct.pack("<H", start + len(bitmap)))
        rows = [[0] * old_width for _ in range(height)]
        for y in range(lines):
            for x in range(old_width):
                packed = data[offset + y * ((old_width + 1) // 2) + x // 2]
                rows[top + y][x] = (packed >> ((x % 2) * 4)) & 15
        for y in range(small_height):
            pixels = []
            for x in range(small_width):
                block = [rows[dy][dx] for dy in range(y * 2, min(y * 2 + 2, height)) for dx in range(x * 2, min(x * 2 + 2, old_width))]
                # Preserve thin strokes; DOS gradient text expects ink in slots
                # 11–15, while Gold ships a monochrome six-point font.
                foreground = 13 if gradient else 1
                pixels.append(foreground if 1 in block else max(block))
            pixels.append(0)
            for x in range(0, len(pixels), 2):
                bitmap.append(pixels[x] | ((pixels[x + 1] if x + 1 < len(pixels) else 0) << 4))
    height_start = start + len(bitmap)
    size = height_start + count * 2
    struct.pack_into("<H", header, 0, size)
    struct.pack_into("<4H", header, 6, 20, 20 + count * 2, start, height_start)
    header[18:20] = bytes([small_height, (width + 1) // 2 + 1])
    return header + new_offsets + new_widths + bitmap + bytes([0, small_height]) * count


def compact_ui(files, work, mixtool):
    # Gold ships only the H-prefixed interface artwork. Supply the DOS names
    # from those same assets; leave the original high-resolution archive intact.
    compact = work / "compact"
    compact.mkdir()
    subprocess.run([mixtool, "-x", "-d", str(compact), str(files["CCLOCAL.MIX"])], check=True, capture_output=True)
    names = ["tabs.shp", "strip.shp", "clock.shp", "stripup.shp", "stripdn.shp"]
    for name in names:
        subprocess.run([mixtool, "-x", "-d", str(work), "-f", "h" + name, str(files["UPDATEC.MIX"])], check=True, capture_output=True)
        target = compact / name
        target.write_bytes(compact_shape((work / ("h" + name)).read_bytes()))
    for name in ["6point.fnt", "grad6fnt.fnt"]:
        path = compact / name
        path.write_bytes(compact_font(path.read_bytes(), gradient=name == "grad6fnt.fnt"))
    output = work / "compact.mix"
    command = [mixtool, "-c", "-d", str(compact)]
    for target in sorted(compact.iterdir()):
        command += ["-f", target.name]
    subprocess.run([*command, str(output)], check=True, capture_output=True)
    files["LOCAL.MIX"] = output


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
                # Gold's LOCAL.MIX is a four-byte DOS placeholder. Both native
                # layouts need the fonts and palette from its real UI archive.
                compact_ui(files, work, mixtool)
                disc.extract("README.WRI", args.notice_output)
            for name, path in files.items():
                if not path.is_file() or not path.stat().st_size:
                    raise ValueError(f"Missing required game file: {name}")
            package(files, args.output)


if __name__ == "__main__":
    main()
