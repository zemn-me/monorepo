load("//:rules.bzl", "nodejs_binary", "generated_file_test")
load("@bazel_tools//:defs.bzl", "json_extract",  "json_test")

def package_json(name, targets, template):
    """
    Generate a package.json for a given target.
    """
    genquery_name = name + "_deps"
    native.genquery(
        name = genquery_name,
        scope = targets,
        expression = "deps(" + " ".join([ str(Label("//" + native.package_name()).relative(target)) for target in targets ]) + ", 1)",
    )

    genrule_name = name + "_gen"
    nodejs_binary(
        name = genrule_name,
        data = [
            "//:package.json",
            genquery_name,
            template,
            "//js/npm/package_json:gen_pkgjson_js",
        ],
        entry_point = "//js/npm/package_json:gen_pkgjson.js",
    )

    native.genrule(
        name = name,
        srcs = [
            "@npm//commander",
            "//:package.json",
            genquery_name,
            template,
            "@npm//@bazel/runfiles",
            "//js/npm/package_json:gen_pkgjson_js",
        ],
        cmd = "$(execpath " + genrule_name + ") " +
              " ".join(
                  [
                      "--out",
                      "$@",
                      "--base",
                      "$(location //:package.json)",
                      "--query",
                      "$(location " + genquery_name + ")",
                      "--merge",
                      "$(location " + template + ")",
                  ],
              ),
        outs = ["package.json"],
        tools = [genrule_name],
    )

    json_test(
        name = name + "_valid",
        srcs = [ name ]
    )


def pkg_npm(name, package_name, pkg_json_base, hash_and_version_golden, srcs = [], deps = []):
    pkg_json_name = name + "_package_json"
    package_json(
        name = pkg_json_name,
        targets = srcs,
        template = pkg_json_base
    )

    hash_file_name = name + "_digest"
    native.genrule(
        name = hash_file_name,
        srcs = srcs,
        cmd_bash = """
            cat $(SRCS) | sha512sum > $@
        """
    )

    version_name = name + "_version"
    json_extract(
        name = version_name,
        srcs = [
            pkg_json_name,
        ],
        out = name + "_version.txt",
        query = ".version",
        raw = True
    )

    hash_and_version_name = name + "_hash_and_version"
    native.genrule(
        name = hash_and_version_name,
        srcs = [ version_name, hash_file_name ],
        out = name + "_hash_and_version.txt",
        cmd_bash = """
            echo "
This is a generated file intended to make tests fail when the contents
of the npm package is changed, but the version is not bumped.

Package version: $$(cat $(location """ + version_name + """))
Package hash: $$(cat $(location """ + hash_file_name + """))

If this check fails, consider bumping the version in the package.json
template, and also updating the golden file." > $@
        """
    )

    generated_file_test(
        name = name + "_hash_and_version_check",
        generated = hash_and_version_name,
        src = hash_and_version_golden,
    )

    lockfile_name = name + "_lockfile"
    native.genrule(
        name = name + "_lockfile",
        srcs = ["//:yarn.lock"],
        outs = ["yarn.lock"],
        cmd = "cp $< $@",
    )


    pkg_npm(
        name = name,
        package_name = package_name,
        srcs = srcs,
        deps = deps + [
            pkg_json_name,
            lockfile_name
        ]
    )



