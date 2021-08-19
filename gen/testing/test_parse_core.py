import unittest
#from gen import core_pb2 as core
import gen.core


class TestBasic(unittest.TestCase):
    def parse_core_smoke(self):
        gen.core.load()

if __name__ == '__main__':
    unittest.main()