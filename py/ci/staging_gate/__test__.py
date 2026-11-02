"""Keep the required Staging check tied to deployment in the merge queue."""

from pathlib import Path
import sys
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
        self.assertIn(
            "Deploy candidate branch to Staging",
            [step.get("name") for step in staging["steps"]],
        )

    def test_pull_requests_can_enter_queue_without_deploying(self):
        self.assertEqual(
            staging_providers(self.workflows, "pull_request"), {"staging-pr.yml"}
        )
        self.assertNotIn("merge_group", self.workflows["staging-pr.yml"]["on"])


if __name__ == "__main__":
    WORKFLOW_PATHS = sys.argv[1:]
    unittest.main(argv=[sys.argv[0]])
