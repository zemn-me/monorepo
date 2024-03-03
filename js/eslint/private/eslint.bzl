load("@npm//:eslint/package_json.bzl", "bin")

"""
Injects a bunch of basic dependencies to make eslint work.
"""

BASE_DATA_DEPS = [
    "//js/eslint/private:data_deps",
    "//:gitignore",
]

def eslint_test(name = None, data = [], args = [], **kwargs):
    bin.eslint_test(
        name = name,
        data = data + BASE_DATA_DEPS,
        args = args,
        # if you exceed this, break up your code!!
        size = "small",
        **kwargs
    )

def eslint_binary(name = None, data = [], args = [], **kwargs):
    bin.eslint_binary(
        name = name,
        data = data + BASE_DATA_DEPS,
        args = args,
        **kwargs
    )
