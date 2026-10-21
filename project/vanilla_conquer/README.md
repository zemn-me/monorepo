# Original Command & Conquer games for the browser

EA has not endorsed and does not support this product.

Red Alert and Command & Conquer: Tiberian Dawn use the original C++ engines
from [Vanilla Conquer](https://github.com/TheAssemblyArmada/Vanilla-Conquer/tree/ce83b59edd99cccac6cebaae054ca04962c744b7),
cross-compiled with the same pinned Emscripten, CMake, Ninja, Node, and
Python toolchains used by the Tiberian Sun experiment. No Windows executable
or CPU emulator runs in the browser.

The standalone React routes are `/experiments/red-alert` and
`/experiments/command-and-conquer`. They automatically download their
content-addressed engine and gzip game package. Each game has a separate
IndexedDB save directory. Clearing site data removes local saves. Use a
keyboard and mouse. Exit the game to return to the previous page.

From the monorepo root:

```sh
./sh/bin/bazel build //project/vanilla_conquer/web:vanillara //project/vanilla_conquer/web:vanillatd
./sh/bin/bazel run //project/me/zemn:zemn
./sh/bin/bazel test //project/vanilla_conquer/...
```

The complete production website target is `//project/me/zemn:build`.
`testing:integration_test` runs against that production bundle with an
automatically assigned service port.

## Browser adaptation

`third_party/vanilla_conquer/web.patch` supplies the small browser platform
changes. SDL2 renders through WebGL; Emscripten's OpenAL implementation
provides Web Audio. Timing sleeps and modal input polling yield through
Asyncify so the browser can paint, deliver input, and service audio.
Browser builds retain the existing engine diagnostics in the console.

SDL2 is built from pinned source, rather than allowing Emscripten to fetch
and mutate a port cache during a Bazel action. The build has no dependency
on a separately installed Emscripten SDK, Windows, SDL, or OpenAL.
The optional score archive is detected before starting a playlist, so an
asset package without music cannot enter an endless track search.
Native networking is disabled; browser multiplayer is not implemented.
Music, movies, expansion packs, and interoperability with native saves are
outside the current port's scope.

## Game data

Bazel pins these preserved original freeware discs by SHA-256:

- [Red Alert Allies disc](https://cnc-comm.com/red-alert/downloads/the-game/allies-disc):
  `RA_Allies.zip`, `3b09edca3f93cb50a8d38d163f0c93540c2015f0b7b441cad35cda6d766876d7`.
- [C&C Gold GDI disc](https://cnc-comm.com/command-and-conquer/downloads/the-game/gdi-disc-win95):
  `CNC95_GDI.zip`, `5c35e23ae74dd5d7d6cea58822eb45a2f87548d5507ef65ae584994859e84c75`.

`assets/package_data.py` reads the ISO9660 images and selects explicit
allowlists. Red Alert's original MIX containers are rebuilt using the
upstream `vanillamix` tool to retain local-disc detection while excluding
music and movies. C&C Gold's installed interface data is extracted from
`INSTALL/SETUP.Z` using source-built, pinned `unshieldv3`; only allowlisted
MIX files enter the browser package. Red Alert's cinematic-only `NCHIRES.MIX`
is also excluded: it contains an embedded intro VQA as well as movie palettes. Both extraction tools run only at
build time. Original disc readmes are preserved separately.

The deterministic gzip package contains `VANILLD1`, a little-endian 32-bit
JSON header length, an array of `{name,size}` entries, and concatenated
file bytes. The launcher validates names, sizes, duplicates, and required
game archives before starting the engine. Original game data and generated
JavaScript/Wasm are not committed to Git.

The source engine and browser adapter are GPL-3.0-or-later, with the EA
additional terms retained in `License.txt`. SDL2 retains its zlib license.
The original game data remains separate from these source-code licenses;
the freeware provenance and source-code license do not relicense the assets.

## Runtime verification

The browser integration test drives both production routes with the original
freeware assets, accepts normal difficulty, selects the Allies or GDI,
and checks the first campaign map and three seconds of simulation animation.
It uses the shared virtual browser clock for dates, timers, audio, and input
holds. Desktop and phone-width cases block the actual game-data download and
verify that the error is visible and receives keyboard focus.

This establishes the tested initial campaign flows, not complete campaign,
expansion, multiplayer, or native-save interoperability. The port preserves
an IndexedDB user directory, but cross-version save compatibility is not claimed.
