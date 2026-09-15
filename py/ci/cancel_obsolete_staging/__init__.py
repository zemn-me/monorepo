"""Cancel obsolete merge-group checks and pending staging deployments."""

import json
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen


# Presubmit only runs checks, so obsolete running attempts can be cancelled.
# Staging deploys infrastructure; preserve deployments already underway.
CANCELLABLE_STATUSES = {
    "staging.yml": ("pending", "queued"),
    "presubmit.yml": ("pending", "queued", "in_progress"),
}


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

    def candidate_runs(self):
        # Finish pagination before cancelling: cancellations remove entries from
        # these filtered lists and would otherwise shift subsequent pages.
        runs = {}
        for workflow, statuses in CANCELLABLE_STATUSES.items():
            for status in statuses:
                page = 1
                while True:
                    result = self.request(
                        f"/actions/workflows/{workflow}/runs"
                        f"?event=merge_group&status={status}&per_page=100&page={page}"
                    )["workflow_runs"]
                    # A run may move between status lists while we paginate.
                    runs.update((run["id"], run) for run in result)
                    if len(result) < 100:
                        break
                    page += 1
        return runs.values()

    def obsolete(self, run):
        branch = quote(run["head_branch"], safe="/")
        try:
            ref = self.request(f"/git/ref/heads/{branch}")
        except HTTPError as error:
            if error.code != 404:
                raise
            return True
        return ref["object"]["sha"] != run["head_sha"]


def is_cancellable(run):
    return (
        run["event"] == "merge_group"
        and run["head_branch"].startswith("gh-readonly-queue/")
        and any(
            run["path"] == f".github/workflows/{workflow}"
            and run["status"] in statuses
            for workflow, statuses in CANCELLABLE_STATUSES.items()
        )
    )


def cleanup(github, execute=False):
    for listed in github.candidate_runs():
        if not is_cancellable(listed) or not github.obsolete(listed):
            continue
        # A run may have acquired the deployment lock since it was listed.
        # Recheck both its status and ref immediately before requesting cancel.
        run = github.request(f"/actions/runs/{listed['id']}")
        if not is_cancellable(run) or not github.obsolete(run):
            continue
        label = f"{run['path']} run {run['id']}"
        if not execute:
            print(f"Would cancel obsolete {label}")
            continue
        try:
            github.request(f"/actions/runs/{run['id']}/cancel", method="POST")
        except HTTPError as error:
            # Completion or another cleanup can win the cancellation race.
            if error.code != 409:
                raise
            print(f"{label} no longer accepts cancellation")
        else:
            print(f"Requested cancellation of obsolete {label}")
