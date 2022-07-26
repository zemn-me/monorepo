load("//bzl/versioning:rules.bzl", "bump_on_change_test", "semver_version")
load("//js/npm/yarn/lock:rules.bzl", "lockfile_minimize")
load("@build_bazel_rules_nodejs//:index.bzl", "pkg_npm")
load("//js/api-extractor:rules.bzl", "api_extractor")
load("//js/npm/package_json:rules.bzl", "package_json")

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
        # Whenever I finally refactor ts_project to use proper output types
        # this will be removable.
        visibility = None):
    external_api_root = entry_point[:entry_point.find(".")]
    external_api_dts_root = external_api_root + ".d.ts"

    semver_version(
        name = "version",
        major = major_version,
        minor = minor_version,
        patch = patch_version,
    )

    pkg_json_name = name + "_package_json"
    package_json(
        name = pkg_json_name,
        # Won't be srcs I am fairly sure? because srcs are never
        # generated and so can't have deps
        targets = deps,
        template = pkg_json_base,
        version = ":version",
    )

    lockfile_name = name + "_lockfile"
    lockfile_minimize(
        name = lockfile_name,
        lockfile = "//:yarn.lock",
        package_json = pkg_json_name,
        lockfile_out = "yarn.lock",
    )

    api_extractor(
        name = name + "_extracted_api",
        entry_point = external_api_dts_root,
        srcs = srcs + deps,
        report = "api_gen.md",
        publicTrimmedRollup = "public.d.ts"
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
