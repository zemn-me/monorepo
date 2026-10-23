"""Verify archive seeding leaves no candidate checkout in the build workspace."""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml


class ArchiveCheckoutTest(unittest.TestCase):
    def test_seeded_archives_survive_checkout_cleanup(self):
        workflow = yaml.safe_load(WORKFLOW.read_text())
        job = workflow["jobs"]["Staging"]
        steps = job["steps"]
        checkout = next(
            step for step in steps
            if step.get("name") == "Checkout candidate dependency archives"
        )
        seed = next(
            step for step in steps
            if step.get("name") == "Seed dependency archives for both staging builds"
        )
        for has_archives in (True, False):
            with self.subTest(has_archives=has_archives), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                workspace = root / "workspace"
                workspace.mkdir()
                runner_temp = root / "runner-temp"
                candidate = workspace / checkout["with"]["path"]
                candidate.mkdir()
                # Sparse checkouts include root files. Gazelle must not see this
                # second BUILD file when it scans the main workspace.
                (candidate / "BUILD.bazel").write_text("# candidate root BUILD\n")
                if has_archives:
                    for archive in ("ape", "rules_diff"):
                        source = candidate / "third_party/bazel_distdir" / archive
                        source.mkdir(parents=True)
                        (source / "archive.tar.gz").write_bytes(archive.encode())
                subprocess.run(
                    ["bash", "-eo", "pipefail", "-c", seed["run"]],
                    cwd=workspace,
                    env={**os.environ, "RUNNER_TEMP": str(runner_temp)},
                    check=True,
                    capture_output=True,
                )
                self.assertFalse(candidate.exists(), "candidate checkout pollutes Gazelle input")
                self.assertEqual([], list(workspace.rglob("BUILD.bazel")))
                if has_archives:
                    for archive in ("ape", "rules_diff"):
                        seeded = runner_temp / "bazel-distdir" / archive / "archive.tar.gz"
                        self.assertEqual(archive.encode(), seeded.read_bytes())


if __name__ == "__main__":
    WORKFLOW = Path(sys.argv[1])
    unittest.main(argv=[sys.argv[0]])
