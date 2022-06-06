load("//:rules.bzl", "nodejs_binary")
load("//bzl/versioning:rules.bzl", "semver_version", "bump_on_change_test")
load("@build_bazel_rules_nodejs//:index.bzl", "pkg_npm")

def package_json(name, targets, template):
    """
    Generate a package.json for a given target.
    """
    genquery_name = name + "_deps"
    native.genquery(
        name = genquery_name,
        scope = targets,
        expression = "deps(" + " ".join([str(Label("//" + native.package_name()).relative(target)) for target in targets]) + ", 1)",
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


def npm_pkg(name, package_name, pkg_json_base, srcs = [], deps = [],
    version_lock = None, major_version = None, minor_version = None, patch_version = None, test_version_on_main = False):
    pkg_json_name = name + "_package_json"
    package_json(
        name = pkg_json_name,
        targets = srcs + deps,
        template = pkg_json_base,
    )

    bump_on_change_test(
        name = "version_lock",
        srcs = srcs + deps,
        version = minor_version,
        run_on_main = test_version_on_main,
        version_lock = "version.lock"
    )

    semver_version(
        name = "version",
        major = "version/MAJOR",
        minor = "version/MINOR",
        patch = "version/PATCH"
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
            lockfile_name,
        ],
    )
