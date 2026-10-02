"""Build static or server-rendered Remix/React Router sites from Bazel inputs."""

load("@rules_itest//private:itest.bzl", "itest_service")
load("//js:rules.bzl", "js_binary", "js_run_binary")

def remix_itest_service(name, exe = None, args = [], health_check_timeout = "120s", **kwargs):
    itest_service(
        name = name,
        args = args + ["--port", "$${PORT}"],
        health_check_timeout = health_check_timeout,
        autoassign_port = True,
        exe = exe,
        **kwargs
    )

def remix_itest_service_dev(name, exe = None, args = [], **kwargs):
    itest_service(
        name = name,
        args = args + ["--port", "3000"],
        health_check_timeout = "60s",
        exe = exe,
        **kwargs
    )

def remix_project(name, srcs, server_entry = None, **kwargs):
    native.filegroup(name = name + "_git_analysis_srcs", srcs = srcs)
    inputs = srcs + ([server_entry, "//:node_modules/esbuild"] if server_entry else []) + [
        "vite.config.mjs",
        "react-router.config.mjs",
        "//ts/remix:tooling",
        "//:node_modules/@react-router/dev",
        "//:node_modules/@react-router/node",
        "//:node_modules/vite",
        "//:node_modules/react",
        "//:node_modules/react-dom",
        "//:node_modules/react-router",
        "//:node_modules/isbot",
        "//:package_json",
    ]
    js_binary(
        name = "build_bin",
        entry_point = "//ts/remix:runner",
        data = inputs,
    )
    js_run_binary(
        name = "build",
        tool = ":build_bin",
        srcs = inputs,
        args = ["build", native.package_name()] + (["--server-entry", server_entry] if server_entry else []),
        out_dirs = ["build"] + (["server_build"] if server_entry else []),
    )
    js_binary(
        name = "dev",
        # Vite loaded by the CLI and config must resolve to the same module instance.
        patch_node_fs = False,
        entry_point = "//ts/remix:runner",
        data = inputs,
        fixed_args = ["dev", native.package_name()],
    )
    js_binary(
        name = "start",
        entry_point = "//ts/remix:runner",
        data = [":build", "//ts/remix:tooling"],
        fixed_args = ["start", native.package_name()],
    )
    native.alias(name = name, actual = ":build", **kwargs)
