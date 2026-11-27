"""Verify a dispatched artifact before staging can acquire deployment credentials."""

import os
import re

from py.ci.find_deploy_bundle import github_api


def producer_run(api, artifact_id, ref, sha):
    if not ref.startswith("refs/heads/gh-readonly-queue/"):
        raise ValueError("Staging requires a merge-queue branch")
    if not re.fullmatch(r"[1-9][0-9]*", artifact_id):
        raise ValueError("Expected a numeric candidate artifact ID")

    artifact = api(f"artifacts/{artifact_id}")
    match = re.fullmatch(r"staging-candidate-([1-9][0-9]*)", artifact["name"])
    if not match or artifact["expired"]:
        raise ValueError("Expected an unexpired staging candidate")

    run_id = artifact["workflow_run"]["id"]
    attempt = int(match[1])
    path = f"runs/{run_id}/attempts/{attempt}"
    run = api(path)
    if (
        run["event"] != "merge_group"
        or run["path"] != ".github/workflows/presubmit.yml"
        or run["head_sha"] != sha
        or run["head_branch"] != ref.removeprefix("refs/heads/")
        or run["run_attempt"] != attempt
    ):
        raise ValueError("Candidate did not come from Presubmit on this merge-group ref and SHA")

    # The dispatcher is part of this run and may still be finishing.
    jobs = api(f"{path}/jobs", per_page=100)["jobs"]
    if not any(job["name"] == "Build candidate" and job["conclusion"] == "success" for job in jobs):
        raise ValueError("The candidate build did not succeed in this attempt")
    return run_id


if __name__ == "__main__":
    run = producer_run(
        github_api, os.environ["ARTIFACT_ID"], os.environ["GITHUB_REF"], os.environ["GITHUB_SHA"]
    )
    with open(os.environ["GITHUB_OUTPUT"], "a") as output:
        print(f"run-id={run}", file=output)
