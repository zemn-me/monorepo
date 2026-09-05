# Eggs for Dogs

Render the park to SVG using the camera and projection in `ts/math/wireframe_render.ts`. Keep reusable mesh primitives and the SVG DOM adapter in `ts/3d`; keep the visible park as SVG paths.

The Next dev server consumes Bazel-generated JavaScript. Rebuild `:dev` and restart the server when edits do not appear; a browser reload alone can leave stale modules visible.

The browser integration test deliberately disables WebGL to verify that the SVG experience stays independent of graphics acceleration.

Use `bazel test //ts/pulumi/eggsfordogs.com:park_production_benchmark --test_output=all --nocache_test_results` for production frame timing; run it alone so concurrent browser tests do not skew the sample. Use `bazel test //ts/pulumi/eggsfordogs.com:park_benchmark --test_output=all --nocache_test_results` for browser frame intervals/DOM mutations, and `bazel run //ts/pulumi/eggsfordogs.com/app:park_bench` for deterministic CPU stages. `service_test` needs benchmark arguments on the wrapper, not the underlying `go_test`.

Consume the projected face results when painting SVG; do not rely only on projection-cache side effects. Result helpers carry purity annotations, so production minification can eliminate an unused projection call. Keep `:park_production_test` passing as well as the development-server tests.

Filled faces, projected faces, and BSP nodes are Church-encoded products. Use their constructors/selectors or consume a value with a callback; do not spread or JSON-stringify them. Keep geometry immutable to preserve identity-based caches. Benchmark closure changes as well as inspecting minified bundle size.

Uniform BSP leaves are valid only for identical opaque paint. If foreign geometry enters a leaf, order all of its surfaces together; treating its first plane as the whole volume breaks occlusion.
