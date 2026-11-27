"""Run the checked-in deployment workflows through act with offline service fixtures."""

import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml


# act evaluates the real job graph and expressions. Replace only external actions
# and service entry points. An unknown action must not silently become a no-op.
ACTIONS = {
    "actions/checkout": ("checkout", ["path"]),
    "actions/upload-artifact": ("upload", ["name", "path", "if-no-files-found"]),
    "actions/download-artifact": ("download", ["run-id", "name", "path"]),
    "aws-actions/configure-aws-credentials": None,
    "google-github-actions/auth": None,
    "google-github-actions/get-secretmanager-secrets": None,
    "jlumbroso/free-disk-space": None,
}
QUEUE_BRANCH = "gh-readonly-queue/main/pr-1"


class WorkflowTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()
        self.store = self.root / "artifacts"
        self.trace = self.root / "deployments"
        self.trace.touch()
        self.actions = {}
        for source in SOURCES:
            dest = self.repo / source
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(source, dest)
            if source.suffix == ".yml":
                doc = yaml.load(source.read_text(), Loader=yaml.BaseLoader)
                if source.parent.name == "workflows":
                    # act 0.2.98 rejects the hosted runner's concurrency.queue key.
                    # Strip just that scheduler setting from the emulator copy.
                    dest.write_text(re.sub(r"^ +queue: (max|single)\n", "", source.read_text(), flags=re.MULTILINE))
                if source.parent.name == "workflows" and source.stem not in ("presubmit", "staging", "staging-pr", "submit"):
                    continue
                jobs = doc.get("jobs", {"action": doc.get("runs", {})})
                for job in jobs.values():
                    for step in job.get("steps", []):
                        uses = step.get("uses", "")
                        action = uses.partition("@")[0]
                        if "@" in uses and uses not in self.actions:
                            self.actions[uses] = self.action(action)
        self.bin = self.root / "bin"
        self.launcher(self.bin / "gh", "gh")
        # Advance the polling loop immediately between fixture responses.
        (self.bin / "sleep").write_text('#!/bin/sh\ntest "$1" = 30\n')
        (self.bin / "sleep").chmod(0o755)
        self.launcher(self.repo / "sh/bin/bazel", "bazel")
        self.launcher(self.repo / "ci/deploy/run.sh", "deploy")
        # Only the fixture repo is visible to workflow checkouts.
        self.git("init", "-q", "-b", "main")
        self.git("remote", "add", "origin", "https://github.com/owner/repo")
        self.git("add", ".")
        self.git("-c", "user.name=Test", "-c", "user.email=test@example.org",
                 "-c", "commit.gpgsign=false", "commit", "-qm", "workflow fixture")
        self.sha = self.git("rev-parse", "HEAD")

    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.repo, text=True,
                                       env={"PATH": os.defpath, "HOME": str(self.root), "GIT_CONFIG_NOSYSTEM": "1"}).strip()

    def launcher(self, path, service):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f'#!/bin/sh\nexec "$FIXTURE_PYTHON" "$FIXTURE_SERVICE" {service} "$@"\n')
        path.chmod(0o755)

    def action(self, name):
        dest = self.root / "actions" / name
        dest.mkdir(parents=True, exist_ok=True)
        spec = ACTIONS[name]
        inputs = spec[1] if spec else []
        step = {"shell": "bash", "run": "true"}
        if spec:
            environment = {f"ARG_{i}": "${{ inputs." + key + " }}" for i, key in enumerate(inputs)}
            arguments = " ".join(f'"${key}"' for key in environment)
            step.update(env=environment, run=f'"$FIXTURE_PYTHON" "$FIXTURE_SERVICE" {spec[0]} {arguments}')
        (dest / "action.yml").write_text(yaml.safe_dump({
            "name": name, "description": "Local service fixture",
            "inputs": {key: {"description": key, "default": ""} for key in inputs},
            "runs": {"using": "composite", "steps": [step]},
        }))
        return dest

    def workflow(self, name, event, job, *, success=True, **overrides):
        if event == "merge_group":
            self.git("checkout", "-qB", QUEUE_BRANCH)
        payload = {"ref": "refs/heads/main", "after": self.sha, "number": 1,
                   "pull_request": {"number": 1, "base": {"ref": "main"}}}
        event_path = self.root / "event.json"
        event_path.write_text(json.dumps(payload))
        command = [
            str(ACT), event, "-W", f".github/workflows/{name}.yml", "-j", job,
            "-P", "ubuntu-latest=-self-hosted", "-e", str(event_path),
            "--json", "--no-cache-server", "--action-offline-mode", "--no-skip-checkout",
            "--action-cache-path", str(self.root / "cache"),
            "--env", "GITHUB_RUN_ID=42", "--env", "GITHUB_RUN_ATTEMPT=3",
        ]
        if event == "merge_group":
            # act does not derive the synthetic queue ref from the merge_group payload.
            command.extend(["--env", f"GITHUB_REF=refs/heads/{QUEUE_BRANCH}", "--env", f"GITHUB_REF_NAME={QUEUE_BRANCH}"])
        for uses, path in self.actions.items():
            command.extend(["--local-repository", f"{uses}={path}"])
        result = subprocess.run(command, cwd=self.repo, capture_output=True, text=True, timeout=40, env={
            "PATH": str(self.bin) + os.pathsep + os.defpath, "HOME": str(self.root),
            "FIXTURE_PYTHON": sys.executable, "FIXTURE_SERVICE": str(FIXTURE),
            "FIXTURE_REPO": str(self.repo), "FIXTURE_STORE": str(self.store),
            "FIXTURE_DEPLOYMENTS": str(self.trace), "FIXTURE_SHA": self.sha,
            "MAIN_SHA": self.sha, "PRODUCER_RESULT": "success", "FAIL_DEPLOY": "", "FAIL_PRESUBMIT": "false",
            **overrides,
        })
        log = result.stdout + result.stderr
        self.assertEqual(result.returncode == 0, success, log)
        # An earlier failure can set the process exit code even if act skipped
        # the required gate. Check the result of the requested job itself.
        records = [json.loads(line) for line in log.splitlines() if line.startswith("{")]
        outcomes = [r["jobResult"] for r in records if r.get("jobID") == job and "jobResult" in r]
        self.assertEqual(outcomes, ["success" if success else "failure"], log)

    def publish_main(self, sha):
        dest = self.store / "11" / ("deploy-v2-main-" + sha)
        dest.mkdir(parents=True)
        for filename in ("layers_bundle.tar.gz", "runfile_aliases.tar"):
            (dest / filename).write_text(sha)

    def test_merge_group_deploys_the_tested_bundle_after_main(self):
        self.publish_main("pinned-main")
        self.workflow("presubmit", "merge_group", "Presubmit")
        self.workflow("staging", "merge_group", "Staging", MAIN_SHA="pinned-main")
        self.assertEqual(self.trace.read_text().splitlines(), ["main pinned-main", f"candidate {self.sha}"])

    def test_failed_checks_and_deployments_fail_the_required_gate(self):
        self.publish_main("pinned-main")
        self.workflow("presubmit", "merge_group", "Presubmit", success=False, FAIL_PRESUBMIT="true")
        self.assertFalse((self.store / "42").exists())
        for conclusion in ("failure", "cancelled"):
            self.workflow("staging", "merge_group", "Staging", success=False,
                                MAIN_SHA="pinned-main", PRODUCER_RESULT=conclusion)
            self.assertEqual(self.trace.read_text(), "")
        self.workflow("presubmit", "merge_group", "Presubmit")
        for failure, deployed in (("main", ["main pinned-main"]),
                                  ("candidate", ["main pinned-main", f"candidate {self.sha}"])):
            self.trace.write_text("")
            self.workflow("staging", "merge_group", "Staging", success=False, MAIN_SHA="pinned-main", FAIL_DEPLOY=failure)
            self.assertEqual(self.trace.read_text().splitlines(), deployed)

    def test_pull_request_runs_checks_without_publishing_or_deploying(self):
        self.workflow("presubmit", "pull_request", "Presubmit")
        self.workflow("staging-pr", "pull_request", "Staging")
        self.assertFalse(self.store.exists())
        self.assertEqual(self.trace.read_text(), "")

    def test_production_checks_main_before_deploying(self):
        self.publish_main(self.sha)
        for current, success, failure in (("newer", True, ""), ("api-error", False, ""),
                                         (self.sha, False, "production"), (self.sha, True, "")):
            self.trace.write_text("")
            self.workflow("submit", "push", "Submit", success=success, MAIN_SHA=current, FAIL_DEPLOY=failure)
            expected = [f"production {self.sha}"] if current == self.sha else []
            self.assertEqual(self.trace.read_text().splitlines(), expected)

    def test_hosted_runner_contracts(self):
        # act ignores permissions and concurrency. GitHub also treats skipped
        # jobs as successful required checks, regardless of duplicate providers.
        workflows = {p.stem: yaml.load(p.read_text(), Loader=yaml.BaseLoader)
                     for p in SOURCES if p.parent.name == "workflows" and p.suffix == ".yml"}
        for event, expected in (("merge_group", "staging"), ("pull_request", "staging-pr")):
            providers = [name for name, workflow in workflows.items() if event in workflow["on"]
                         for key, job in workflow["jobs"].items() if job.get("name", key) == "Staging"]
            self.assertEqual(providers, [expected])
        for workflow, deploy in (("staging", "Deploy"), ("submit", "Submit")):
            jobs = workflows[workflow]["jobs"]
            self.assertEqual(jobs[deploy]["concurrency"]["queue"], "max")
            for key, job in jobs.items():
                self.assertEqual(job.get("concurrency", {}).get("group") == "pulumi_deploy", key == deploy)
        self.assertEqual(workflows["staging"]["jobs"]["CandidateBundle"]["permissions"], {"actions": "read"})


if __name__ == "__main__":
    ACT = Path(sys.argv[1]).resolve()
    FIXTURE = Path(sys.argv[2]).resolve()
    SOURCES = [Path(name) for name in sys.argv[3:]]
    unittest.main(argv=[sys.argv[0]])
