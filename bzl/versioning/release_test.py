import unittest
from argparse import Namespace
from json import dumps, loads
from pathlib import Path
from tempfile import TemporaryDirectory

from bzl.versioning.release_lib import changed_kind, fix


class ChangedKindTest(unittest.TestCase):
    def test_api_has_priority(self) -> None:
        self.assertEqual(
            changed_kind(
                {"api": "old", "dependencies": "old", "package": "old"},
                {"api": "new", "dependencies": "new", "package": "new"},
            ),
            "api",
        )

    def test_dependencies_have_priority_over_package(self) -> None:
        self.assertEqual(
            changed_kind(
                {"api": "same", "dependencies": "old", "package": "old"},
                {"api": "same", "dependencies": "new", "package": "new"},
            ),
            "dependencies",
        )

    def test_package_is_patch(self) -> None:
        self.assertEqual(
            changed_kind(
                {"api": "same", "dependencies": "same", "package": "old"},
                {"api": "same", "dependencies": "same", "package": "new"},
            ),
            "package",
        )

    def test_fixer_bumps_only_highest_priority_change(self) -> None:
        with TemporaryDirectory() as directory:
            root = Path(directory)
            lock = root / "release.lock"
            manifest = root / "manifest.json"
            versions = [root / kind for kind in ("major", "minor", "patch")]
            lock.write_text(
                dumps(
                    {
                        "api": "old",
                        "dependencies": "old",
                        "package": "old",
                        "version": [1, 2, 3],
                    }
                )
            )
            manifest.write_text(
                dumps(
                    {
                        "api": "old",
                        "dependencies": "new",
                        "package": "new",
                        "version": [1, 2, 3],
                    }
                )
            )
            for path, value in zip(versions, (1, 2, 3), strict=True):
                path.write_text(f"{value}\n")

            fix(
                Namespace(
                    lock=str(lock),
                    manifest=str(manifest),
                    version=[str(path) for path in versions],
                )
            )

            self.assertEqual([path.read_text() for path in versions], ["1\n", "3\n", "3\n"])
            self.assertEqual(loads(lock.read_text())["version"], [1, 3, 3])


if __name__ == "__main__":
    unittest.main()
