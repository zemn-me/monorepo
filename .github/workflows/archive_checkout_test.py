"""Exercise the pinned main build in a checkout separate from its workflow tools."""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class ArchiveCheckoutTest(unittest.TestCase):
    def test_main_uses_candidate_archives_and_only_bootstraps_a_missing_launcher(self):
        for has_launcher in (False, True):
            with self.subTest(has_launcher=has_launcher), tempfile.TemporaryDirectory() as root:
                workspace = Path(root)
                candidate = workspace / "ci/staging/deploy"
                candidate.mkdir(parents=True)
                (candidate / "deploy.ts").write_text("candidate")
                main = workspace / "main"
                (main / "ci/staging").mkdir(parents=True)
                launcher = main / "ci/staging/deploy"
                if has_launcher:
                    launcher.mkdir()
                    (launcher / "deploy.ts").write_text("main")
                prepare = main / ".github/workflows/prepare_ci.sh"
                prepare.parent.mkdir(parents=True)
                prepare.write_text("#!/bin/sh\nexit 0\n")
                prepare.chmod(0o755)
                bazel = main / "sh/bin/bazel"
                bazel.parent.mkdir(parents=True)
                bazel.write_text("#!/bin/sh\nprintf '%s\\n' \"$@\" >> bazel-args\n")
                bazel.chmod(0o755)
                subprocess.run(
                    [BUILD_SCRIPT], cwd=main, check=True,
                    env={**os.environ, "GITHUB_WORKSPACE": str(workspace)},
                )
                args = (main / "bazel-args").read_text().splitlines()
                for archive in ("ape", "rules_diff"):
                    self.assertIn(f"--distdir={workspace}/third_party/bazel_distdir/{archive}", args)
                self.assertEqual((launcher / "deploy.ts").read_text(), "main" if has_launcher else "candidate")


if __name__ == "__main__":
    BUILD_SCRIPT = Path(sys.argv[1]).resolve()
    unittest.main(argv=[sys.argv[0]])
