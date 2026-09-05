# SVG park performance

Measured on 2026-09-04 on the development Mac, using Chromium at 1200 × 800 with WebGL disabled. The baseline is commit `2e786fa633`. Both browser runs use the same benchmark and the Next integration service. Each scenario has a one-second warmup and approximately five seconds of samples.

| Scenario | Before SVG updates/s | After SVG updates/s | Before p95 interval | After p95 interval | Before median DOM mutations/update | After median DOM mutations/update |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Wandering | 9.5 | 19.9 | 127.8 ms | 70.9 ms | 31,776 | 11,129 |
| Gathering | 10.1 | 27.0 | 115.5 ms | 56.5 ms | 25,428 | 3,414 |
| Orbiting | 8.6 | 11.8 | 156.0 ms | 117.9 ms | 25,906 | 16,542 |

Wandering's visible SVG path count dropped from approximately 11,900 to 7,080. Counts vary with poses, intersections, and visibility. These are observed SVG update intervals from a DOM mutation observer, not GPU presentation telemetry. The scenarios run the live simulation, so elapsed simulation time and geometry can differ between faster and slower runs. Browser version, viewport, and machine load affect the results. The animation target remains 30 updates per second; camera changes are coalesced onto animation frames.

## What changed

- Sphere latitude bands use planar quads. Cylinders use polygon caps, and boxes use six faces. This removes internal triangulation diagonals and degenerate pole triangles while retaining the surfaces.
- Mesh instances and projection share vertices, reducing repeated matrix operations and temporary arrays. Polygons already inside the camera depth range bypass clipping allocations.
- The static BSP tree survives camera movement. SVG paint slots keep static paths anchored while moving geometry changes in the gaps. Hidden faces are culled during projection.
- Adjacent fragments with the same fill share compound paths. Lighting uses 1/32 intensity steps to reduce nearly identical fills; the maximum rounding change is 1/64 intensity.
- Camera and resize events request a frame instead of synchronously redrawing the entire scene. The frame deadline no longer depends on floating-point comparisons against the last simulation timestamp.

The minified production export also runs through the browser gameplay test, guarding against optimizer-only rendering failures. The twelve-angle dog visibility regression remains in place. Additional tests check closed, planar primitive surfaces, correct SVG front/back ordering, unchanged static DOM nodes during movement, and camera/theme invalidation.

## Repeat the measurements

Run the browser benchmark explicitly; it is excluded from the normal test suite:

```sh
./sh/bin/bazel test //ts/pulumi/eggsfordogs.com:park_benchmark --test_output=all --nocache_test_results
```

It reports wandering, gathering, and orbiting as JSON lines prefixed with `SVG benchmark:`. The service wrapper owns the benchmark arguments and assigns its service ports automatically.

For CPU geometry, culling, ordering, and projection timings with fixed simulation steps:

```sh
./sh/bin/bazel run //ts/pulumi/eggsfordogs.com/app:park_bench
```

The CPU benchmark excludes DOM mutation and browser painting. It reports median and p95 over 80 samples after 20 warmups, plus a separate matrix-only diagnostic. Do not equate its `1000 / totalMs` with browser FPS.

## GPU projection

The initial CPU diagnostic spent approximately 19 ms on visibility ordering and 8 ms producing SVG paths, versus 1.3 ms transforming all actor vertices with the compiled camera matrix. Offloading just that matrix work has a small upper bound on the gain. SVG still requires CPU-visible coordinates and path strings. WebGL 2 can capture transformed vertices and retrieve buffers, but retrieving results introduces a CPU/GPU handoff; see the [WebGL 2 specification](https://registry.khronos.org/webgl/specs/2.0/). These measurements favor reducing geometry and DOM work first. GPU offloading was not implemented or benchmarked.

Orbiting still updates the complete projected scene and remains the most expensive scenario. The retained BSP tree avoids rebuilding visibility geometry, but SVG path serialization, DOM updates, and browser paint still cost more than a fixed camera.
