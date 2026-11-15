"""Exercise staging checkout and CLI bootstrap without cloud credentials."""

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


class PulumiBootstrapTest(unittest.TestCase):
    def test_main_cli_survives_nested_build_without_host_installation(self):
        workflow = yaml.safe_load(WORKFLOW.read_text())
        step = next(
            step for step in workflow["jobs"]["Staging"]["steps"]
            if step.get("name") == "Pulumi up from origin/main to staging"
        )
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            workspace = root / "workspace"
            prepare = workspace / ".github/workflows/prepare_ci.sh"
            prepare.parent.mkdir(parents=True)
            prepare.write_text("#!/bin/sh\nexit 0\n")
            prepare.chmod(0o755)
            cli = root / "execroot/external/pulumi/pulumi"
            cli.parent.mkdir(parents=True)
            cli.symlink_to(PULUMI)
            tools = root / "tools"
            tools.mkdir()
            host_cli = tools / "pulumi"
            host_cli.write_text("#!/bin/sh\necho 'unexpected host Pulumi' >&2\nexit 97\n")
            host_cli.chmod(0o755)
            # A nested Bazel invocation prunes the execroot symlink forest.
            # The exported CLI path must keep working after that happens.
            bazel = tools / "bazel"
            bazel.write_text("""#!/bin/sh
case "$1" in
  build) exit 0 ;;
  info) printf '%s\n' "$FIXTURE_EXECROOT" ;;
  cquery) printf '%s\n' 'external/pulumi/pulumi' ;;
  run) rm "$FIXTURE_EXECROOT/external/pulumi/pulumi"; pulumi version ;;
  *) exit 98 ;;
esac
""")
            bazel.chmod(0o755)
            result = subprocess.run(
                ["bash", "-eo", "pipefail", "-c", step["run"]],
                cwd=workspace,
                env={
                    **os.environ,
                    "BAZEL": str(bazel),
                    "PATH": f"{tools}:/usr/bin:/bin",
                    "RUNNER_TEMP": str(root),
                    "FIXTURE_EXECROOT": str(root / "execroot"),
                },
                capture_output=True,
                text=True,
            )
            self.assertEqual(0, result.returncode, result.stdout + result.stderr)
            self.assertNotIn("unexpected host Pulumi", result.stderr)


if __name__ == "__main__":
    WORKFLOW = Path(sys.argv[1])
    PULUMI = Path(sys.argv[2]).resolve()
    unittest.main(argv=[sys.argv[0]])
