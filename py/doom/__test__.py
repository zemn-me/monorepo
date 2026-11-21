import struct
import unittest

from py.doom.wad import clip, extract
from py.doom.textures import decode_patch, encode, png_url


class DoomTest(unittest.TestCase):
    def test_patch_posts_keep_transparent_gaps(self):
        patch = struct.pack('<HHhhI', 1, 3, 0, 0, 12) + bytes([1, 1, 0, 42, 0, 255])
        self.assertEqual(decode_patch(patch), (1, 3, [None, 42, None]))
        texture = encode(1, 3, [None, 42, None])
        self.assertIn('alpha', texture)
        self.assertTrue(png_url(texture, bytes(range(256)) * 3).startswith('data:image/png;base64,iVBOR'))

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
