"""Exercise workflow Bazel invocations without running builds or deployments."""

import json
import os
import shlex
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml


class BazelCommandsTest(unittest.TestCase):
    def test_workflow_commands(self):
        calls = 0
        for path in WORKFLOWS:
            workflow = yaml.safe_load(path.read_text())
            for job_name, job in workflow.get("jobs", {}).items():
                with self.subTest(workflow=path, job=job_name):
                    calls += self.exercise_job(workflow, job)
        self.assertGreater(calls, 0, "no Bazel workflow commands were exercised")

    def exercise_job(self, workflow, job):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            prepare = root / ".github/workflows/prepare_ci.sh"
            prepare.parent.mkdir(parents=True)
            prepare.write_text("#!/bin/sh\nexit 0\n")
            prepare.chmod(0o755)
            log = root / "calls.jsonl"
            bazel = root / "bazel"
            bazel.write_text(
                f"#!{sys.executable}\n"
                "import json, os, sys\n"
                "with open(os.environ['BAZEL_CALLS'], 'a') as output:\n"
                "    output.write(json.dumps(sys.argv[1:]) + '\\n')\n"
                "if not sys.argv[1:] or sys.argv[1].startswith('-'):\n"
                "    sys.exit('Bazel command options appeared before the command')\n"
            )
            bazel.chmod(0o755)
            environment_file = root / "github-env"
            environment = {
                **os.environ,
                **workflow.get("env", {}),
                **job.get("env", {}),
                "RUNNER_TEMP": str(root),
                "GITHUB_ENV": str(environment_file),
                "BAZEL_CALLS": str(log),
            }
            for step in job.get("steps", []):
                script = step.get("run", "")
                if not isinstance(script, str):
                    continue
                # Exercise Bazel commands and preceding environment setup. Cloud
                # authentication actions and deployment tools are never invoked.
                configures_bazel = "BAZEL=" in script and "GITHUB_ENV" in script
                if "$BAZEL" not in script and not configures_bazel:
                    continue
                step_environment = {**environment, **step.get("env", {})}
                command = shlex.split(step_environment["BAZEL"])
                # Preserve any incorrectly prepended options so the command
                # double observes exactly the ordering that Bash would produce.
                step_environment["BAZEL"] = " ".join([str(bazel), *command[1:]])
                result = subprocess.run(
                    ["bash", "-eo", "pipefail", "-c", script],
                    cwd=root,
                    env=step_environment,
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertEqual(0, result.returncode, result.stderr)
                if environment_file.exists():
                    for line in environment_file.read_text().splitlines():
                        name, value = line.split("=", 1)
                        environment[name] = value
            recorded = [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []
            return len(recorded)


if __name__ == "__main__":
    WORKFLOWS = [Path(argument) for argument in sys.argv[1:]]
    unittest.main(argv=[sys.argv[0]])
