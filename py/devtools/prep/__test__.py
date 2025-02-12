import os
import unittest
import tempfile
import shutil

from py.devtools.prep.lib import (
    get_sapling_config_dir,
    ensure_sapling_include,
    configure_sapling,
)

class TestSaplingConfig(unittest.TestCase):
    def setUp(self):
        """
        Create a fresh temporary directory before each test,
        mimicking Pytest's `tmp_path` fixture.
        """
        self.tmp_dir = tempfile.mkdtemp()

    def tearDown(self):
        """
        Remove the temporary directory after each test.
        """
        shutil.rmtree(self.tmp_dir)

    def test_get_sapling_config_dir(self):
        git_path = os.path.join(self.tmp_dir, ".git")
        os.mkdir(git_path)
        expected_dir = os.path.join(git_path, "sl")
        actual_dir = get_sapling_config_dir(self.tmp_dir)
        self.assertEqual(actual_dir, expected_dir)

    def test_ensure_sapling_include(self):
        config_file = os.path.join(self.tmp_dir, "config")
        relative_path = "../ini/sl/config.ini"

        # File doesn’t exist initially
        changed = ensure_sapling_include(config_file, relative_path)
        self.assertTrue(changed, "Should create file and prepend line.")

        # Calling again detects it's already included
        changed_again = ensure_sapling_include(config_file, relative_path)
        self.assertFalse(changed_again, "No change after second include.")

    def test_configure_sapling(self):
        configure_sapling(self.tmp_dir)
        config_dir = os.path.join(self.tmp_dir, ".sl")
        self.assertTrue(
            os.path.isfile(os.path.join(config_dir, "config")),
            "Config file should exist in .sl directory."
        )

if __name__ == "__main__":
    unittest.main()
