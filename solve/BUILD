load("@rules_python//python:defs.bzl", "py_binary")
load("@pip//:requirements.bzl", "requirement")

py_binary(
  name = "main",
  srcs = ["main.py"],
  deps = [ requirement("z3-solver") ],
  data = [ "//gen:core_en.json" ]
)