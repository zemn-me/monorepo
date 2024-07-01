import unittest
#from gen import core_pb2 as core
import project.cultist.gen.testing.core


class TestBasic(unittest.TestCase):
    def parse_core_smoke(self):
		project.cultist.gen.testing.core.load()

if __name__ == '__main__':
    unittest.main()
