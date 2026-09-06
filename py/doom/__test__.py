import struct
import unittest

from py.doom.wad import clip, extract


class DoomTest(unittest.TestCase):
    def test_half_planes_partition_a_room(self):
        room = [[0, 0], [8, 0], [8, 8], [0, 8]]
        right = clip(room, [4, 0], [4, 8])
        left = clip(room, [4, 0], [4, 8], 1)
        self.assertEqual({tuple(p) for p in right}, {(4, 0), (8, 0), (8, 8), (4, 8)})
        self.assertEqual({tuple(p) for p in left}, {(0, 0), (4, 0), (4, 8), (0, 8)})

    def test_does_not_accept_non_wad_input(self):
        with self.assertRaisesRegex(ValueError, 'Invalid WAD'):
            extract(struct.pack('<4sii', b'NOPE', 0, 12), 'E1M1')

    def test_rejects_out_of_bounds_lump(self):
        data = struct.pack('<4siiii8s', b'IWAD', 1, 12, 99, 10, b'E1M1')
        with self.assertRaisesRegex(ValueError, 'outside file'):
            extract(data, 'E1M1')


if __name__ == '__main__':
    unittest.main()
