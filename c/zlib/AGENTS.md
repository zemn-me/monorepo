# zlib build notes

- Sapling's Bazel Linux build needs a real zlib install available via `pkg-config`; newer `libz-sys` crates no longer ship bundled `src/zlib` sources in the crate tarball, so `//c/zlib` must stay wired into `//bin/host/sl`.
