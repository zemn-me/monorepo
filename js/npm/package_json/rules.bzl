load("//js:rules.bzl", "js_run_binary")

def package_json(name, targets, template, version, depSpec):
    """
    Generate a package.json for a given target.
    """
    query_expression = "deps(" + ", ".join([str(Label("//" + native.package_name()).relative(target)) for target in targets]) + ", 1)"
    genquery_name = name + "_deps"
    native.genquery(
        name = genquery_name,
        scope = targets,
        expression = query_expression,
    )

    js_run_binary(
        name = name,
        tool = "//js/npm/package_json:gen_pkgjson_bin",
        srcs = [
            "//:package_json",
            genquery_name,
            "//js/npm/package_json:gen_pkgjson",
            template,
            version,
        ],
        args = [
            "--out",
            "../../../$(execpath package_new.json)",
            "--base",
            "../../../$(location //:package_json)",
            "--query",
            "../../../$(location " + genquery_name + ")",
            "--merge",
            "../../../$(location " + template + ")",
            "--version",
            "../../../$(location " + version + ")",
            "--package_name",
            native.package_name(),
            "--depOnlyOut",
            "../../../$(execpath " + depSpec + ")",
        ],
        outs = ["package_new.json", depSpec],
    )
