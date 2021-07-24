
package(default_visibility = [":__subpackages__"]) 

genrule(
    name = "gen_core",
    srcs = glob(["content/core/**/*.json"]),
    exec_tools = [ "//gen:collate_game_core" ],
    outs = [ "core_en.json" ],
    cmd = "./$(execpath //gen:collate_game_core) $(SRCS) > $@",
    message = "generating collated game data"
)