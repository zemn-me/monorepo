"""Check the merge queue and production deployment gates."""

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import yaml


def staging_providers(workflows, event):
    return {
        filename
        for filename, workflow in workflows.items()
        if event in workflow["on"]
        for job_id, job in workflow["jobs"].items()
        if job.get("name", job_id) == "Staging"
    }


class StagingGateTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # BaseLoader preserves GitHub's "on" key instead of YAML 1.1 booleans.
        cls.workflows = {
            Path(filename).name: yaml.load(Path(filename).read_text(), Loader=yaml.BaseLoader)
            for filename in WORKFLOW_PATHS
        }

    def test_merge_queue_requires_deployment_workflow(self):
        # Conditions are deliberately ignored: skipped jobs satisfy required checks too.
        self.assertEqual(
            staging_providers(self.workflows, "merge_group"), {"staging.yml"}
        )
        staging = self.workflows["staging.yml"]["jobs"]["Staging"]
        self.assertNotIn("if", staging)
        self.assertEqual(staging["concurrency"]["group"], "pulumi_deploy")
        steps = [step.get("name") for step in staging["steps"]]
        self.assertLess(
            steps.index("Pulumi up from origin/main to staging"),
            steps.index("Deploy candidate branch to Staging"),
        )

    def test_failed_bazel_deploy_fails_the_workflow_step(self):
        for workflow, job, step_name, revision in (
            ("staging.yml", "Staging", "Pulumi up from origin/main to staging", "main"),
            ("staging.yml", "Staging", "Deploy candidate branch to Staging", "candidate"),
            ("submit.yml", "Submit", "Submit", "production"),
        ):
            steps = self.workflows[workflow]["jobs"][job]["steps"]
            step = next(step for step in steps if step.get("name") == step_name)
            with self.subTest(revision=revision), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                prepare = root / ".github/workflows/prepare_ci.sh"
                prepare.parent.mkdir(parents=True)
                prepare.write_text("#!/bin/sh\nexit 0\n")
                prepare.chmod(0o755)
                bazel = root / "bazel"
                bazel.write_text('#!/bin/sh\nprintf "%s\\n" "$@" > args\nexit 23\n')
                bazel.chmod(0o755)
                result = subprocess.run(
                    ["bash", "-eo", "pipefail", "-c", step["run"]], cwd=root,
                    env={"BAZEL": str(bazel), "RUNNER_TEMP": directory},
                )
                self.assertEqual(result.returncode, 23)
                args = (root / "args").read_text().splitlines()
                self.assertEqual(args[0], "run")
                self.assertEqual(args[-3:], ["//ci/deploy:deploy", "--", revision])

    def test_pull_requests_can_enter_queue_without_deploying(self):
        self.assertEqual(
            staging_providers(self.workflows, "pull_request"), {"staging-pr.yml"}
        )
        self.assertNotIn("merge_group", self.workflows["staging-pr.yml"]["on"])

    def test_production_deploys_only_the_current_main(self):
        jobs = self.workflows["submit.yml"]["jobs"]
        deploy = jobs["Submit"]
        self.assertEqual(deploy["concurrency"]["group"], "pulumi_deploy")
        revision, *steps = deploy["steps"]
        for step in steps:
            self.assertEqual(step["if"], f"steps.{revision['id']}.outputs.current == 'true'")

        for main_sha, api_status, should_deploy in [
            ("candidate", 0, True), ("newer", 0, False), ("", 1, False),
        ]:
            with self.subTest(main_sha=main_sha), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                gh = root / "gh"
                gh.write_text('#!/bin/sh\necho "$MAIN_SHA"\nexit "$API_STATUS"\n')
                gh.chmod(0o755)
                output = root / "output"
                output.touch()
                result = subprocess.run(["bash", "-ec", revision["run"]], env={
                    **os.environ, "PATH": directory + os.pathsep + os.environ["PATH"],
                    "GITHUB_REPOSITORY": "owner/repo", "GITHUB_SHA": "candidate",
                    "GITHUB_OUTPUT": str(output), "GITHUB_STEP_SUMMARY": str(root / "summary"),
                    "MAIN_SHA": main_sha, "API_STATUS": str(api_status),
                })
                self.assertEqual(result.returncode, api_status)
                self.assertEqual("current=true" in output.read_text().splitlines(), should_deploy)


if __name__ == "__main__":
    WORKFLOW_PATHS = sys.argv[1:]
    unittest.main(argv=[sys.argv[0]])
