# ts/bin

This folder contains Typescript libraries that stitch together foreign binaries, bazel runpaths
and Typescript.

The modules here will give you a string for the path of some binary, the location of which is
resolved at runtime.

The binary itself is in the module's data dependencies -- so you don't need to find the binary
yourself.
