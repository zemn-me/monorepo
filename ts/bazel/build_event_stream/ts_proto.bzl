# model generated this warning! the model generated this.
load("@com_google_protobuf//bazel/common:proto_common.bzl", "proto_common")
load("@com_google_protobuf//bazel/common:proto_info.bzl", "ProtoInfo")

def _ts_proto_library_impl(ctx):
    info = ctx.attr.proto[ProtoInfo]
    outputs = proto_common.declare_generated_files(ctx.actions, info, ".ts")
    if not outputs:
        return DefaultInfo(files = depset())

    args = ctx.actions.args()
    proto_root = info.proto_source_root
    if proto_root.startswith(ctx.bin_dir.path):
        proto_root = proto_root[len(ctx.bin_dir.path) + 1:]
    plugin_output = ctx.bin_dir.path + "/" + proto_root
    args.add("--ts_proto_out=" + plugin_output)
    args.add_joined(["--plugin", "protoc-gen-ts_proto", ctx.executable.protoc_gen_ts_proto.path], join_with = "=")
    if ctx.attr.ts_proto_opts:
        args.add("--ts_proto_opt=" + ",".join(ctx.attr.ts_proto_opts))

    args.add_all(info.transitive_proto_path, map_each = _import_virtual_proto_path)
    args.add_all(info.transitive_proto_path, map_each = _import_repo_proto_path)
    args.add_all(info.transitive_proto_path, map_each = _import_main_output_proto_path)
    args.add("-I.")

    if ctx.fragments.proto.experimental_protoc_opts:
        args.add_all(ctx.fragments.proto.experimental_protoc_opts)

    args.add_all(info.direct_sources)

    ctx.actions.run(
        executable = ctx.executable.protoc,
        arguments = [args],
        inputs = depset(info.direct_sources, transitive = [info.transitive_sources]),
        outputs = outputs,
        mnemonic = "TsProto",
        progress_message = "Generating ts-proto %{label}",
        tools = [ctx.executable.protoc_gen_ts_proto],
        env = {"BAZEL_BINDIR": ctx.bin_dir.path},
    )

    return DefaultInfo(files = depset(outputs))

def _import_virtual_proto_path(path):
    if path.count("/") > 4:
        return "-I%s" % path
    return None

def _import_repo_proto_path(path):
    path_count = path.count("/")
    if path_count > 2 and path_count <= 4:
        return "-I%s" % path
    return None

def _import_main_output_proto_path(path):
    if path.count("/") <= 2 and path != ".":
        return "-I%s" % path
    return None

ts_proto_library = rule(
    implementation = _ts_proto_library_impl,
    attrs = {
        "proto": attr.label(mandatory = True, providers = [ProtoInfo]),
        "protoc_gen_ts_proto": attr.label(mandatory = True, executable = True, cfg = "exec"),
        "protoc": attr.label(
            default = Label("@com_google_protobuf//:protoc"),
            executable = True,
            cfg = "exec",
        ),
        "ts_proto_opts": attr.string_list(default = []),
    },
    fragments = ["proto"],
)
