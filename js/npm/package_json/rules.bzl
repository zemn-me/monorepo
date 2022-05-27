load("//:rules.bzl", "nodejs_binary")

def package_json(name, target, template):
    """
    Generate a package.json for a given target.
    """
    genquery_name = name + "_deps"
    native.genquery(
        name = genquery_name,
        scope = [target],
        expression = "deps(" + str(Label("//" + native.package_name()).relative(target)) + ", 1)",
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
