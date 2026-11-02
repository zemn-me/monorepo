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

## Functional geometry records

The follow-up to `277201c913` represents `StyledFace3D`, `RenderedFace2D`, and `FaceBSP` as Church-encoded products. A value accepts a callback and supplies its fields as arguments. For example, `styledFace(vertices, fill, layer)` constructs a face and `face((vertices, fill) => ...)` consumes it. These field names are local bindings that the minifier can rename; there are no corresponding object keys. Function identities remain valid weak-map keys. BSP partition batches use labelled tuples, whose labels also disappear at runtime. Mutable SVG node pools, application state, and browser API objects retain their existing representations.

The production page chunk no longer contains the geometry property keys `vertices` or `doubleSided`. Compared with `277201c913`, its size changed from 26,875 to 26,847 bytes, or 10,921 to 10,902 bytes with Python's default gzip compression. That 19-byte gzip reduction is negligible; this change removes a property-name dependency rather than demonstrating a download-size win. No global property-mangling setting was enabled.

The deterministic CPU benchmark's median total increased from 19.88 to 23.72 ms in the before/after samples (about 19%). Median geometry construction was 1.06 versus 2.01 ms, and BSP ordering was 11.11 versus 14.65 ms. Both runs produced the same median 7,656 projected polygons. Closures have a measurable cost in this CPU-only workload; this representation change should not be described as a speed optimization. The browser benchmark and minified production gameplay checks are rerun separately, since DOM work dominates the complete application.

The final Chromium run measured 19.4 SVG updates/s wandering, 23.6 gathering, and 13.6 orbiting. These live-scene measurements vary with simulation timing and machine load, and do not establish a speed gain from Church encoding. All 84 selected checks passed, including the explicit frame benchmark and minified production gameplay test.

## Targeting 30 SVG updates per second

A production benchmark was added to measure the minified export, with the same Chromium viewport, WebGL disablement, warmup, scenarios, and DOM observer as the development benchmark. The production baseline is `cdb4ca6cc7`. Run this target alone to avoid contention with other browser tests:

```sh
./sh/bin/bazel test //ts/pulumi/eggsfordogs.com:park_production_benchmark --test_output=all --nocache_test_results
```

The implementation keeps the SVG renderer and Church-encoded records. It makes these changes:

- Tiny eyes, glints, tags, and flower centres use eight-face closed solids. Other small rounded parts use 18 faces and larger rounded parts use 32. Small discs use 16 sides; the large island keeps 32. All six dogs and park elements remain, with coarser faceting on small meshes. Actor geometry falls from 3,840 to 2,444 faces and scenery from 2,879 to 2,213. Collar geometry is reused instead of reconstructed each frame.
- Lighting uses 1/16 intensity steps instead of 1/32, allowing more adjacent surfaces to share paint. The maximum rounding error is 1/32 intensity. Daytime and moonlight appearances were checked visually.
- Identically colored opaque surfaces terminate BSP construction as one paint batch. When moving geometry enters that batch, all its surfaces participate in intersection sorting. This preserves occlusion across a leaf containing several distinct planes.
- Moving geometry emits its paint order directly instead of constructing and then discarding a tree of closures. Static trees remain cached. Split fragments share their original supporting plane.
- Shared projected vertices also share their formatted SVG coordinate strings, preserving two-decimal precision while avoiding repeated number formatting and nested point allocations.

The deterministic CPU benchmark's median total fell from 23.35 to 15.19 ms in the before/after samples. Median geometry construction was 1.95 → 0.66 ms, ordering 14.29 → 10.33 ms, and SVG path generation 6.14 → 3.07 ms. These measurements exclude DOM updates and paint. Full-suite validation passed all 85 selected targets, including both browser benchmarks, production gameplay, twelve-angle nearest-surface colors, static SVG identity, and the new same-color leaf occlusion regression.

The final isolated production run measured:

| Scenario | Baseline SVG updates/s | Optimized SVG updates/s | Baseline p95 interval | Optimized p95 interval | Baseline median mutations/update | Optimized median mutations/update |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Wandering | 22.2 | 30.0 | 64.8 ms | 49.3 ms | 11,134 | 6,830 |
| Gathering | 27.6 | 30.0 | 54.5 ms | 43.8 ms | 4,160 | 3,588 |
| Orbiting | 13.2 | 25.5 | 99.5 ms | 57.0 ms | 17,288 | 10,222 |

Normal play reaches the 30-update average target in this sample; it is not a guarantee of uniform 33 ms presentation. Continuous camera movement remains below 30 and varies with machine load (other optimization runs measured around 22). The benchmark observes SVG DOM updates, not GPU presentation. Running both browser benchmarks alongside the regression suite lowered throughput, so those concurrent timings were used only as functional checks, not the final comparison.

## Higher throughput without reducing visual detail

A follow-up to `e8a839095b` raises the animation ceiling from 30 to 60 updates per second, while preserving the meshes, lighting quantization, coordinate precision, SVG renderer, and Church products. The sorter now validates input planes once at its entry points, calculates bounds for all three axes in one pass, stops classification once both sides are known, and allocates interpolation distances only for crossing polygons. The SVG root viewBox is updated only when its dimensions change.

The CPU benchmark now hashes projected path strings and colors in paint order across its 80 fixed-step samples, outside the measured interval. The original and optimized sorters produced the identical SHA-256 digest `56026f8b242763ca9834f90a6c2fa0d281834498a09ba147e8ff8815878c8c12`. Both retained 2,213 world faces, 2,444 actor faces, 5,928 static fragments, and a median 5,723 projected polygons. This comparison covers the benchmark trajectory; the existing multi-angle occlusion and SVG browser regressions provide additional coverage.

In the paired CPU samples, median sorting fell from 10.69 to 8.96 ms and total geometry-to-SVG time from 15.86 to 14.23 ms. Total p95 was noisy (27.78 versus 33.60 ms), so this does not establish an improvement in every slow frame. Matrix-only transformation was approximately 0.14 ms in the initial profile.

Isolated production benchmark results at 1200 × 800, with WebGL disabled:

| Scenario | Original updates/s | Follow-up updates/s | Original p95 interval | Follow-up p95 interval |
| --- | ---: | ---: | ---: | ---: |
| Wandering | 29.7 | 30.8–33.4 | 47.3 ms | 42.9–48.3 ms |
| Gathering | 30.0 | 41.3–42.2 | 51.6 ms | 35.6–37.2 ms |
| Orbiting | 19.3 | 19.0–19.2 | 75.7 ms | 72.5–83.1 ms |

The follow-up range spans runs before and after avoiding the redundant viewBox write; that small change did not demonstrate a speed gain. These measurements show a clear gathering gain, a modest wandering gain, and no demonstrated orbiting gain. A 60-update ceiling is not a claim of 60 FPS. Live simulation and machine load vary; these remain DOM-update measurements rather than compositor presentation telemetry.

Chrome Performance counters on the original production build measured 3.80 seconds of script and 0.78 seconds of style/layout work during 6.06 seconds of wandering. Orbiting used 4.11 seconds of script and 1.10 seconds of style/layout in 6.06 seconds. Other browser tasks consumed roughly 0.82–0.84 seconds; these counters do not isolate paint or garbage collection. Surface sorting/splitting and SVG updates remain the main optimization opportunities. A trial of cached axis-aligned face bounds was slower and was not retained.

## Collision-aware dogs

Dogs now have ground-plane collision circles scaled with their meshes, steering to pass one another, and positional separation after movement. Initial positions and gathering targets leave room for all six dogs. Nearby eggs share one retriever so a ring of solid dogs cannot block every dog from reaching a treat. Pickup is checked after separation. The renderer still handles intersecting surfaces within each dog and ordinary occlusion against the park.

The fixed-step CPU benchmark accepts `wander`, `gather`, or `crowd` (twelve eggs at the center). For example:

```sh
./sh/bin/bazel run //ts/pulumi/eggsfordogs.com/app:park_bench -- crowd
```

Compared with the higher-throughput implementation immediately before collisions:

| Scenario | Sorting before | Sorting with collisions | Geometry-to-SVG before | Geometry-to-SVG with collisions |
| --- | ---: | ---: | ---: | ---: |
| Wandering | 8.38 ms | 7.31 ms | 13.20 ms | 11.52 ms |
| Gathering | 7.73 ms | 6.98 ms | 12.04 ms | 10.86 ms |
| Crowded treats | 8.60 ms | 7.29 ms | 13.67 ms | 11.59 ms |

Simulation medians rose from 0.009–0.011 ms to 0.012–0.016 ms. Median projected polygon count changed from 5,847 to 5,637 in the crowded-treat case; wandering and gathering counts increased slightly. Trajectories differ because of the new spacing and target assignments, so these samples measure the complete movement change. Mesh detail, colors, projection precision, and SVG ordering are retained.

A production browser run observed 36.1 updates/s wandering, 45.3 gathering, and 22.6 orbiting, with p95 update intervals of 39.1, 34.2, and 62.6 ms respectively. This follows the same 1200 × 800, WebGL-disabled protocol; machine load and simulation timing still affect comparisons. The preceding throughput-only runs measured 30.8–33.4, 41.3–42.2, and 19.0–19.2 updates/s respectively.

Regressions cover collision clearance throughout gathering and clustered retrieval at 20 and 60 simulation steps/s, coincident dogs at the island boundary, deterministic recovery without input mutation, complete retrieval of twelve boundary treats, and collision-circle containment of the animated dog mesh. All 83 selected SVG/Eggs for Dogs checks passed, including production gameplay.

## Rigid BSP and group-bounds experiment

A subsequent experiment retained Church-encoded geometry and BSP nodes, used Church-encoded group metadata in weak maps, and tried reusing local-space BSPs under rigid transforms. None of the variants demonstrated a CPU pipeline improvement, so their implementation was removed. The renderer, collision handling, tail fix, model detail, and SVG output from before this experiment are retained.

The same deterministic wandering benchmark ran with 20 warmup frames and 80 measured frames. These are separate local runs, not browser presentation measurements; the baseline was repeated after the experiments to check for machine-load drift.

| Variant | Median geometry ms | Median ordering ms | Median geometry-to-SVG ms | Median projected polygons |
| --- | ---: | ---: | ---: | ---: |
| Starting renderer | 0.70 | 9.04 | 14.56 | 5,769 |
| Primitive bounds and cached local face order | 1.12 | 9.34 | 15.08 | 5,769 |
| Pre-split rigid torso/head assembly | 3.43 | 9.70 | 19.19 | 6,859 |
| Cached assembly planes, splitting visible subsets lazily | 1.07 | 9.34 | 16.15 | 6,409 |
| Bounded cache keyed by relevant source-face subsets | 1.30 | 13.54 | 19.97 | 5,779 |
| Restored renderer, two repeats | 0.65–0.67 | 8.50–8.67 | 13.68–13.70 | 5,769 |

Primitive grouping added instance metadata and order bookkeeping without reducing fragment count. Pre-splitting the rigid assemblies increased actor input faces from 2,444 to 5,552, and both full-assembly approaches produced more projected fragments: cached planes made cuts that the frame-specific sorter could otherwise avoid. The source-subset cache limited that fragmentation but its construction and lookup costs were higher. This does not rule out a different hierarchical renderer; it shows that adding these caches inside the existing flat static-tree insertion pipeline did not pay off.

The starting and both restored runs produced the identical paint-order/path/color digest `130fcd82fc4079fba3770ab7999381ae6101e523ad00dbea096ca828d73637f3`. The experimental variants changed fragmentation or ordering and therefore did not preserve that digest. No browser FPS gain is claimed for them.

## React-managed SVG comparison

Measured on 2026-09-05 against `9d605b0911`, using the isolated minified production benchmark in Chromium at 1200 × 800 with WebGL disabled and the light theme explicitly selected. Each scenario has one second of warmup and approximately five seconds of measured DOM updates. The direct renderer ran twice before and twice after the React variants; each React variant ran twice.

The experiment replaced path/paint-slot DOM management with a React root inside the existing scene group. It retained the same BSP sorter, Church-encoded geometry, projection caches, adjacent-color path batching, pooled path descriptors, and stable slot/path keys. Unchanged React elements were cached, including static paint slots. The outer SVG and its accessible title retained their existing ownership. One variant used normal `root.render` scheduling; the other used `flushSync` to request a commit for each renderer update.

| Scenario | Direct updates/s, mean (range) | React scheduled updates/s | Scheduled loss | React synchronous updates/s | Synchronous loss |
| --- | ---: | ---: | ---: | ---: | ---: |
| Wandering | 32.3 (32.1–32.7) | 28.8 | 11% | 28.7 | 11% |
| Gathering | 42.9 (42.4–43.5) | 39.7 | 7% | 40.1 | 6% |
| Orbiting | 24.1 (23.9–24.5) | 20.7 | 14% | 21.4 | 11% |

The percentages compare means across runs. These are SVG DOM update rates, not compositor presentation FPS or an isolated measurement of React CPU time. The simulations are live, so poses and fragment counts vary with timing; the results describe this implementation on this machine, not a universal React overhead. The before/after direct-renderer repeats remained consistent.

Both React variants passed the production gameplay and theme regressions. The synchronous variant also passed the existing static-node identity, paint-order, camera, theme, and resize adapter tests. Normal scheduled rendering commits asynchronously, so those synchronous adapter assertions were not used for that variant.

The React runtime changes and temporary dependencies were removed after measurement. The existing direct renderer remains in use, and the production build was restored by the final baseline runs. React was viable with a modest but measurable throughput cost; these results do not support treating it as inherently unsuitable for SVG animation.

## Initial SVG before hydration

The static export now includes the complete initial park, using the same ordering, projection, and paint batching as the live renderer. React hydrates the controls and an opaque SVG host; the imperative renderer adopts its groups and paths, including across development effect restarts. The geometry remains Church-encoded, and animation still bypasses React reconciliation. CSS follows the system theme before scripts run. The fixed initial viewBox scales to the viewport until the live renderer measures it.

The production HTML changed from 9,536 to 1,466,910 bytes, or 3,271 to 217,913 bytes using Python's default gzip compression. These are artifact sizes, not measured CDN transfers. The snapshot and React's serialized payload increase the download by approximately 210 KiB compressed; the benefit is a visible park before JavaScript starts, including when JavaScript is disabled.

A local production startup sample observed the initial SVG in the DOM at 34 ms, first contentful paint at 97 ms, and enabled controls at 220 ms after navigation. First contentful paint is a page metric, not proof that every SVG path had painted at that instant. The node-adoption check retained the original scene and path and reported 5,139 scene paths. These local timings exclude realistic network latency and are observations rather than CI thresholds.

An isolated production benchmark measured 40.8 SVG updates/s wandering, 53.1 gathering, and 32.9 orbiting, with p95 intervals of 39.4, 30.7, and 43.0 ms. The protocol remains Chromium at 1200 × 800 with WebGL disabled. This showed no apparent steady-state regression, but it was not an interleaved baseline comparison and does not establish a speed gain from prerendering.

Browser regressions verify the visible SVG and light/dark theme with JavaScript disabled, original-node adoption without hydration errors, and live gameplay and theme changes in both development and production. Adapter tests additionally check exact snapshot/live markup agreement, retained node identity, effect-restart adoption, and escaped SVG attributes.
