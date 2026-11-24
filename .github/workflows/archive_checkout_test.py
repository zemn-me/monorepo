"""Exercise the candidate-to-main staging build handoff without credentials."""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml


class ArchiveCheckoutTest(unittest.TestCase):
    def test_saved_inputs_survive_replacing_candidate_with_main(self):
        workflow = yaml.safe_load(WORKFLOW.read_text())
        seed = next(
            step for step in workflow["jobs"]["Build"]["steps"]
            if step.get("name") == "Save candidate build inputs for main"
        )
        for has_archives in (True, False):
            with self.subTest(has_archives=has_archives), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                runner_temp = root / "runner-temp"
                runner_temp.mkdir()
                with tempfile.TemporaryDirectory(dir=root) as checkout:
                    workspace = Path(checkout)
                    launcher = workspace / "ci/staging/deploy"
                    launcher.mkdir(parents=True)
                    (launcher / "BUILD.bazel").write_text("# launcher\n")
                    if has_archives:
                        for archive in ("ape", "rules_diff"):
                            source = workspace / "third_party/bazel_distdir" / archive
                            source.mkdir(parents=True)
                            (source / "archive.tar.gz").write_bytes(archive.encode())
                    subprocess.run(
                        ["bash", "-eo", "pipefail", "-c", seed["run"]],
                        cwd=workspace,
                        env={**os.environ, "RUNNER_TEMP": str(runner_temp)},
                        check=True,
                    )

                self.assertTrue((runner_temp / "deploy/BUILD.bazel").is_file())
                for archive in ("ape", "rules_diff"):
                    saved = runner_temp / "bazel-distdir" / archive / "archive.tar.gz"
                    if has_archives:
                        self.assertEqual(archive.encode(), saved.read_bytes())
                    else:
                        self.assertFalse(saved.exists())


if __name__ == "__main__":
    WORKFLOW = Path(sys.argv[1])
    unittest.main(argv=[sys.argv[0]])
