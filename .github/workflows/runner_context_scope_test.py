"""Guard the runner-context scope that can prevent deployment jobs starting."""

import re
import sys
import unittest
from pathlib import Path

import yaml


def runner_env_errors(workflow):
    # GitHub evaluates workflow/job env before runner contexts are available.
    # Step env and run scripts may use runner context or $RUNNER_TEMP instead.
    # https://docs.github.com/en/actions/reference/workflows-and-actions/contexts
    scopes = [("env", workflow.get("env", {}))]
    for name, job in workflow.get("jobs", {}).items():
        scopes.append((f"jobs.{name}.env", job.get("env", {})))
    errors = []
    for scope, variables in scopes:
        for name, value in variables.items():
            for expression in re.findall(r"\$\{\{(.*?)\}\}", str(value), re.DOTALL):
                # A quoted string can mention runner without using its context.
                expression = re.sub(r"'(?:[^']|'')*'", "''", expression)
                if re.search(r"(?<![\w.])runner\b", expression):
                    errors.append(f"{scope}.{name}: runner context requires step scope")
    return errors


class RunnerContextScopeTest(unittest.TestCase):
    def test_repository_workflows(self):
        self.assertTrue(WORKFLOWS, "no workflows supplied to regression check")
        for path in WORKFLOWS:
            with self.subTest(workflow=path):
                workflow = yaml.safe_load(path.read_text())
                self.assertEqual([], runner_env_errors(workflow))

    def test_rejects_failed_staging_configuration(self):
        command = "./sh/bin/bazel --distdir=${{ runner.temp }}/bazel-distdir/ape"
        for scope in ("workflow", "job"):
            with self.subTest(scope=scope):
                workflow = {"env": {"BAZEL": command}} if scope == "workflow" else {
                    "jobs": {"Staging": {"env": {"BAZEL": command}}}
                }
                self.assertEqual(1, len(runner_env_errors(workflow)))

    def test_context_syntax_and_literals(self):
        for expression in ("runner.temp", "runner['temp']", "format('{0}', runner.temp)"):
            with self.subTest(expression=expression):
                self.assertTrue(runner_env_errors({"env": {"PATH": "${{ " + expression + " }}"}}))
        self.assertEqual([], runner_env_errors({"env": {"TEXT": "${{ 'runner.temp' }}"}}))

    def test_allows_runner_context_in_steps(self):
        workflow = {"jobs": {"Staging": {"steps": [
            {"env": {"PATH": "${{ runner.temp }}"}},
            {"run": 'echo "BAZEL=./sh/bin/bazel --distdir=$RUNNER_TEMP/archives" >> "$GITHUB_ENV"'},
        ]}}}
        self.assertEqual([], runner_env_errors(workflow))


if __name__ == "__main__":
    WORKFLOWS = [Path(argument) for argument in sys.argv[1:]]
    unittest.main(argv=[sys.argv[0]])
