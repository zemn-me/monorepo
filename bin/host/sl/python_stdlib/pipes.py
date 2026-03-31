"""Compatibility stdlib overlay for hermetic Sapling builds."""

import os
import re
import tempfile
from shlex import quote

__all__ = ["Template"]

FILEIN_FILEOUT = "ff"
STDIN_FILEOUT = "-f"
FILEIN_STDOUT = "f-"
STDIN_STDOUT = "--"
SOURCE = ".-"
SINK = "-."

stepkinds = [FILEIN_FILEOUT, STDIN_FILEOUT, FILEIN_STDOUT, STDIN_STDOUT, SOURCE, SINK]


class Template:
    def __init__(self):
        self.debugging = 0
        self.reset()

    def __repr__(self):
        return "<Template instance, steps=%r>" % (self.steps,)

    def reset(self):
        self.steps = []

    def clone(self):
        t = Template()
        t.steps = self.steps[:]
        t.debugging = self.debugging
        return t

    def debug(self, flag):
        self.debugging = flag

    def append(self, cmd, kind):
        if not isinstance(cmd, str):
            raise TypeError("Template.append: cmd must be a string")
        if kind not in stepkinds:
            raise ValueError("Template.append: bad kind %r" % (kind,))
        if kind == SOURCE:
            raise ValueError("Template.append: SOURCE can only be prepended")
        if self.steps and self.steps[-1][1] == SINK:
            raise ValueError("Template.append: already ends with SINK")
        if kind[0] == "f" and not re.search(r"\$IN\b", cmd):
            raise ValueError("Template.append: missing $IN in cmd")
        if kind[1] == "f" and not re.search(r"\$OUT\b", cmd):
            raise ValueError("Template.append: missing $OUT in cmd")
        self.steps.append((cmd, kind))

    def prepend(self, cmd, kind):
        if not isinstance(cmd, str):
            raise TypeError("Template.prepend: cmd must be a string")
        if kind not in stepkinds:
            raise ValueError("Template.prepend: bad kind %r" % (kind,))
        if kind == SINK:
            raise ValueError("Template.prepend: SINK can only be appended")
        if self.steps and self.steps[0][1] == SOURCE:
            raise ValueError("Template.prepend: already begins with SOURCE")
        if kind[0] == "f" and not re.search(r"\$IN\b", cmd):
            raise ValueError("Template.prepend: missing $IN in cmd")
        if kind[1] == "f" and not re.search(r"\$OUT\b", cmd):
            raise ValueError("Template.prepend: missing $OUT in cmd")
        self.steps.insert(0, (cmd, kind))

    def open(self, file, rw):
        if rw == "r":
            return self.open_r(file)
        if rw == "w":
            return self.open_w(file)
        raise ValueError("Template.open: rw must be 'r' or 'w', not %r" % (rw,))

    def open_r(self, file):
        if not self.steps:
            return open(file, "r")
        if self.steps[-1][1] == SINK:
            raise ValueError("Template.open_r: pipeline ends width SINK")
        cmd = self.makepipeline(file, "")
        return os.popen(cmd, "r")

    def open_w(self, file):
        if not self.steps:
            return open(file, "w")
        if self.steps[0][1] == SOURCE:
            raise ValueError("Template.open_w: pipeline begins with SOURCE")
        cmd = self.makepipeline("", file)
        return os.popen(cmd, "w")

    def copy(self, infile, outfile):
        return os.system(self.makepipeline(infile, outfile))

    def makepipeline(self, infile, outfile):
        cmd = makepipeline(infile, self.steps, outfile)
        if self.debugging:
            print(cmd)
            cmd = "set -x; " + cmd
        return cmd


def makepipeline(infile, steps, outfile):
    commands = [["", cmd, kind, ""] for cmd, kind in steps]
    if not commands:
        commands.append(["", "cat", "--", ""])

    _, _, first_kind, _ = commands[0]
    if first_kind[0] == "f" and not infile:
        commands.insert(0, ["", "cat", "--", ""])
    commands[0][0] = infile

    _, _, last_kind, _ = commands[-1]
    if last_kind[1] == "f" and not outfile:
        commands.append(["", "cat", "--", ""])
    commands[-1][-1] = outfile

    garbage = []
    for i in range(1, len(commands)):
        left_kind = commands[i - 1][2]
        right_kind = commands[i][2]
        if left_kind[1] == "f" or right_kind[0] == "f":
            fd, temp = tempfile.mkstemp()
            os.close(fd)
            garbage.append(temp)
            commands[i - 1][-1] = commands[i][0] = temp

    pipeline = []
    for inf, cmd, kind, outf in commands:
        if kind[1] == "f":
            cmd = f"{cmd} >{quote(outf)}"
        elif outf:
            cmd = f"{cmd} >{quote(outf)}"
        if kind[0] == "f":
            cmd = cmd.replace("$IN", quote(inf))
        elif inf:
            cmd = f"<{quote(inf)} {cmd}"
        if kind[1] == "f":
            cmd = cmd.replace("$OUT", quote(outf))
        pipeline.append(cmd)

    cmd = " | ".join(pipeline)
    if garbage:
        rmcmd = "rm -f " + " ".join(map(quote, garbage))
        cmd = f"trap '{rmcmd}' 1 2 3 13 14 15; {cmd}; status=$?; {rmcmd}; exit $status"
    return cmd
