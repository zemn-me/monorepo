"""Successful build steps stay quiet without losing failed-step diagnostics."""

from contextlib import redirect_stderr, redirect_stdout
import io
from pathlib import Path
import sys
import tempfile
import unittest

from project.tiberian_sun.web.build_engine import run_commands


class BuildOutputTest(unittest.TestCase):
    def test_success_keeps_both_streams_in_log(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "build.log"
            stdout, stderr = io.StringIO(), io.StringIO()
            command = [sys.executable, "-c", "import sys; print('output'); print('diagnostic', file=sys.stderr)"]
            with redirect_stdout(stdout), redirect_stderr(stderr):
                run_commands([command], None, log)
            self.assertEqual(stdout.getvalue(), "")
            self.assertEqual(stderr.getvalue(), "")
            self.assertIn("output", log.read_text())
            self.assertIn("diagnostic", log.read_text())

    def test_failure_replays_previous_and_current_output_and_stops(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "build.log"
            marker = Path(directory) / "must_not_exist"
            commands = [
                [sys.executable, "-c", "print('configure output')"],
                [sys.executable, "-c", "import sys; print('compiler output'); print('compiler error', file=sys.stderr); sys.exit(7)"],
                [sys.executable, "-c", "from pathlib import Path; import sys; Path(sys.argv[1]).touch()", str(marker)],
            ]
            stdout, stderr = io.StringIO(), io.StringIO()
            with redirect_stdout(stdout), redirect_stderr(stderr):
                with self.assertRaises(SystemExit) as error:
                    run_commands(commands, None, log)
            self.assertEqual(error.exception.code, 7)
            self.assertEqual(stdout.getvalue(), "")
            self.assertIn("configure output", stderr.getvalue())
            self.assertIn("compiler output", stderr.getvalue())
            self.assertIn("compiler error", stderr.getvalue())
            self.assertFalse(marker.exists())


if __name__ == "__main__":
    unittest.main()
