# Browser engine

- Build the complete runtime with `//project/tiberian_sun/web:engine`; the LCW probe is only a codec test.
- Keep the source pin and browser patch in `MODULE.bazel` and `third_party/opents`. Keep generated engine outputs and original game assets out of Git.
- The browser uses one thread with Asyncify. Waits for audio or input must yield to the event loop; native sleeps can deadlock the audio feeder.
- Keep the `requestFullscreen` runtime export: SDL3 assigns that property, and the assertions-only getter otherwise throws in strict ES modules.
- Verify an asset-backed scenario in a browser before claiming runtime compatibility. Asset-free tests alone establish compilation and packaging.
- Build bundled data through `assets:game_data`; preserve the original EULA and keep music, movies, executables, and installation settings outside the public package.
- `testing:integration_test` drives the production site. Wait for interactive menu highlights and completed dialog-open logs before clicking bitmap controls.

- Except in the opt-in real-time performance run, install `seleniumutil.NewVirtualClock` before game navigation and advance it for test input and simulation. Keep the clock bundle out of production assets; its 32-bit timer handles match Emscripten's C timer API.

- Browser Internet play uses the native LAN lobby over an unordered WebRTC data channel. Keep packet reliability and simulation synchronization in the engine.
- Multiplayer integration advances both game clocks while allowing real ICE/network delivery; compare distinct checksum frames after the native startup suppression.

- `benchmark:benchmark_test` measures real loopback WebRTC with the production adapter, without engine assets. Never use virtual timers for throughput or latency measurements.
