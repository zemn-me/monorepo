"""Exercise the disc boundary and deterministic, data-only browser package."""
import gzip
import io
import json
from pathlib import Path
import struct
import tempfile
import unittest
import zipfile

from project.vanilla_conquer.assets.package_data import Disc, MAGIC, RA_INSTALL, RA_MAIN, TD_FILES, package, unpack_disc


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

    def test_unpack_soviet_disc(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with zipfile.ZipFile(root / "soviet.zip", "w") as archive:
                archive.writestr("RA_SOVIET.ISO", image())
                archive.writestr("readme.txt", "Disc notice")
            unpack_disc(root / "soviet.zip", root / "soviet.iso")
            with (root / "soviet.iso").open("rb") as stream:
                Disc(stream).extract("CONQUER.MIX", root / "conquer.mix")
            self.assertEqual((root / "conquer.mix").read_bytes(), b"hello")

    def test_invalid_disc(self):
        for change in (lambda d: d.__setitem__(16 * 2048, 0),
                       lambda d: struct.pack_into("<I", d, 20 * 2048 + 10, 999999),
                       lambda d: d.__setitem__(20 * 2048, 1)):
            with self.subTest(change=change):
                data = image()
                change(data)
                with self.assertRaises(ValueError):
                    Disc(io.BytesIO(data))

    def test_allowlists_include_ra_cinematics_but_exclude_music_and_programs(self):
        for name in RA_MAIN | RA_INSTALL | TD_FILES:
            self.assertTrue(name.endswith(".MIX"))
            self.assertFalse(name.startswith(("SCORES", "MAIN", "REDALERT")))

        self.assertIn("MOVIES1.MIX", RA_MAIN)
        self.assertIn("NCHIRES.MIX", RA_INSTALL)


if __name__ == "__main__":
    unittest.main()
