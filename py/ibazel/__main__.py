#!/usr/bin/env python3

"Runs ibazel. But runs it in the workspace root."

from os import environ
import subprocess
from sys import argv
from python import runfiles

r = runfiles.Runfiles.Create()


if r is None:
	raise Exception("unable to make Runfiles.")



ibazel_binary_path = path = r.Rlocation(environ["IBAZEL_BINARY"])

if ibazel_binary_path is None:
    raise Exception("cannot locate ibazel")


subprocess.Popen(
    [ ibazel_binary_path ] + argv[1:],
	cwd = environ["BUILD_WORKING_DIRECTORY"]
).wait()

