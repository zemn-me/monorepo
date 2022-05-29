load("//:rules.bzl", "nodejs_binary")

def package_json(name, targets, template):
    """
    Generate a package.json for a given target.
    """
    genquery_name = name + "_deps"
    native.genquery(
        name = genquery_name,
        scope = targets,
        expression = "deps(" + " ".join([ str(Label("//" + native.package_name()).relative(target)) for target in targets ]) + ", 1)",
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

def _extract_pkg_json_field(ctx):
    src = ctx.file.src

extract_pkg_json_field = rule(
    implementation = _extract_pkg_json_field,
    attrs = {
        "src": attr.label(mandatory = True, allow_single_file = True),
        "field": attr.label(mandatory = True)
    }
)

def pkg_npm(name, pkg_json_base, srcs = []):
    pkg_json_name = name + "_package_json"
    package_json(
        name = pkg_json_name,
        targets = srcs,
        template = pkg_json_base
    )

    hash_file_name = name + "_digest"
    genrule(
        name = hash_file_name,
        srcs = srcs,
        cmd_bash = """
            cat $(SRCS) | sha512sum > $@
        """
    )

    package_version_name = name + "_version"
    genrule(
        name = package_version_name,
        srcs = [ pkg_json_base ],
        cmd_bash = """

        """
    )

