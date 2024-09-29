"Runs after Renovate updates some dep"
from subprocess import run as _run
from os import getenv

if __name__ != "__main__":
	raise Exception("don’t import this!")

wd = getenv("BUILD_WORKSPACE_DIRECTORY")

if wd is None:
	raise Exception("Please run from bazel.")


def run(*args, **kwargs):
	return _run(*args, cwd=wd, **kwargs)

def bazel(args: list[str] = [],  **kwargs):
	return run(
		["npx", "--yes", "@bazel/bazelisk"] + args,
		check=True, **kwargs,
	)

def bazel_run(args: list[str] = [], env: dict[str, str] = {}, **kwargs):
	return bazel(
		["run"] + args,
		**kwargs,
	)

def cargo_repin():
	return bazel(["sync", "--only=cargo"])

def go_mod_tidy():
	return bazel_run(["@@//sh/bin:go", "--", "mod", "tidy"])

def bazel_update_lockfile():
	return bazel(["mod", "deps", "--lockfile_mode=update"])

def autofix_tags(tags: list[str]):
	return bazel_run(["@@//:fix"] + tags)

def autofix_all():
	return autofix_tags(["//..."])

def bazel_update_modfile():
	return bazel(["mod", "tidy"])

def modify_non_bazel_lockfiles():
	go_mod_tidy()
	autofix_all()

def modify_bazel_lockfiles():
	bazel_update_modfile()
	cargo_repin()
	bazel_update_lockfile()
	# and one for luck
	autofix_all()

modify_non_bazel_lockfiles()
modify_bazel_lockfiles()
run(["rm", "-rf", "dist/"])





