load("//:rules.bzl", "nodejs_binary")
load("//bzl/versioning:rules.bzl", "bump_on_change_test", "semver_version")
load("@build_bazel_rules_nodejs//:index.bzl", "pkg_npm")
load("//js/api-extractor:rules.bzl", "api_extractor")
load("@rules_pkg//pkg:pkg.bzl", "pkg_zip")

def package_json(name, targets, template, version):
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
        ] + [ version ],
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
                      "--version",
                      "$(location " + version + ")"
                  ],
              ),
        outs = ["package.json"],
        tools = [genrule_name],
    )

def npm_pkg(
        name,
        package_name,
        pkg_json_base,
        srcs = [],
        deps = [],
        version_lock = None,
        api_lock = None,
        major_version = None,
        minor_version = None,
        patch_version = None,
        test_version_on_main = False,
        entry_point = None,
        tgz = None,
        visibility = None):
    external_api_root = entry_point[:entry_point.find(".")]
    external_api_dts_root = external_api_root + ".d.ts"

    semver_version(
        name = "version",
        major = "version/MAJOR",
        minor = "version/MINOR",
        patch = "version/PATCH",
    )

    pkg_json_name = name + "_package_json"
    package_json(
        name = pkg_json_name,
        targets = srcs + deps,
        template = pkg_json_base,
        version = ":version"
    )

    lockfile_name = name + "_lockfile"
    native.genrule(
        name = name + "_lockfile",
        srcs = ["//:yarn.lock"],
        outs = ["yarn.lock"],
        cmd = "cp $< $@",
    )

    api_extractor(
        name = name + "_extracted_api",
        entry_point = external_api_dts_root,
        srcs = srcs + deps,
        report = "api_gen.md",
    )

    pkg_srcs = srcs
    pkg_deps = deps + [pkg_json_name, lockfile_name]
    pkg_npm(
        name = name,
        package_name = package_name,
        srcs = pkg_srcs,
        deps = pkg_deps,
        tgz = tgz,
        visibility = visibility,
    )

    # Test that ensures at least a minor bump happens when
    # a change in files occurs.
    bump_on_change_test(
        name = "version_lock",
        srcs = pkg_srcs + pkg_deps,
        version = minor_version,
        run_on_main = test_version_on_main,
        version_lock = "version.lock",
    )

    # Test that ensures that a major bump happens when a change
    # in API schema occurs.
    bump_on_change_test(
        name = "api_change_lock",
        srcs = ["api_gen.md"],
        version = major_version,
        run_on_main = test_version_on_main,
        version_lock = api_lock,
    )
