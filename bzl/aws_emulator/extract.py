"""Copy the pinned emulator executable out of its package on the executor."""
import os
import shutil
import sys
import tarfile

with tarfile.open(sys.argv[1], "r:xz") as archive:
    binary = archive.extractfile("./opt/aws-emulator/bin/aws-emulator")
    if binary is None:
        raise ValueError("The package contains no AWS Emulator executable")
    with binary, open(sys.argv[2], "wb") as output:
        shutil.copyfileobj(binary, output)
os.chmod(sys.argv[2], 0o755)
