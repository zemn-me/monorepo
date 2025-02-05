#!/usr/bin/env python3

import os
import re
from argparse import ArgumentParser
from tempfile import TemporaryFile
from shutil import copyfileobj

def get_sapling_config_dir(working_directory: str) -> str:
    """
    Determine the appropriate config directory for Sapling:
    - If .git exists in working_directory, use .git/sl/
    - Otherwise, use .sl/
    """
    git_dir = os.path.join(working_directory, ".git")
    if os.path.isdir(git_dir):
        return os.path.join(git_dir, "sl")
    return os.path.join(working_directory, ".sl")

def ensure_sapling_include(config_file_path: str, relative_include: str) -> bool:
    """
    Ensure the Sapling config file includes:
        %include <relative_include>
    If the include is missing, it is prepended, and the file is updated.
    Returns True if the file was changed; False if it was already correct.
    """
    # Create the directory for config_file_path if needed
    os.makedirs(os.path.dirname(config_file_path), exist_ok=True)

    # Open in "a+" mode so that the file is created if it does not exist
    with open(config_file_path, "a+") as config_file:
        # Move pointer to start for reading
        config_file.seek(0)
        lines = config_file.readlines()

        pattern_str = fr"^%include\s+{re.escape(relative_include)}\s*$"
        pattern = re.compile(pattern_str)

        # If any line matches, there's nothing to fix
        if any(pattern.match(line.strip()) for line in lines):
            return False

        print("It appears your Sapling config does not include the standard file. Allow me to correct that.")

        # We need to prepend the missing line
        config_file.seek(0)
        config_file.truncate()

        with TemporaryFile(mode="w+") as temp:
            temp.write(f"%include {relative_include}{os.linesep}")
            for line in lines:
                temp.write(line)

            # Copy temporary contents back into the original file
            temp.seek(0)
            copyfileobj(temp, config_file)

    return True

def configure_sapling(working_directory: str) -> None:
    """
    High-level function that locates the config directory,
    calculates the relative path to ini/sl/config.ini,
    and ensures the include is present.
    """
    config_dir = get_sapling_config_dir(working_directory)
    config_file_path = os.path.join(config_dir, "config")

    # Figure out the relative path from config_dir to ini/sl/config.ini
    ini_config_path = os.path.join(working_directory, "ini", "sl", "config.ini")
    relative_include = os.path.relpath(ini_config_path, start=config_dir)

    ensure_sapling_include(config_file_path, relative_include)

def main():
    parser = ArgumentParser(
        prog="scm-conf.py",
        description="Configure local SCM to use repo config."
    )
    parser.add_argument(
        "working_directory",
        help="Directory to run in (exists due to Bazel stubbornness)."
    )
    args = parser.parse_args()
    configure_sapling(args.working_directory)

if __name__ == "__main__":
    main()
