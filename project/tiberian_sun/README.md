# Tiberian Sun for the browser

EA has not endorsed and does not support this product.

The complete OpenTS C++ engine and its dependencies are cross-compiled to
WebAssembly with Emscripten. The browser executes that engine directly;
no original Windows executable, x86 emulator, or Windows image is used.
The website includes game data from the preserved EA 2010 freeware release.
Bazel downloads the original archive over HTTP, verifies its SHA-256, and
extracts an explicit allowlist of 11 game archives and 18 Firestorm maps.
No original assets are committed to Git. Music, movies, original Windows
executables, and installation settings are excluded from the public package.

The site route is `/experiments/tiberian-sun`. Choose **Start game**; no file
upload or Windows installation is needed. The browser downloads about 88 MiB
of compressed data on first use, decompresses it with the standard browser
API, and mounts the user directory on IndexedDB. It starts the engine with
`-DATADIR=/game -USERDIR=/save -WIN -XCC`; the bounded Game log displays the
engine's diagnostics. Game data uses the site's content-addressed asset cache.

## Freeware data and provenance

`@tiberian_sun_freeware//file` pins
[the preserved original release](https://archive.org/details/command-and-conquer-tiberian-sun):
`OfficialCnCTiberianSun.rar`, SHA-256
`b04219e715511de9baa2feb9827013c8e106f8d6b9b563936b8a2f650305dec5`.
The archive retains EA's First Decade installation tree and its February
2010 EULA. The preservation metadata identifies it as the files EA gave
away to promote Command & Conquer 4. [CnCNet's guide](https://cncnet.org/tiberian-sun/how-to-play)
also records the freeware release and links to the community installer.
The previous local BottleShip fixture is not a dependency of this build.

`//project/tiberian_sun/assets:game_data` creates a deterministic gzip package:
`OPENTSD1`, a little-endian 32-bit JSON-header length, a JSON array of
`{name,size}` entries, then the concatenated file bytes. The launcher checks
names, lengths, duplicates, and the required `TIBSUN.MIX` before starting.
`//project/tiberian_sun/assets:game_license` preserves the release's original
`EA_CnCTiberianSunEULA.doc`, linked separately on the page.

UnRAR 7.3.1 is built from pinned vendor source solely as an extraction tool.
Its license stays in the external source repository; it is not linked into
or deployed with the GPL browser engine. The first data build downloads the
1.33 GB original archive, which Bazel then caches. The website serves only
the selected compressed package, engine resources, and notices.

## Build and run

From the monorepo root:

```sh
./sh/bin/bazel build //project/tiberian_sun/web:engine
./sh/bin/bazel run //project/me/zemn:zemn
```

Open <http://localhost:3000/experiments/tiberian-sun>. Use a keyboard and
mouse. The full site build is `//project/me/zemn:build`; it includes the
engine JavaScript, Wasm, bundled open-source UI resources, launcher, freeware data, and
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
The production server test checks the game document and emitted JavaScript,
Wasm entry point, UI resources, and game-data URL. Selection unit tests reject
incomplete or ambiguous releases and ensure music, movies, executable files,
and unrelated paths cannot enter the public package.

`//project/tiberian_sun/testing:integration_test` starts the production website
through `rules_itest` with an assigned port and runs headless Chromium. It
clicks Start, selects Tiberian Sun, opens Skirmish, loads a map with an AI,
selects and deploys the MCV, and checks the rendered construction sidebar
and continuing animation. It reads the visible engine log and screenshots;
there are no test-only game globals or seeded browser storage. Screenshots
are retained in the test's undeclared outputs. This test uses the same
Bazel-downloaded freeware data as the deployed experiment.

Local asset-backed browser testing reached both game-selection discs,
Tiberian Sun's main menu and skirmish setup, then loaded Grand Canyon,
selected the starting MCV, deployed it into a construction yard, and built
and placed a power plant. The packaged engine ran under the production CSP.
A skirmish save survived a page reload and resumed with its buildings and
construction progress intact.
This is runtime evidence for that scenario; it does not establish complete
campaign, cutscene, Firestorm gameplay, or multiplayer compatibility.
The browser build's saved games are local to its origin; cross-platform
save and network compatibility is not claimed.

The user filesystem is persisted through Emscripten IDBFS. Clearing site
data deletes those saves. Downloaded game assets remain outside the
persistent user directory.

## Licensing

The engine, web adapter, and launcher are GPL-3.0-or-later. The local
`LICENSE.md` retains OpenTS's GPL text and additional terms for EA-derived
material. The pinned source includes notices for its open-source rendering,
audio, font, and UI dependencies. The site exposes those notices and a link
to the source and build instructions alongside the game.

Original game assets remain separate from the engine's GPL license. The
original freeware EULA restricts redistribution, including network downloads.
EA's later [C&C modding guidelines](https://www.ea.com/games/command-and-conquer/news/modding-faq)
grant a conditional, revocable license for noncommercial community mods and
exclude music. This implementation preserves the original EULA and records
both sources; the existence of the freeware download is not a legal
clearance for public redistribution. Public hosting requires resolving how
those terms apply to this browser port. No public deployment is performed by
building or running these targets.
