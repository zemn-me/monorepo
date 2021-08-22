load("//:rules.bzl", "ts_project", "jest_test")

package(default_visibility = [ "//visibility:public" ])

tstests = glob(["*_test.ts"])
tsfiles = [ f for f in glob(["*.ts"]) if f not in tstests ]



ts_project(
    name = "cultist",
    srcs = tsfiles,
    declaration = True,
    source_map = True,
    tsconfig = "//:tsconfig",
    deps = [
	    "//cultist/example"
    ]
)

ts_project(
	name = "tests_lib",
	srcs = tstests,
	declaration = True,
	source_map = True,
	tsconfig = "//:tsconfig",
	deps = [
		"@npm//@types/jest",
		":cultist"
	]
)

jest_test(
	name = "test",
	srcs = [
		f[:-len(".ts")] + ".js" for f in tstests
	],
	deps = [
		"//cultist"
	]
)
