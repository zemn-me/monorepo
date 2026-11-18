"""Keep YAML parser failures visible through the workflow linter's public CLI."""

import pathlib
import subprocess
import sys
import tempfile
import unittest


ACTIONLINT = str(pathlib.Path(sys.argv.pop()).resolve())


class ActionlintDiagnosticsTest(unittest.TestCase):
    def lint(self, workflow, metadata=None):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root / ".git").mkdir()
            workflows = root / ".github/workflows"
            workflows.mkdir(parents=True)
            path = workflows / "test.yml"
            path.write_text(workflow)
            if metadata is not None:
                action = root / ".github/actions/local"
                action.mkdir(parents=True)
                (action / "action.yml").write_text(metadata)
            return subprocess.run(
                [ACTIONLINT, "-shellcheck=", "-pyflakes=", str(path)],
                cwd=root,
                capture_output=True,
                text=True,
                check=False,
            )

    def test_valid_workflow(self):
        result = self.lint("on: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n")
        self.assertEqual(result.returncode, 0, (result.stdout + result.stderr))

    def test_parser_error_retains_source_position(self):
        result = self.lint("on: push\njobs: [\n")
        self.assertEqual(result.returncode, 1, (result.stdout + result.stderr))
        self.assertIn("syntax-check", (result.stdout + result.stderr))
        self.assertRegex((result.stdout + result.stderr), r"test.yml:[23]:[1-9][0-9]*:")
        self.assertIn("could not parse as YAML", (result.stdout + result.stderr))

    def test_action_metadata_type_errors_are_reported(self):
        result = self.lint(
            "on: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: ./.github/actions/local\n",
            "name: local\ndescription: test\nruns:\n  using: [node24]\n  main: {invalid: value}\n",
        )
        self.assertEqual(result.returncode, 1, (result.stdout + result.stderr))
        self.assertIn("could not parse action metadata", (result.stdout + result.stderr))
        self.assertIn("cannot construct !!seq into string", (result.stdout + result.stderr))
        self.assertIn("cannot construct !!map into string", (result.stdout + result.stderr))
        self.assertIn("string", (result.stdout + result.stderr))


if __name__ == "__main__":
    unittest.main()
