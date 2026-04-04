# OpenSSL build notes

- OpenSSL here is the upstream C build used by Sapling's Linux Bazel build; keep the source `http_archive` in `MODULE.bazel`, but keep the `rules_foreign_cc` `configure_make` target in `//cc/openssl`.
