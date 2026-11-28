"""Test candidate provenance at the GitHub Actions API boundary."""

import unittest

from py.ci.verify_staging_candidate import producer_run


class VerifyStagingCandidateTest(unittest.TestCase):
    ref = "refs/heads/gh-readonly-queue/main/pr-42-example"

    def setUp(self):
        self.artifact = {"name": "staging-candidate-2", "expired": False, "workflow_run": {"id": 42}}
        self.run = {
            "event": "merge_group",
            "path": ".github/workflows/presubmit.yml",
            "run_attempt": 2,
            "head_branch": self.ref.removeprefix("refs/heads/"),
            "head_sha": "abc",
        }
        self.job = {"name": "Build candidate", "conclusion": "success"}

    def api(self, path, **query):
        if path == "artifacts/123":
            return self.artifact
        if path == "runs/42/attempts/2":
            return self.run
        self.assertEqual(path, "runs/42/attempts/2/jobs")
        return {"jobs": [self.job, {"name": "Presubmit", "conclusion": None}]}

    def test_successful_build_while_dispatcher_is_finishing(self):
        self.assertEqual(producer_run(self.api, "123", self.ref, "abc"), 42)

    def test_invalid_artifact_or_ref_is_rejected_before_lookup(self):
        for artifact, ref in [("123", "refs/heads/main"), ("", self.ref), ("123/../1", self.ref)]:
            with self.subTest(artifact=artifact, ref=ref), self.assertRaises(ValueError):
                producer_run(None, artifact, ref, "abc")

    def test_unrelated_or_expired_archive_is_rejected(self):
        artifact = self.artifact
        for override in [{"name": "staging-main-2"}, {"expired": True}]:
            self.artifact = artifact | override
            with self.subTest(override=override), self.assertRaises(ValueError):
                producer_run(self.api, "123", self.ref, "abc")

    def test_run_must_match_queue_workflow_ref_sha_and_attempt(self):
        run = self.run
        for override in [
            {"event": "pull_request"}, {"head_sha": "other"}, {"head_branch": "other"},
            {"run_attempt": 1}, {"path": ".github/workflows/other.yml"},
        ]:
            self.run = run | override
            with self.subTest(override=override), self.assertRaises(ValueError):
                producer_run(self.api, "123", self.ref, "abc")

    def test_failed_cancelled_unfinished_or_unrelated_job_is_rejected(self):
        for name, result in [
            ("Build candidate", "failure"), ("Build candidate", "cancelled"),
            ("Build candidate", None), ("Other", "success"),
        ]:
            self.job = {"name": name, "conclusion": result}
            with self.subTest(name=name, result=result), self.assertRaises(ValueError):
                producer_run(self.api, "123", self.ref, "abc")


if __name__ == "__main__":
    unittest.main()
