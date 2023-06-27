# Fix API

The fix API is a type of standard Bazel API I've been working on with the eventual
goal of allowing automatically generated PRs to be able to update certain kinds
of file automatically.

An implementer of the fix API is a test, such as a lint test. The test allows an
automatic fix simply by having a '.fix' `bazel run`-able executable; for example
`//:test` should be fixed by `//:test.fix`.

`bazel query` can be used to determine quickly if a '.fix' is available:

```
bazel query //:test.fix
```
