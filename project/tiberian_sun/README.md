# Tiberian Sun for the browser

EA has not endorsed and does not support this product.

The complete OpenTS C++ engine and its dependencies are cross-compiled to
WebAssembly with Emscripten. The browser executes that engine directly;
no original Windows executable, x86 emulator, or Windows image is used.
The player selects an installed game folder locally. Game assets are not
included in the site build or uploaded to a server.

The site route is `/experiments/tiberian-sun`. It starts the game after the
player chooses a folder containing `TIBSUN.MIX`. Include the other `.MIX`
archives, maps, and settings from that installation. Firestorm also needs
its expansion data. The browser imports supported files from the selected
folder, mounts the user directory on IndexedDB, and starts the engine with
`-DATADIR=/game -USERDIR=/save -WIN`.

## Build and run

From the monorepo root:

```sh
./sh/bin/bazel build //project/tiberian_sun/web:engine
./sh/bin/bazel run //project/me/zemn:zemn
```

Open <http://localhost:3000/experiments/tiberian-sun>. Use a keyboard and
mouse. The full site build is `//project/me/zemn:build`; it includes the
engine JavaScript, Wasm, bundled open-source UI resources, launcher, and
license notices as content-addressed public assets. The standalone game
document has its own script policy and opens through a document navigation.
Leaving the page ends that engine instance.

Build inputs are pinned in `MODULE.bazel`, including the source port and
its recursive dependency commits, the Emscripten SDK, and the build
toolchains. The Bazel action uses CMake and Ninja from `rules_foreign_cc`,
Node from `rules_nodejs`, and Python from the repository toolchain. It does
not need a separately installed Emscripten SDK, CMake, Ninja, or Windows.
The first full build downloads and compiles the dependencies.

## Source and browser changes

The full engine starts from
[TFrey98/OpenTS_mac at 92f0aa9](https://github.com/TFrey98/OpenTS_mac/tree/92f0aa9009506c2c090846d3a924bb5a163c4349),
a native source port of
[OpenTS](https://github.com/OpenTS-Developers/OpenTS). That source removes
most of the Windows dependency while retaining the Tiberian Sun 2.03
Firestorm engine. The original, narrower LCW probe still pins upstream
OpenTS independently and remains an asset-free Wasm integration test.

`third_party/opents/web.patch` adapts the source port for the browser:

- Select bgfx's OpenGL ES/WebGL renderer and SDL's browser canvas.
- Read mouse coordinates and button state relative to the canvas.
- Yield event processing, frame presentation, and synchronous waits through
  Emscripten Asyncify so input, rendering, and audio can run.
- Service the audio feeder on a browser timer and yield waits for stream
  closure and audio completion instead of blocking on native threads.
- Guard smoke particle updates after their source object has been detached.
  Calling a cast member on a null source caused a Wasm trap during combat.
- Replace macOS executable paths, timing, CPU/OS diagnostics, and native
  image addresses with browser equivalents. Use POSIX file timestamps and
  filesystem flushes. Preserve source notices and mark the build `wasm32`.

The web overlay supplies the CMake build and browser platform functions.
Emscripten's system processor is explicitly `wasm32`: its compatibility
default of `x86` would enable native SSE flags in the renderer dependency.
The engine uses Wasm SIMD and retains the native source's strict
floating-point compiler options.

## Validation and limits

Affected automated checks:

```sh
./sh/bin/gazelle
./sh/bin/bazel test //project/tiberian_sun/... //project/me/zemn/app/experiments/tiberian_sun/... //project/me/zemn/testing:server_test //:bazel_lint
```

The LCW test executes the compiled upstream compressor with known bytes,
UTF-8, deterministic binary data, buffer boundaries, and rejected lengths.
The production server test checks the game document and the emitted
JavaScript, Wasm entry point, resource package, and local-import launcher.
Automated checks do not require proprietary game data.

Local asset-backed browser testing reached both game-selection discs,
Tiberian Sun's main menu and skirmish setup, then loaded Grand Canyon,
selected the starting MCV, and deployed it into a construction yard.
This is runtime evidence for that scenario; it does not establish complete
campaign, cutscene, Firestorm gameplay, or multiplayer compatibility.
The browser build's saved games are local to its origin; cross-platform
save and network compatibility is not claimed.

The user filesystem is persisted through Emscripten IDBFS. Clearing site
data deletes those saves. Game assets are selected again on a new launch
and remain outside the persistent user directory.

## Licensing

The engine, web adapter, and launcher are GPL-3.0-or-later. The local
`LICENSE.md` retains OpenTS's GPL text and additional terms for EA-derived
material. The pinned source includes notices for its open-source rendering,
audio, font, and UI dependencies. The site exposes those notices and a link
to the source and build instructions alongside the game.

Original game assets remain separate from the engine license. The site
links to the [freeware installer](https://cnc-comm.com/tiberian-sun/downloads/the-game/installer)
and imports the player's local files. It does not bundle original artwork,
music, movies, executables, or archives into the deployment. See
[EA's franchise modding guidelines](https://www.ea.com/games/command-and-conquer/news/modding-faq)
for the conditions on community mods and asset distribution.
