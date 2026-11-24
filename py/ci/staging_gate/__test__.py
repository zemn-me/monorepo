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
        jobs = self.workflows["staging.yml"]["jobs"]
        staging = jobs["Staging"]
        deploy = jobs[staging["needs"]]
        self.assertEqual(staging["if"], "always()")
        self.assertNotIn("if", deploy)
        self.assertEqual(deploy["concurrency"]["group"], "pulumi_deploy")
        for prerequisite in deploy["needs"]:
            self.assertNotEqual(
                jobs[prerequisite].get("concurrency", {}).get("group"), "pulumi_deploy"
            )
        self.assertIn(
            "Deploy candidate branch to Staging",
            [step.get("name") for step in deploy["steps"]],
        )

    def test_required_check_propagates_deployment_result(self):
        gate = self.workflows["staging.yml"]["jobs"]["Staging"]
        (step,) = gate["steps"]
        self.assertEqual(gate["needs"], "Deploy")
        self.assertEqual(step["env"]["DEPLOY_RESULT"], "${{ needs.Deploy.result }}")
        for result in ("success", "failure", "skipped", "cancelled"):
            with self.subTest(result=result):
                status = subprocess.run(
                    ["bash", "-ec", step["run"]], env={"DEPLOY_RESULT": result},
                ).returncode
                self.assertEqual(status == 0, result == "success")

    def test_pull_requests_can_enter_queue_without_deploying(self):
        self.assertEqual(
            staging_providers(self.workflows, "pull_request"), {"staging-pr.yml"}
        )
        self.assertNotIn("merge_group", self.workflows["staging-pr.yml"]["on"])

    def test_production_deploys_only_the_current_main_bundle(self):
        jobs = self.workflows["submit.yml"]["jobs"]
        deploy = jobs["Submit"]
        self.assertEqual(deploy["concurrency"]["group"], "pulumi_deploy")
        publisher = jobs[deploy["needs"]]
        self.assertNotEqual(publisher["concurrency"]["group"], "pulumi_deploy")
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
