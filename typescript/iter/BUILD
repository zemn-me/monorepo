load("//:rules.bzl", "ts_project", "jest_test", "ts_config")

package(default_visibility = ["//:__subpackages__"])


tstestfiles = glob(["*_test.ts"])

ts_project(
    name = "iter",
    srcs = glob(
        include = ["*.ts"],
        exclude = ["*_test.ts"],
    ),
    declaration = True
)

ts_project(
	name = "tests_lib",
	srcs = tstestfiles,
	declaration = True,
	tsconfig = "//:tsconfig_node",
	deps = [
		"@npm//@types/jest",
        ":iter"
	]
)

jest_test(
	name = "test",
	srcs = [ f[:-len(".ts")] + ".js" for f in tstestfiles ],
    deps = [
        ":iter"
    ]
)


