"""
Copies a file from bazel's output tree $(rlocationpath //something), to
the live workspace the dev is working in.

This allows us to have an output of a bazel action copied into the source code
(e.g. for goldens).
"""
import os
import shutil
import sys
from python.runfiles import runfiles

def copy_file(rlocation_path, workspace_subpath):
    """
    Copies a file from an rlocation path to a specified path under $BUILD_WORKSPACE_DIRECTORY.

    Args:
        rlocation_path (str): The source file path (rlocation).
        workspace_subpath (str): The relative path under $BUILD_WORKSPACE_DIRECTORY to copy the file to.

    Raises:
        FileNotFoundError: If the source file does not exist.
        OSError: If there is an issue with file copying.
    """
    r = runfiles.Create()
    if r is None:
        raise Exception("Unable to build runfiles. Are you in Bazel?")

    source_path = r.Rlocation(rlocation_path)

    if source_path is None:
        raise Exception("Unable to locate runfile: " + rlocation_path)

    build_workspace_directory = os.environ.get("BUILD_WORKSPACE_DIRECTORY")
    if not build_workspace_directory:
        raise EnvironmentError("$BUILD_WORKSPACE_DIRECTORY is not set")

    destination_path = os.path.join(build_workspace_directory, workspace_subpath)

    if not os.path.exists(source_path):
        raise FileNotFoundError(f"Source file not found: {source_path}")

    # Ensure the destination directory exists
    os.makedirs(os.path.dirname(destination_path), exist_ok=True)

    # Copy the file
    try:
        shutil.copy2(source_path, destination_path)
        print(f"File copied to: {destination_path}")
    except OSError as e:
        raise OSError(f"Failed to copy file: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python copy_rlocation.py <rlocation_path> <workspace_subpath>")
        sys.exit(1)

    rlocation_path = sys.argv[1]
    workspace_subpath = sys.argv[2]

    try:
        copy_file(rlocation_path, workspace_subpath)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
