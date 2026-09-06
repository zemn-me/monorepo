"""Remove pending deployments for merge-group commits that no longer exist."""

import json
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen


class GitHub:
    def __init__(self, repository, token, api_url="https://api.github.com"):
        self.base_url = f"{api_url}/repos/{repository}"
        self.token = token

    def request(self, path, method="GET"):
        request = Request(
            self.base_url + path,
            method=method,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
        try:
            with urlopen(request, timeout=30) as response:
                body = response.read()
                return json.loads(body) if body else None
        except HTTPError as error:
            error.close()
            raise

    def pending_staging_runs(self):
        # Finish pagination before cancelling: cancellations remove entries from
        # this filtered list and would otherwise shift subsequent pages.
        runs = []
        page = 1
        while True:
            result = self.request(
                "/actions/workflows/staging.yml/runs"
                f"?event=merge_group&status=pending&per_page=100&page={page}"
            )["workflow_runs"]
            runs.extend(result)
            if len(result) < 100:
                return runs
            page += 1

    def obsolete(self, run):
        branch = quote(run["head_branch"], safe="/")
        try:
            ref = self.request(f"/git/ref/heads/{branch}")
        except HTTPError as error:
            if error.code != 404:
                raise
            return True
        return ref["object"]["sha"] != run["head_sha"]


def is_pending_staging(run):
    return (
        run["status"] == "pending"
        and run["event"] == "merge_group"
        and run["path"] == ".github/workflows/staging.yml"
        and run["head_branch"].startswith("gh-readonly-queue/")
    )


def cleanup(github, execute=False):
    for listed in github.pending_staging_runs():
        if not is_pending_staging(listed) or not github.obsolete(listed):
            continue
        # A run may have acquired the deployment lock since it was listed.
        # Recheck both its status and ref immediately before requesting cancel.
        run = github.request(f"/actions/runs/{listed['id']}")
        if not is_pending_staging(run) or not github.obsolete(run):
            continue
        if not execute:
            print(f"Would cancel obsolete pending Staging run {run['id']}")
            continue
        try:
            github.request(f"/actions/runs/{run['id']}/cancel", method="POST")
        except HTTPError as error:
            # Completion or another cleanup can win the cancellation race.
            if error.code != 409:
                raise
            print(f"Staging run {run['id']} no longer accepts cancellation")
        else:
            print(f"Requested cancellation of obsolete pending Staging run {run['id']}")
