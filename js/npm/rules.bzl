load("@aspect_bazel_lib//lib:copy_to_directory.bzl", "copy_to_directory")
load("//bzl/versioning:rules.bzl", "bump_on_change_test", "semver_version")
load("//js:rules.bzl", "copy_to_bin", "pkg_npm")
load("//js/api-documenter:rules.bzl", "api_documenter")
load("//js/api-extractor:rules.bzl", "api_extractor")
load("//js/npm/package_json:rules.bzl", "package_json")
load("@rules_pkg//pkg:pkg.bzl", "pkg_tar")

def _exclude_all_external_rule(ctx):
    return DefaultInfo(files = depset([
        file
        for file in ctx.files.srcs
        if file.owner.workspace_name == ""
    ]))

exclude_all_external_rule = rule(
    implementation = _exclude_all_external_rule,
    attrs = {
        "srcs": attr.label_list(allow_files = True),
    },
)

def npm_pkg(
        name,
        pkg_json_base,
        srcs = [],
        deps = [],
        # Needed so that something shows on NPM
        readme = None,
        version_lock = None,
        api_lock = None,
        major_version = None,
        minor_version = None,
        patch_version = None,
        test_version_on_main = False,
        entry_point = None,
        tgz = None,
        # Whenever I finally refactor ts_project to use proper output types
        # this will be removable.
        visibility = None):
    external_api_root = entry_point[:entry_point.find(".")]
    external_api_dts_root = external_api_root + ".d.ts"

    # file containing just deps for this package
    # this is needed to determine if a dep version has changed
    # since if this is the case, we have to publish a new
    # minor version
    dep_spec_name = name + "_deps.json"

    semver_version(
        name = "version",
        major = major_version,
        minor = minor_version,
        patch = patch_version,
    )

    pkg_json_name = name + "_package_json"
    package_json(
        name = pkg_json_name + "_gen",
        # Won't be srcs I am fairly sure? because srcs are never
        # generated and so can't have deps
        # nevermind, cause of weird rules_js semantics i added
        # srcs too.
        targets = deps + srcs,
        template = pkg_json_base,
        version = ":version",
        depSpec = dep_spec_name,
    )

    copy_to_bin(
        name = pkg_json_name,
        srcs = [pkg_json_name + "_gen"],
    )

    api_extractor(
        name = name + "_extracted_api",
        entry_point = external_api_dts_root,
        srcs = srcs + deps,
        report = "api_gen.md",
        public_trimmed_rollup = "public.d.ts",
        doc_model = ".api.json",
    )

    api_documenter(
        name = name + "_docs",
        output_directory = "docs",
        doc_model = ".api.json",
    )

    copy_to_directory(
        name = name + "_dir",
        srcs = srcs + deps + [pkg_json_name, "public.d.ts", readme],
        replace_prefixes = {
            "public.d.ts": "index.d.ts",
        },
    )

    pkg_tar(
        name = name + "_tar",
        srcs = [name + "_dir"],
        extension = ".tgz",
        out = name + ".tgz",
    )

    ####
    # TODO: probably re-do this test.
    ####
    # npm.npm_test(
    #    name = name + ".publish_test",
    #    data = [name + "_dir"],
    #    args = ["publish", "$(location " + name + "_dir)", "--dry-run", "--cache", "$$TMPDIR"],
    #)

    pkg_srcs = srcs
    pkg_deps = deps + [pkg_json_name]
    pkg_npm(
        name = name,
        srcs = [name + "_dir"],
        visibility = visibility,
    )

    # vestigial functionality from rules_js
    if tgz != None:
        native.alias(
            name = tgz,
            actual = name + ".pack",
        )

    exclude_all_external_rule(
        name = "version_lock_files",
        srcs = pkg_srcs + [dep_spec_name, readme],
    )

    # Test that ensures at least a minor bump happens when
    # a change in files occurs.
    bump_on_change_test(
        name = "version_lock",
        srcs = [":version_lock_files"],
        version = minor_version,
        run_on_main = test_version_on_main,
        version_lock = version_lock,
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
