"""Exercise the pinned main build in a checkout separate from its workflow tools."""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class ArchiveCheckoutTest(unittest.TestCase):
    def test_pinned_main_keeps_its_program_when_bootstrapping_bundle_rules(self):
        for has_packager in (False, True):
            with self.subTest(has_packager=has_packager), tempfile.TemporaryDirectory() as root:
                workspace = Path(root)
                candidate = workspace / "ci/deploy"
                candidate.mkdir(parents=True)
                packaging = ("bundle.bzl", "bundle_test.sh", "deploy_failure_test.sh", "run.sh")
                for name in packaging:
                    (candidate / name).write_text("candidate")
                (candidate / "deploy.ts").write_text("candidate program")
                main = workspace / "main"
                launcher = main / "ci/deploy"
                launcher.mkdir(parents=True)
                (launcher / "deploy.ts").write_text("main program")
                build_file = launcher / "BUILD.bazel"
                build_file.write_text("# main targets\n")
                if has_packager:
                    for name in packaging:
                        (launcher / name).write_text("main")
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
                self.assertEqual((launcher / "deploy.ts").read_text(), "main program")
                self.assertIn("# main targets", build_file.read_text())
                self.assertEqual("deploy_bundle()" in build_file.read_text(), not has_packager)
                for name in packaging:
                    self.assertEqual((launcher / name).read_text(), "main" if has_packager else "candidate")
                self.assertIn("//ci/deploy:bundle_test", args)


if __name__ == "__main__":
    BUILD_SCRIPT = Path(sys.argv[1]).resolve()
    unittest.main(argv=[sys.argv[0]])
