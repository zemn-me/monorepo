# Original Command & Conquer games for the browser

EA has not endorsed and does not support this product.

Red Alert and Command & Conquer: Tiberian Dawn use the original C++ engines
from [Vanilla Conquer](https://github.com/TheAssemblyArmada/Vanilla-Conquer/tree/ce83b59edd99cccac6cebaae054ca04962c744b7),
cross-compiled with the same pinned Emscripten, CMake, Ninja, Node, and
Python toolchains used by the Tiberian Sun experiment. No Windows executable
or CPU emulator runs in the browser.

The standalone React routes are `/experiments/red-alert` and
`/experiments/command-and-conquer`. They automatically download their
content-addressed engine and gzip game package. Red Alert then shows a Start
button so its intro can begin with browser audio enabled. Escape skips movies.
Each game has a separate IndexedDB save directory. Clearing site data removes local saves. Use a
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

## Build reproducibility

`//project/vanilla_conquer/web:vanillara_reproducibility_test` and
`//project/vanilla_conquer/web:vanillatd_reproducibility_test` compare each
production JavaScript and Wasm artifact byte for byte with a second complete
compilation in a separate Bazel action and fresh temporary directory. Empty
outputs also fail. Both tests run in normal presubmit; unchanged inputs may
reuse the two actions' caches independently.

The builds fix `SOURCE_DATE_EPOCH`, remap source and SDK paths, and fix the
compilation directory recorded in Wasm debug information. These tests check
repeatability with the selected host toolchain, not equality across host
platforms or SDK versions. The data packager separately tests identical
gzip output for identical file contents.

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
Standalone soundtrack archives, expansion packs, and interoperability with
native saves are outside the current port's scope.

## Cinematics on demand

The base Red Alert game package is approximately 24 MiB compressed. Movies
are separate content-addressed `.cinematic.gz` files, each containing one
original VQA and its matching VQP palette when available. The catalog covers
named movies from both the Allied and Soviet discs; shared filenames use
Soviet-disc precedence, matching the native engine's archive order.

Starting the page downloads no cinematics. After Start, the engine requests
its intro, then requests briefing, action, and ending clips only when it
reaches their playback calls. Asyncify suspends the native call while React
shows download progress. Retry repeats only the failed movie; Skip or Escape
cancels that request and lets the native game continue. Navigating away aborts
the request and stops the engine. After playback, movie payloads are released; zero-byte VQA markers advertise catalog entries for the native game's
availability and saved-mission briefing checks. A failed or skipped download
removes its marker so the native text fallback remains available. Playback
always reloads a movie before opening it; content-addressed URLs let the browser cache
serve later replays without retaining every decoded movie in game memory.

Standalone soundtrack archives are excluded. Game assets retain their original
copyrights and are separate from the engine's source-code license.

## Game data

Bazel pins these preserved original freeware discs by SHA-256:

- [Red Alert Allies disc](https://cnc-comm.com/red-alert/downloads/the-game/allies-disc):
  `RA_Allies.zip`, `3b09edca3f93cb50a8d38d163f0c93540c2015f0b7b441cad35cda6d766876d7`.
- [Red Alert Soviet disc](https://cnc-comm.com/red-alert/downloads/the-game/soviet-disc):
  `RA_Soviet.zip`, `8cc097511109f27d853d8e210503139aebc4a3d7fe46af3bd0b9dfb3bd1238a7`.
- [C&C Gold GDI disc](https://cnc-comm.com/command-and-conquer/downloads/the-game/gdi-disc-win95):
  `CNC95_GDI.zip`, `5c35e23ae74dd5d7d6cea58822eb45a2f87548d5507ef65ae584994859e84c75`.

`assets/package_data.py` reads the ISO9660 images and selects explicit
allowlists. Red Alert's core MIX containers are rebuilt using `vanillamix`
without music or movies. `assets/package_cinematics.py` independently extracts
named movies and palettes from both discs and emits deterministic per-movie
packets plus a typed URL catalog. Unnamed archive entries are not exported.
The same validation envelope is used for core data and cinematic packets;
the launcher restricts cinematic packets to the requested movie and palette.

C&C Gold's installed interface data is extracted from `INSTALL/SETUP.Z` using
source-built, pinned `unshieldv3`. Both extraction tools run only at build time.
Original disc readmes are preserved separately.

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
freeware assets, accepts normal difficulty, selects the Allies, Soviets, or GDI,
and checks the first campaign map and three seconds of simulation animation.
The Red Alert flow checks the React Start button at desktop and phone widths,
starts with the keyboard, lets the intro finish, verifies that the first
briefing movie animates for each faction, and skips it into gameplay. Network
observations assert that startup downloads no other movies and core data stays
under 30 MiB. Blocked and delayed movie requests exercise retry, skip, and
keyboard-focused feedback at desktop and phone widths.
Red Alert uses the real browser and Web Audio clock to verify movie-buffer
completion. Tiberian Dawn uses the shared virtual clock for dates, timers,
audio, and input holds. Desktop and phone-width cases block the actual game-data download and
verify that the error is visible and receives keyboard focus.

This establishes the tested initial campaign flows, not complete campaign,
expansion, multiplayer, or native-save interoperability. The port preserves
an IndexedDB user directory, but cross-version save compatibility is not claimed.
