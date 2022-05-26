
load("//:rules.bzl", "nodejs_binary")

def package_json(name, target):
    genquery_name = name + "_deps"
    native.genquery(
        name = genquery_name,
        scope = [ target ],
        expression = "deps("+target+")"
    )

    genrule_name = name + "_gen"
    nodejs_binary(
        name = genrule_name,
        data = [
            "//:package.json",
            genquery_name
        ],
        entry_point = "gen_pkgjson.js",
        templated_args = [
            "--base", "$(rlocation //:package.json)",
            "--query", "$(rlocation " + genquery_name ")"
        ]
    )

    # TODO: would be nice to have a generic way to capture STDOUT
    # and use in genrule.
    native.genrule(
        name = name,
        cmd = "$(execpath " + genrule_name + ")",
    )

