"""Implementation of the UUencode and UUdecode functions."""

import binascii
import os
import sys

__all__ = ["Error", "encode", "decode"]


class Error(Exception):
    pass


def encode(in_file, out_file, name=None, mode=None, *, backtick=False):
    opened_files = []
    try:
        if in_file == "-":
            in_file = sys.stdin.buffer
        elif isinstance(in_file, str):
            if name is None:
                name = os.path.basename(in_file)
            if mode is None:
                try:
                    mode = os.stat(in_file).st_mode
                except AttributeError:
                    pass
            in_file = open(in_file, "rb")
            opened_files.append(in_file)

        if out_file == "-":
            out_file = sys.stdout.buffer
        elif isinstance(out_file, str):
            out_file = open(out_file, "wb")
            opened_files.append(out_file)

        if name is None:
            name = "-"
        if mode is None:
            mode = 0o666

        name = name.replace("\n", "\\n").replace("\r", "\\r")
        out_file.write(("begin %o %s\n" % ((mode & 0o777), name)).encode("ascii"))
        data = in_file.read(45)
        while len(data) > 0:
            out_file.write(binascii.b2a_uu(data, backtick=backtick))
            data = in_file.read(45)
        out_file.write(b"`\nend\n" if backtick else b" \nend\n")
    finally:
        for f in opened_files:
            f.close()


def decode(in_file, out_file=None, mode=None, quiet=False):
    opened_files = []
    if in_file == "-":
        in_file = sys.stdin.buffer
    elif isinstance(in_file, str):
        in_file = open(in_file, "rb")
        opened_files.append(in_file)

    try:
        while True:
            hdr = in_file.readline()
            if not hdr:
                raise Error("No valid begin line found in input file")
            if not hdr.startswith(b"begin"):
                continue
            hdrfields = hdr.split(b" ", 2)
            if len(hdrfields) == 3 and hdrfields[0] == b"begin":
                try:
                    int(hdrfields[1], 8)
                    break
                except ValueError:
                    pass
        if out_file is None:
            out_file = hdrfields[2].rstrip(b" \t\r\n\f").decode("ascii")
            if os.path.exists(out_file):
                raise Error(f"Cannot overwrite existing file: {out_file}")
            if (
                out_file.startswith(os.sep)
                or f"..{os.sep}" in out_file
                or (
                    os.altsep
                    and (out_file.startswith(os.altsep) or f"..{os.altsep}" in out_file)
                )
            ):
                raise Error(f"Refusing to write to {out_file} due to directory traversal")
        if mode is None:
            mode = int(hdrfields[1], 8)

        if out_file == "-":
            out_file = sys.stdout.buffer
        elif isinstance(out_file, str):
            fp = open(out_file, "wb")
            os.chmod(out_file, mode)
            out_file = fp
            opened_files.append(out_file)

        s = in_file.readline()
        while s and s.strip(b" \t\r\n\f") != b"end":
            try:
                data = binascii.a2b_uu(s)
            except binascii.Error as exc:
                nbytes = (((s[0] - 32) & 63) * 4 + 5) // 3
                data = binascii.a2b_uu(s[:nbytes])
                if not quiet:
                    sys.stderr.write(f"Warning: {exc}\n")
            out_file.write(data)
            s = in_file.readline()
        if not s:
            raise Error("Truncated input file")
    finally:
        for f in opened_files:
            f.close()
