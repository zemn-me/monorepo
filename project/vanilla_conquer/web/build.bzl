"""Build the complete C++ engine with Emscripten and pinned host toolchains."""

def _engine_impl(ctx):
    cmake = ctx.toolchains["@rules_foreign_cc//toolchains:cmake_toolchain"].data
    ninja = ctx.toolchains["@rules_foreign_cc//toolchains:ninja_toolchain"].data
    node = ctx.toolchains["@rules_nodejs//nodejs:toolchain_type"].nodeinfo.node
    if not cmake.target or not ninja.target or not node:
        fail("The engine build requires hermetic CMake, Ninja, and Node toolchains")
    outputs = [ctx.actions.declare_file(ctx.label.name + "/" + ctx.attr.game + "." + extension) for extension in ["js", "wasm"]]
    config = ctx.actions.declare_file(ctx.label.name + ".json")
    ctx.actions.write(config, json.encode({
        "source": ctx.file.marker.dirname,
        "sdl": ctx.file.sdl_marker.dirname,
        "game": ctx.attr.game,
        "overlay": ctx.file.overlay_marker.dirname,
        "compiler": ctx.file.compiler.path,
        "cmake": cmake.env.get("CMAKE", cmake.path),
        "ninja": ninja.env.get("NINJA", ninja.path),
        "node": node.path,
        "outputs": [file.path for file in outputs],
    }))
    ctx.actions.run(
        executable = ctx.executable._builder,
        arguments = [config.path],
        inputs = depset(ctx.files.srcs + ctx.files.sdl + ctx.files.overlay + ctx.files.sdk + [config, node], transitive = [cmake.target.files, ninja.target.files]),
        tools = [ctx.attr._builder[DefaultInfo].files_to_run],
        outputs = outputs,
        env = {"PYTHONDONTWRITEBYTECODE": "1"},
        mnemonic = "VanillaConquerWebAssembly",
        progress_message = "Cross-compiling %s to WebAssembly" % ctx.attr.game,
    )
    return [
        DefaultInfo(files = depset(outputs)),
        OutputGroupInfo(javascript = depset([outputs[0]]), wasm = depset([outputs[1]])),
    ]

engine_build = rule(
    implementation = _engine_impl,
    attrs = {
        "srcs": attr.label_list(allow_files = True),
        "sdl": attr.label_list(allow_files = True),
        "sdl_marker": attr.label(allow_single_file = True),
        "game": attr.string(mandatory = True, values = ["vanillara", "vanillatd"]),
        "marker": attr.label(allow_single_file = True),
        "overlay": attr.label_list(allow_files = True),
        "overlay_marker": attr.label(allow_single_file = True),
        "compiler": attr.label(allow_single_file = True, cfg = "exec"),
        "sdk": attr.label(cfg = "exec"),
        "_builder": attr.label(default = ":build_engine", executable = True, cfg = "exec"),
    },
    toolchains = [
        "@rules_foreign_cc//toolchains:cmake_toolchain",
        "@rules_foreign_cc//toolchains:ninja_toolchain",
        "@rules_nodejs//nodejs:toolchain_type",
    ],
)
