"""Offline stand-ins for the build, artifact store, GitHub API and deployment service."""

import json
import os
from pathlib import Path
import shutil
import sys


ARCHIVES = ("layers_bundle.tar.gz", "runfile_aliases.tar")
env = os.environ


def artifact(run, name):
    return Path(env["FIXTURE_STORE"]) / run / name


def gh(args):
    if args[:2] == ["run", "list"]:
        expected = {
            "--repo": "owner/repo", "--workflow": "presubmit.yml", "--event": "merge_group",
            "--commit": env["FIXTURE_SHA"], "--branch": "gh-readonly-queue/main/pr-1",
        }
        for flag, value in expected.items():
            assert args[args.index(flag) + 1] == value, args
        # GitHub may not have created the run yet when Staging starts.
        lookups = Path(env["RUNNER_TEMP"]) / "presubmit-lookups"
        count = int(lookups.read_text()) if lookups.exists() else 0
        lookups.write_text(str(count + 1))
        if count == 1:
            print("42\t3\tin_progress\t")
        elif count >= 2:
            print("42\t3\tcompleted\t" + env["PRODUCER_RESULT"])
    elif args[0] == "api":
        if any(arg.endswith("/git/ref/heads/main") for arg in args):
            if env["MAIN_SHA"] == "api-error":
                sys.exit(23)
            print(env["MAIN_SHA"])
        elif any(arg.endswith("/actions/workflows/submit.yml/runs") for arg in args):
            print(json.dumps({"workflow_runs": [{"id": 11}]}))
        elif any(arg.endswith("/actions/runs/11/artifacts") for arg in args):
            print(json.dumps({"artifacts": [
                {"name": path.name, "expired": False} for path in artifact("11", "").glob("*")
            ]}))
        else:
            raise ValueError(args)
    else:
        raise ValueError(args)


def main(service, args):
    if service == "gh":
        gh(args)
    elif service == "checkout":
        dest = Path(args[0] or ".")
        shutil.copytree(env["FIXTURE_REPO"], dest, dirs_exist_ok=True)
    elif service == "bazel":
        if args[0] == "info":
            print(Path.cwd() / "dist")
        elif args[0] == "run" and "//ci:presubmit" in args:
            if env["FAIL_PRESUBMIT"] == "true":
                sys.exit(23)
            if env["GITHUB_EVENT_NAME"] == "merge_group":
                folder = Path("dist/candidate-bin/ci/deploy")
                folder.mkdir(parents=True)
                for filename in ARCHIVES:
                    (folder / filename).write_text(env["GITHUB_SHA"])
        elif args[0] != "build":
            raise ValueError(args)
    elif service == "upload":
        name, paths, missing = args
        files = [Path(path) for path in paths.splitlines() if Path(path).is_file()]
        if not files and missing == "ignore":
            return
        assert files, paths
        dest = artifact(env["GITHUB_RUN_ID"], name)
        dest.mkdir(parents=True)
        for path in files:
            shutil.copy(path, dest)
    elif service == "download":
        run, name, dest = args
        shutil.copytree(artifact(run or env["GITHUB_RUN_ID"], name), dest)
    elif service == "deploy":
        bundle, launcher, revision = args
        assert launcher == "ci/deploy/deploy", args
        contents = [Path(bundle, name).read_text() for name in ARCHIVES]
        assert contents[0] == contents[1]
        with open(env["FIXTURE_DEPLOYMENTS"], "a") as trace:
            print(revision, contents[0], file=trace)
        if revision == env["FAIL_DEPLOY"]:
            sys.exit(23)
    else:
        raise ValueError(service)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
