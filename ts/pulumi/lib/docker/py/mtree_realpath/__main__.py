from argparse import ArgumentParser

if __name__ != "__main__":
	raise Exception("don’t import this!")

parser = ArgumentParser(
	description = "Given an mtree file and a list of content paths, " +
	"return a list of 'final' paths after processing.\n\n"+
	"For example:\n" +
"	myfile1 uid=0 gid=0 mode=0755 content=path/to/my/file\n" +
"	myfile2 uid=0 gid=0 mode=0755 content=path/to/my/file2\n\n"+
	"If this file were --mtree_file, and the arguments were:\n" +
	"\t - path/to/my/file, and\n"
	"\t - path/to/my/file2\n\n" +
	"Then the result would be:\n" +
	"\tmyfile1\n" +
	"\tmyfile2"
)

parser.add_argument(
	'contentpaths',
	nargs = '+',
	help="List of content= values to get final paths for in the mtree.",
)

parser.add_argument(
	'--mtree_file',
	required=True,
	help="mtree file to extract paths from."
)

args = parser.parse_args()

final_paths = []
missing_paths = []

try:
	with open(args.mtree_file, 'r') as mtree:
		lines = mtree.readlines()
		for content_path in args.contentpaths:
			found = False
			for line in lines:
				if f"content={content_path}" in line:
					final_path = line.split()[0]
					final_paths.append(final_path)
					found = True
					break
			if not found:
				missing_paths.append(content_path)
except FileNotFoundError:
	raise Exception(f"The file {args.mtree_file} does not exist.")

if missing_paths:
	raise Exception(f"The following content paths were not found in the mtree file: {', '.join(missing_paths)}")

for path in final_paths:
	print(path)
