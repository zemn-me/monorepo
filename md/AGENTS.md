# md

For markdown links to files in other Bazel packages, the destination must have
an exported target; raw source labels like `//pkg:file` fail unless the package
exports that file.
