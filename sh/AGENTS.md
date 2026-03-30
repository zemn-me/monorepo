# sh learnings

- `sl` from Ubuntu `.deb` is not self-contained: bundle matching `libpython` + python stdlib/minimal + `libssl1.1` in Bazel and set `LD_LIBRARY_PATH` + `PYTHONPATH` in the wrapper.
