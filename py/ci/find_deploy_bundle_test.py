"""Cover main bundle reuse and fallback at the GitHub API boundary."""

import unittest

from py.ci.find_deploy_bundle import published_run


class PublishedBundleTest(unittest.TestCase):
    def test_reuses_the_matching_main_push(self):
        def api(path, **query):
            if path == "workflows/submit.yml/runs":
                self.assertEqual(query, dict(branch="main", event="push", head_sha="abc"))
                return {"workflow_runs": [{"id": 42}]}
            self.assertEqual(path, "runs/42/artifacts")
            self.assertEqual(query, {"name": "deploy-main-abc"})
            return {"artifacts": [{"name": "deploy-main-abc", "expired": False}]}

        self.assertEqual(published_run(api, "abc"), 42)

    def test_no_push_run_means_build_locally(self):
        self.assertIsNone(published_run(lambda *a, **kw: {"workflow_runs": []}, "abc"))

    def test_expired_bundle_and_other_revisions_are_misses(self):
        artifacts = [
            {"name": "deploy-main-abc", "expired": True},
            {"name": "deploy-main-older", "expired": False},
            {"name": "staging-main-abc", "expired": False},
            {"name": "staging-candidate", "expired": False},
        ]
        def api(path, **query):
            if path == "workflows/submit.yml/runs":
                return {"workflow_runs": [{"id": 42}]}
            return {"artifacts": artifacts}

        self.assertIsNone(published_run(api, "abc"))

    def test_repeated_push_can_reuse_the_earlier_publication(self):
        def api(path, **query):
            if path == "workflows/submit.yml/runs":
                return {"workflow_runs": [{"id": 99}, {"id": 42}]}
            if path == "runs/99/artifacts":
                return {"artifacts": []}
            self.assertEqual(path, "runs/42/artifacts")
            return {"artifacts": [{"name": "deploy-main-abc", "expired": False}]}

        self.assertEqual(published_run(api, "abc"), 42)


if __name__ == "__main__":
    unittest.main()
