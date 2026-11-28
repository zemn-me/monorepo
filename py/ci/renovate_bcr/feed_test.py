import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from py.ci.renovate_bcr.feed import write_feeds
from py.ci.renovate_bcr.registry_pb2 import Registry


class FeedTest(unittest.TestCase):
    def test_only_the_exact_listed_module_version_supplies_the_date(self):
        index = Registry()
        module = index.modules.add(name="example")
        module.metadata.versions.extend(["1.0", "1.0.bcr.1", "1.1"])
        module.metadata.yanked_versions["1.0"] = "Withdrawn"
        module.versions.add(version="1.0").commit.date = "2026-01-01T10:00:00Z"
        module.versions.add(version="1.0.bcr.1").commit.date = "2026-03-01T10:00:00Z"
        module.versions.add(version="2.0").commit.date = "2026-03-02T10:00:00Z"
        other = index.modules.add(name="other")
        other.versions.add(version="1.1").commit.date = "2026-03-03T10:00:00Z"
        with TemporaryDirectory() as directory:
            write_feeds(index, Path(directory))
            feed = json.loads((Path(directory) / "example.json").read_text())
        self.assertEqual(feed["releases"], [
            {"version": "1.0", "releaseTimestamp": "2026-01-01T10:00:00Z", "isDeprecated": True},
            {"version": "1.0.bcr.1", "releaseTimestamp": "2026-03-01T10:00:00Z"},
            {"version": "1.1"},
        ])


if __name__ == "__main__":
    unittest.main()
