"""
This module implements the bazel lockfile merge driver.

Arguments should be %A
%A: our commit from the current branch
%O: original commit or the base commit from which our current branch and the other branch diverged
%B: the commit for the other branch
"""

from argparse import ArgumentParser
from os import environ as env
from shutil import copyfileobj
from subprocess import run
from tempfile import TemporaryFile
from typing import Iterable, Optional


def main(argv: Optional[Iterable[str]] = None) -> int:
    parser = ArgumentParser(
        prog="bazel-lockfile-merge-driver",
        description="A git merge driver for the bazel lockfile.",
    )

    parser.add_argument(
        "original_commit",
        help="original commit or base commit (%O)",
    )

    parser.add_argument(
        "our_commit",
        help="our commit from the current branch (%A)",
    )

    parser.add_argument(
        "other_commit",
        help="commit from the other branch (%B)",
    )

    args = parser.parse_args(argv)

    jq_bin = env["JQ_BINARY"]
    jq_script = env["JQ_SCRIPT"]

    original = args.original_commit
    ours = args.our_commit
    other = args.other_commit

    with TemporaryFile() as tmp_file:
        run(
            [
                jq_bin,
                "--from-file",
                jq_script,
                "-s",
                "--",
                original,
                ours,
                other,
            ],
            stdout=tmp_file,
            check=True,
        )

        with open(ours, "r+") as target:
            tmp_file.seek(0)
            copyfileobj(tmp_file, target)
            target.truncate()

    return 0
