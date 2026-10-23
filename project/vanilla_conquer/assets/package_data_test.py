"""Exercise the disc boundary and deterministic, data-only browser package."""
import gzip
import io
import json
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from project.vanilla_conquer.assets.package_data import Disc, MAGIC, RA_INSTALL, RA_MAIN, TD_FILES, compact_font, compact_shape, main, package


def record(extent, size, name, directory=False):
    result = bytearray(33 + len(name) + (len(name) % 2 == 0))
    result[0] = len(result)
    struct.pack_into("<I", result, 2, extent)
    struct.pack_into("<I", result, 10, size)
    result[25] = 2 if directory else 0
    result[32] = len(name)
    result[33:33 + len(name)] = name
    return result


def image():
    data = bytearray(22 * 2048)
    data[16 * 2048:16 * 2048 + 7] = b"\x01CD001\x01"
    root = record(20, 2048, b"\x00", True)
    data[16 * 2048 + 156:16 * 2048 + 190] = root
    entry = record(21, 5, b"CONQUER.MIX;1")
    data[20 * 2048:20 * 2048 + len(entry)] = entry
    data[21 * 2048:21 * 2048 + 5] = b"hello"
    return data


class PackageTest(unittest.TestCase):
    def test_compact_font_preserves_strokes_and_bearing(self):
        source = bytearray(29)
        struct.pack_into("<HBB6H4B", source, 0, 29, 0, 5, 14, 20, 22, 23, 27, 0x1012, 0, 0, 4, 3)
        struct.pack_into("<H", source, 20, 23)
        source[22] = 3
        source[23:27] = bytes([0x10, 0, 0, 1])
        source[27:29] = bytes([1, 2])
        result = compact_font(source)
        self.assertEqual(result[18:20], bytes([2, 3]))
        self.assertEqual(result[22], 3)
        self.assertEqual(result[23:27], bytes([1, 0, 0x10, 0]))
        self.assertEqual(result[27:29], bytes([0, 2]))
        self.assertEqual(compact_font(source, gradient=True)[23:27], bytes([13, 0, 0xD0, 0]))
        self.assertEqual(struct.unpack_from("<H", result)[0], len(result))

    def test_compact_gold_ui_preserves_keyframes_and_delta_states(self):
        # A 4x4 keyframe uses literal pixels, an overlapping back-reference,
        # and a run. The next two frames exercise key and chained XOR deltas.
        key = bytes([0x84, 0, 1, 2, 3, 0, 4, 0xFE, 9, 0, 8, 0x80])
        delta = bytes([1, 9, 0x80, 0, 0])
        start = 14 + 5 * 8
        source = struct.pack("<7H", 3, 0, 0, 4, 4, 16, 0)
        source += struct.pack("<II", start | 0x80000000, 0)
        source += struct.pack("<II", (start + len(key)) | 0x40000000, start)
        source += struct.pack("<II", (start + len(key) + len(delta)) | 0x20000000, 1)
        source += struct.pack("<IIII", start + len(key) + 2 * len(delta), 0, 0, 0)
        result = compact_shape(source + key + delta + delta)
        self.assertEqual(struct.unpack_from("<7H", result), (3, 0, 0, 2, 2, 4, 0))
        for index, first in enumerate([0, 9, 0]):
            offset, reference = struct.unpack_from("<II", result, 14 + index * 8)
            self.assertEqual(offset >> 24, 0x80)
            self.assertEqual(reference, 0)
            self.assertEqual(result[offset & 0xFFFFFF:(offset & 0xFFFFFF) + 6], bytes([0x84, first, 2, 8, 8, 0x80]))

    def test_ra_packaging_tracks_lowercase_tool_outputs(self):
        # Model vanillamix's output spelling even on case-insensitive hosts.
        def mixtool(command, **kwargs):
            if "-c" in command:
                output = Path(command[-1])
                self.assertEqual(output.name, output.name.lower())
                output.with_name(output.name.lower()).write_bytes(b"rebuilt mix")

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / "disc.zip"
            with zipfile.ZipFile(archive, "w") as zipped:
                zipped.writestr("disc.iso", b"disc fixture")
            output = root / "ra.gz"
            with patch("project.vanilla_conquer.assets.package_data.Disc") as disc, \
                 patch("project.vanilla_conquer.assets.package_data.subprocess.run", side_effect=mixtool), \
                 patch("sys.argv", ["package_data", "--archive", str(archive), "--game", "ra",
                                    "--mixtool", "mixtool", "--unshield", "unshield",
                                    "--output", str(output), "--notice-output", str(root / "notice")]):
                disc.return_value.extract.side_effect = lambda name, path: Path(path).write_bytes(b"disc file")
                main()
            content = gzip.decompress(output.read_bytes())
            length, = struct.unpack_from("<I", content, 8)
            self.assertEqual(json.loads(content[12:12 + length]), [
                {"name": "MAIN.MIX", "size": 11}, {"name": "REDALERT.MIX", "size": 11},
            ])
            self.assertEqual(content[12 + length:], b"rebuilt mix" * 2)

    def test_disc_and_package(self):
        disc = Disc(io.BytesIO(image()))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            disc.extract("CONQUER.MIX", root / "conquer.mix")
            self.assertEqual((root / "conquer.mix").read_bytes(), b"hello")
            files = {"CONQUER.MIX": root / "conquer.mix"}
            package(files, root / "first.gz")
            package(files, root / "second.gz")
            self.assertEqual((root / "first.gz").read_bytes(), (root / "second.gz").read_bytes())
            content = gzip.decompress((root / "first.gz").read_bytes())
            self.assertEqual(content[:8], MAGIC)
            length, = struct.unpack_from("<I", content, 8)
            self.assertEqual(json.loads(content[12:12 + length]), [{"name": "CONQUER.MIX", "size": 5}])
            self.assertEqual(content[12 + length:], b"hello")

    def test_invalid_disc(self):
        for change in (lambda d: d.__setitem__(16 * 2048, 0),
                       lambda d: struct.pack_into("<I", d, 20 * 2048 + 10, 999999),
                       lambda d: d.__setitem__(20 * 2048, 1)):
            with self.subTest(change=change):
                data = image()
                change(data)
                with self.assertRaises(ValueError):
                    Disc(io.BytesIO(data))

    def test_allowlists_exclude_music_movies_and_programs(self):
        for name in RA_MAIN | RA_INSTALL | TD_FILES:
            self.assertTrue(name.endswith(".MIX"))
            self.assertFalse(name.startswith(("SCORES", "MOVIES", "NCHIRES", "MAIN", "REDALERT")))


if __name__ == "__main__":
    unittest.main()
