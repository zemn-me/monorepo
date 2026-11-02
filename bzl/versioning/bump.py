import argparse
import os
import subprocess
import shutil

parser = argparse.ArgumentParser(description="Performs the action of a version bump.")
parser.add_argument('--to_bump_in', required=True, help="The version file to bump, as a root-relative path.", type=str)
parser.add_argument('--to_bump_out', required=True, help="The version file to bump, as a root-relative path.", type=str)
parser.add_argument('--lockfile_build_label', required=False, help="A label that points to the generated (new) version lockfile.", type=str)
parser.add_argument('--lockfile_build_rootpath', required=False, help="The path from the repo root that the lockfile is generated into", type=str)
parser.add_argument('--lockfile_out_rootpath', required=False, help="The location to place the newly minted version lockfile at.", type=str)

# This happens directly on the real workspace -- also, needs to be
# run from bazel to have this set.
os.chdir(os.environ.get('BUILD_WORKSPACE_DIRECTORY'))

args = parser.parse_args()

number = 0

with open(args.to_bump_in, mode='r', encoding='utf-8') as f:
    number = int(f.read())


with open(args.to_bump_out, mode='w', encoding='utf-8') as f:
    f.write(str(number+1))

# Once the version has been bumped, generate the new version bump file.
if args.lockfile_build_label is not None and args.lockfile_build_rootpath is not None and args.lockfile_out_rootpath is not None:
    subprocess.run(["bazelisk", "build", args.lockfile_build_label])

    # Copy the newly created lockfile across
    shutil.copyfile(
        os.path.join("dist", "bin", args.lockfile_build_rootpath),
        args.lockfile_out_rootpath
    )
