"""Verify independently addressable movie packets and deterministic catalogs."""

import gzip
import hashlib
import json
from pathlib import Path
import struct
import tempfile
import unittest

from project.vanilla_conquer.assets.package_cinematics import write_catalog


class CatalogTest(unittest.TestCase):
    def test_individual_movies_and_palettes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            files = {}
            for name, data in {"ALLY1.VQA": b"allied movie", "ALLY1.VQP": b"palette", "SOVIET1.VQA": b"soviet movie", "SCORES.MIX": b"excluded"}.items():
                files[name] = root / name
                files[name].write_bytes(data)
            (root / "first").mkdir()  # Bazel precreates declared directory outputs.
            write_catalog(files, root / "first", root / "first.ts")
            write_catalog(dict(reversed(list(files.items()))), root / "second", root / "second.ts")
            self.assertEqual((root / "first.ts").read_bytes(), (root / "second.ts").read_bytes())
            catalog = json.loads((root / "first.ts").read_text().split(" = ", 1)[1].removesuffix(";\n"))
            self.assertEqual(set(catalog), {"ALLY1", "SOVIET1"})
            for movie, members in [("ALLY1", ["ALLY1.VQA", "ALLY1.VQP"]), ("SOVIET1", ["SOVIET1.VQA"])]:
                filename = Path(catalog[movie]).name
                packet = (root / "first" / filename).read_bytes()
                self.assertEqual(packet, (root / "second" / filename).read_bytes())
                self.assertEqual(filename, hashlib.sha256(packet).hexdigest() + ".cinematic.gz")
                content = gzip.decompress(packet)
                self.assertEqual(content[:8], b"VANILLD1")
                size, = struct.unpack_from("<I", content, 8)
                manifest = json.loads(content[12:12 + size])
                self.assertEqual([entry["name"] for entry in manifest], members)
                self.assertEqual(content[12 + size:], b"".join(files[name].read_bytes() for name in members))


if __name__ == "__main__":
    unittest.main()
