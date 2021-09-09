load("//:rules.bzl", "ts_project", "jest_test", "ts_config")

package(default_visibility = [ "//visibility:public" ])



tsfiles = glob(["*.ts"], exclude = ["*_test.ts"])
tstestfiles = glob(["*_test.ts"])

ts_project(
    name = "cultist",
    srcs = tsfiles,
    declaration = True,
    tsconfig = "//:tsconfig_node",
    deps = [
	    "//cultist/example",
        "//typescript/iter",
        "//typescript",
        "@npm//immutable",
        "@npm//@types/uuid"
    ]
)

ts_project(
	name = "tests_lib_node",
	srcs = tstestfiles,
	declaration = True,
	tsconfig = "//:tsconfig_node",
	deps = [
		"@npm//@types/jest",
		":cultist"
	]
)

jest_test(
	name = "test",
	srcs = [ f[:-len(".ts")] + ".js" for f in tstestfiles ],
	deps = [
		"//cultist",
        "@npm//uuid",
        "@npm//immutable"
	]
)


