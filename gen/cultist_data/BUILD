load("@io_bazel_rules_go//go:def.bzl", "go_binary")
load("@io_bazel_rules_docker//container:container.bzl", "container_image")
package(default_visibility = ["//gen:__subpackages__"])

go_binary(
    name = "gen_cultist_data",
    srcs = glob(["*.go"])
)

container_image(
    name = "steam_container",
    base = "@steamcmd//image",
)

genrule(
    name = "steam_gen_cultist",
    exec_tools = [  ":steam_container"],
    tools = [ "//go/cmd/zipdir:zipdir" ],
    outs = [ "steam_gen_cultist_out.zip" ],
    cmd = "$(location :steam_container) && docker run -v $$(realpath $@)_tmp:/steam_gen_cultist_gen_data bazel/gen/cultist_data:steam_container +login $$STEAM_USERNAME $$STEAM_PASSWORD +force_install_dir /steam_gen_cultist_gen_data +app_update 718670 +quit"
        +  "&& $(location //go/cmd/zipdir:zipdir) -input $@_tmp -output $@",
    message = "Downloading cultist simulator. Please ensure that --action_env=STEAM_USERNAME and --action_env=STEAM_PASSWORD are both set on the command line and as environment variables"
)
