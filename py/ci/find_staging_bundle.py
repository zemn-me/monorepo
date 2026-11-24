"""Find an unexpired staging bundle published by Submit for this main commit."""

import json
import os
import subprocess


def published_run(api, sha):
    runs = api(
        "workflows/submit.yml/runs", branch="main", event="push", head_sha=sha,
    )["workflow_runs"]
    name = f"staging-main-{sha}"
    for run in runs:
        artifacts = api(f"runs/{run['id']}/artifacts", name=name)["artifacts"]
        if any(a["name"] == name and not a["expired"] for a in artifacts):
            return run["id"]
    return None


def github_api(path, **query):
    endpoint = f"repos/{os.environ['GITHUB_REPOSITORY']}/actions/{path}"
    command = ["gh", "api", "--method", "GET", endpoint]
    for key, value in query.items():
        command.extend(["-f", f"{key}={value}"])
    return json.loads(subprocess.check_output(command))


if __name__ == "__main__":
    run = published_run(github_api, os.environ["MAIN_SHA"])
    if run is not None:
        with open(os.environ["GITHUB_OUTPUT"], "a") as output:
            print(f"run-id={run}", file=output)
