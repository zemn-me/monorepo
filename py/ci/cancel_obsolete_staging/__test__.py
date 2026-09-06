"""Exercise cleanup against a local GitHub API server, including cancellation."""

import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.error import HTTPError

from py.ci.cancel_obsolete_staging import GitHub, cleanup


RUN = {
    "id": 1,
    "status": "pending",
    "event": "merge_group",
    "path": ".github/workflows/staging.yml",
    "head_branch": "gh-readonly-queue/main/pr-42-old",
    "head_sha": "candidate-sha",
}
LIST = "/actions/workflows/staging.yml/runs?event=merge_group&status=pending&per_page=100&page="
REF = "/git/ref/heads/" + RUN["head_branch"]


class CleanupTest(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.responses = {
            ("GET", LIST + "1"): (200, {"workflow_runs": [RUN]}),
            ("GET", REF): (404, {"message": "Not Found"}),
            ("GET", "/actions/runs/1"): (200, RUN),
            ("POST", "/actions/runs/1/cancel"): (202, None),
        }
        test = self

        class Handler(BaseHTTPRequestHandler):
            def respond(self):
                path = self.path.removeprefix("/repos/owner/repo")
                test.calls.append((self.command, path))
                if self.headers.get("Authorization") != "Bearer test-token":
                    self.send_error(401)
                    return
                response = test.responses.get((self.command, path), (500, {}))
                if callable(response):
                    response = response()
                status, body = response
                self.send_response(status)
                self.end_headers()
                if body is not None:
                    self.wfile.write(json.dumps(body).encode())

            do_GET = respond
            do_POST = respond

            def log_message(self, *args):
                pass

        self.server = HTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.start()
        self.addCleanup(self.stop_server)
        self.github = GitHub(
            "owner/repo", "test-token",
            f"http://127.0.0.1:{self.server.server_port}",
        )

    def stop_server(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()

    def cancellations(self):
        return [path for method, path in self.calls if method == "POST"]

    def test_deleted_merge_group_is_cancelled(self):
        cleanup(self.github, execute=True)
        self.assertEqual(self.cancellations(), ["/actions/runs/1/cancel"])
        self.assertEqual(self.calls[-3:], [
            ("GET", "/actions/runs/1"), ("GET", REF),
            ("POST", "/actions/runs/1/cancel"),
        ])

    def test_current_merge_group_is_preserved(self):
        self.responses["GET", REF] = (200, {"object": {"sha": RUN["head_sha"]}})
        cleanup(self.github, execute=True)
        self.assertEqual(self.cancellations(), [])

    def test_replaced_merge_group_sha_is_cancelled(self):
        self.responses["GET", REF] = (200, {"object": {"sha": "replacement-sha"}})
        cleanup(self.github, execute=True)
        self.assertEqual(self.cancellations(), ["/actions/runs/1/cancel"])

    def test_preview_does_not_cancel(self):
        cleanup(self.github)
        self.assertEqual(self.cancellations(), [])

    def test_started_or_finished_run_is_preserved(self):
        for status in ["in_progress", "completed", "queued", "waiting"]:
            with self.subTest(status=status):
                self.responses["GET", "/actions/runs/1"] = (200, RUN | {"status": status})
                cleanup(self.github, execute=True)
                self.assertEqual(self.cancellations(), [])

    def test_ref_restored_before_cancel_is_preserved(self):
        responses = iter([
            (404, {}),
            (200, {"object": {"sha": RUN["head_sha"]}}),
        ])
        self.responses["GET", REF] = lambda: next(responses)
        cleanup(self.github, execute=True)
        self.assertEqual(self.cancellations(), [])

    def test_unrelated_runs_are_preserved(self):
        for changes in [
            {"path": ".github/workflows/submit.yml"},
            {"event": "pull_request"},
            {"head_branch": "main"},
            {"status": "in_progress"},
        ]:
            with self.subTest(changes=changes):
                self.responses["GET", LIST + "1"] = (200, {"workflow_runs": [RUN | changes]})
                cleanup(self.github, execute=True)
                self.assertEqual(self.cancellations(), [])
                self.assertNotIn(("GET", REF), self.calls)

    def test_api_errors_do_not_mean_branch_deleted(self):
        for status in [401, 403, 429, 500]:
            with self.subTest(status=status):
                self.responses["GET", REF] = (status, {})
                with self.assertRaises(HTTPError):
                    cleanup(self.github, execute=True)
                self.assertEqual(self.cancellations(), [])

    def test_conflict_does_not_stop_cleanup(self):
        self.responses["POST", "/actions/runs/1/cancel"] = (409, {})
        cleanup(self.github, execute=True)
        self.assertEqual(self.cancellations(), ["/actions/runs/1/cancel"])

    def test_cancel_permission_error_is_reported(self):
        self.responses["POST", "/actions/runs/1/cancel"] = (403, {})
        with self.assertRaises(HTTPError):
            cleanup(self.github, execute=True)

    def test_all_pages_are_read_before_cancellation(self):
        unrelated = RUN | {"path": ".github/workflows/submit.yml"}
        self.responses["GET", LIST + "1"] = (200, {"workflow_runs": [RUN] + [unrelated] * 99})
        second = RUN | {"id": 2, "head_branch": "gh-readonly-queue/main/pr-43-old"}
        self.responses["GET", LIST + "2"] = (200, {"workflow_runs": [second]})
        self.responses["GET", "/actions/runs/2"] = (200, second)
        self.responses["GET", "/git/ref/heads/" + second["head_branch"]] = (404, {})
        self.responses["POST", "/actions/runs/2/cancel"] = (202, None)
        cleanup(self.github, execute=True)
        self.assertEqual(self.calls[:2], [("GET", LIST + "1"), ("GET", LIST + "2")])
        self.assertEqual(self.cancellations(), ["/actions/runs/1/cancel", "/actions/runs/2/cancel"])

    def test_list_error_cancels_nothing(self):
        self.responses["GET", LIST + "1"] = (500, {})
        with self.assertRaises(HTTPError):
            cleanup(self.github, execute=True)
        self.assertEqual(self.cancellations(), [])

    def test_refresh_error_cancels_nothing(self):
        self.responses["GET", "/actions/runs/1"] = (404, {})
        with self.assertRaises(HTTPError):
            cleanup(self.github, execute=True)
        self.assertEqual(self.cancellations(), [])


if __name__ == "__main__":
    unittest.main()
