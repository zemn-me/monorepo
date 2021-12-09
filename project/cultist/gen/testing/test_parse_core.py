import unittest
#from gen import core_pb2 as core
import project.cultist.gen.core


class TestBasic(unittest.TestCase):
    def parse_core_smoke(self):
        cultist.gen.core.load()

if __name__ == '__main__':
    unittest.main()
