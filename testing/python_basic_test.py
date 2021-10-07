import unittest


class TestBasic(unittest.TestCase):

    def test_whatever(self):
        self.assertEqual('ok', 'ok')

if __name__ == '__main__':
    unittest.main()