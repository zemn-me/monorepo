# VS Code

The Go extension probes wrapper tools with `go version -m` and asks `gopls`
for `version -json`; keep the `sh/bin/go` and `sh/bin/gopls` metadata shims in
sync with `go.alternateTools` or it may try to `go install ...@latest`.
