"""
This file puts together the kebab that is
the bazel lockfile merge driver.

see: https://bazel.build/external/lockfile#merge-conflicts

arguments should be %A
%A: our commit from the current branch
%O: original commit or the base commit from which our current branch and the other branch diverged
%B: the commit for the other branch
"""
from os import environ as env
from subprocess import run
from argparse import ArgumentParser
from tempfile import TemporaryFile
from shutil import copyfileobj
from rules_python.python.runfiles import runfiles


if __name__ != "__main__":
	raise Exception("don’t import this!")

parser = ArgumentParser(
	prog='bazel-lockfile-merge-driver',
	description='A git merge driver for the bazel lockfile.',
)

parser.add_argument(
	'original_commit',
	help='original commit or base commit (%%O)',
)

parser.add_argument(
	'our_commit',
	help='our commit from the current branch (%%A)'
)

parser.add_argument(
	'other_commit',
	help='commit from the other branch (%%B)',
)

args = parser.parse_args()
r = runfiles.Create()

jq_bin = r.Rlocation(env["JQ_BINARY"])
jq_script = r.Rlocation(env["JQ_SCRIPT"])

O: str = args.original_commit
A: str = args.our_commit
B: str = args.other_commit

target_temp_file = "{}.jq"

with TemporaryFile() as tmp_file:
	run([
			jq_bin,
			'--from-file',
			jq_script,
			'-s',
			'--',
			O,
			A,
			B
		],
		stdout=tmp_file,
		check=True,
	)

	with open(A) as target:
		tmp_file.seek(0)
		copyfileobj(tmp_file, target)




