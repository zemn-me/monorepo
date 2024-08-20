#!/usr/bin/env python3

"Runs ibazel. But runs it in the workspace root."

from os import environ
import subprocess
from sys import argv
from rules_python.python.runfiles import runfiles


subprocess.Popen(
    [runfiles.resolve(environ["IBAZEL_BINARY"])] + argv[1:],
	cwd = environ["BUILD_WORKING_DIRECTORY"]
).wait()

