from sectxt import SecurityTXT
from sys import argv

s = SecurityTXT(argv[1], is_local=True)


if len(s.errors):
	raise Exception("\n".join((
		"{}:{} [{}]: {}".format(argv[1], error['line'], error['code'], error['message'])
		for error in s.errors)))


