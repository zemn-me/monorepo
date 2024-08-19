from argparse import ArgumentParser
import re
from os import linesep
from tempfile import TemporaryFile
from shutil import copyfileobj
from os import path

if __name__ != "__main__":
	raise Exception("don’t import this!")

parser = ArgumentParser(
	prog="scm-conf.py",
	description = "Configure local SCM to use repo config.",
)

parser.add_argument(
	'working_directory',
	help = "directory to run in" # exists due to bazel stubbornness lol
)

args = parser.parse_args()
wd = args.working_directory

def try_edit_sapling_config():
	with open(path.join(wd, ".sl/config")) as file:
		sapling_import_pattern = re.compile("%%include\s+../ini/sl/config.ini")
		if any(
			(
				sapling_import_pattern.match(line)
				for line in file
			)
		):
			return

		print("It looks like you're not importing the standard sapling config. I will fix this.")

		file.seek(0)

		with TemporaryFile() as temp:
			temp.write("%%include ../ini/sl/config.ini" + linesep)
			copyfileobj(file, temp)

			file.truncate()
			copyfileobj(temp, file)
