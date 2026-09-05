# Eggs for Dogs

Render the park to SVG using the camera and projection in `ts/math/wireframe_render.ts`. Keep reusable mesh primitives and the SVG DOM adapter in `ts/3d`; do not introduce Canvas or WebGL here.

The Next dev server consumes Bazel-generated JavaScript. Rebuild `:dev` and restart the server when edits do not appear; a browser reload alone can leave stale modules visible.

The browser integration test deliberately disables WebGL to verify that the SVG experience stays independent of graphics acceleration.
