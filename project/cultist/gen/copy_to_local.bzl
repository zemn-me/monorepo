load("//js:rules.bzl", _copy_to_local = "copy_to_local")

def copy_to_local(name, **kwargs):
    _copy_to_local(name = name, **kwargs)
