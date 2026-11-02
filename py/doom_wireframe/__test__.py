import gzip
import os
import struct
import unittest
from pathlib import Path

from python.runfiles import runfiles

from py.doom_wireframe.lib import map_lumps, wireframe


def fixture(floors=(0, 0), ceilings=(128, 128), sky=False, back=1) -> bytes:
    ceiling_texture = b"F_SKY1" if sky else b"CEIL1"
    lumps = {
        "E1M1": b"",
        "VERTEXES": struct.pack("<hhhh", 0, 0, 128, 0),
        "LINEDEFS": struct.pack("<7H", 0, 1, 0, 0, 0, 0, back),
        "SIDEDEFS": b"".join(
            struct.pack("<hh8s8s8sH", 0, 0, b"-", b"-", b"-", i) for i in range(2)
        ),
        "SECTORS": b"".join(
            struct.pack(
                "<hh8s8shhh",
                floors[i],
                ceilings[i],
                b"FLOOR1",
                ceiling_texture,
                160,
                0,
                0,
            )
            for i in range(2)
        ),
        "E1M2": b"",
    }
    body, directory = b"", b""
    for name, data in lumps.items():
        directory += struct.pack("<II8s", 12 + len(body), len(data), name.encode())
        body += data
    return b"PWAD" + struct.pack("<II", len(lumps), 12 + len(body)) + body + directory


class WireframeTest(unittest.TestCase):
    def test_solid_wall(self):
        self.assertEqual(len(wireframe(fixture(back=0xFFFF), "E1M1")), 4)

    def test_portal_has_no_wall(self):
        with self.assertRaisesRegex(ValueError, "No architectural edges"):
            wireframe(fixture(), "E1M1")

    def test_step_uses_actual_floor_heights(self):
        edges = wireframe(fixture(floors=(0, 24)), "E1M1")
        self.assertEqual(len(edges), 4)
        self.assertEqual({p[1] for edge in edges for p in edge}, {0, 24})

    def test_ceiling_change_and_open_sky(self):
        self.assertEqual(len(wireframe(fixture(ceilings=(128, 192)), "E1M1")), 4)
        with self.assertRaisesRegex(ValueError, "No architectural edges"):
            wireframe(fixture(ceilings=(128, 192), sky=True), "E1M1")

    def test_missing_level_and_truncation(self):
        for wad, level in [
            (fixture(), "E1M2"),
            (fixture()[:-1], "E1M1"),
            (b"no", "E1M1"),
        ]:
            with self.assertRaises(ValueError):
                wireframe(wad, level)

    def test_original_hangar(self):
        location = runfiles.Create().Rlocation(os.environ["DOOM_WAD"])
        wad = gzip.decompress(Path(location).read_bytes())
        lumps = map_lumps(wad, "E1M1")
        self.assertEqual(len(lumps["LINEDEFS"]) // 14, 475)
        self.assertEqual(len(lumps["SECTORS"]) // 26, 85)
        edges = wireframe(wad, "E1M1")
        points = {p for edge in edges for p in edge}
        self.assertEqual(
            (min(p[0] for p in points), max(p[0] for p in points)), (-768, 3808)
        )
        self.assertEqual(
            (min(p[1] for p in points), max(p[1] for p in points)), (-136, 264)
        )
        self.assertEqual(len(edges), len(set(edges)))


if __name__ == "__main__":
    unittest.main()
