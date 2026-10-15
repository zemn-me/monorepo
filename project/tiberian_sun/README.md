# Tiberian Sun WebAssembly experiment

EA has not endorsed and does not support this product.

This project starts a WebAssembly port for Command & Conquer: Tiberian Sun
and Firestorm by compiling OpenTS's LCW compressor and decompressor. It does
not run either game. The browser probe accepts text, compresses it in C++,
decodes that generated stream, and verifies that every byte survives.
No game assets or original executables are included or downloaded.

## Build and run

From the monorepo root:

```sh
./sh/bin/bazel test //project/tiberian_sun/...
./sh/bin/bazel build //project/tiberian_sun:browser
python3 -m http.server --bind 127.0.0.1 --directory dist/bin/project/tiberian_sun 8000
```

Open <http://localhost:8000>. The build downloads a pinned Emscripten SDK
and OpenTS source archive. It does not require an installed SDK or Windows.
The Node integration test executes the emitted WebAssembly with known LCW
bytes, repeated data, UTF-8, deterministic binary data, buffer boundaries,
and invalid lengths. Browser interaction is a separate manual check: confirm that loading enables
the button, text survives the round trip, and empty input shows a size error.

The ABI owns fixed input, compressed, and decoded buffers. Callers write at
`input_data()` and pass 1–32,768 bytes to `round_trip()`. It returns the
verified decoded size or a negative error code. `compressed_size()` is zero
after rejected input. Calls are synchronous and share those buffers.
Only streams produced by the compressor are passed to the upstream decoder:
`LCW_Uncomp` bounds the output but accepts no compressed input length.
Do not expose it to arbitrary uploaded compressed files without validation.

## Source selection

Inspected 2026-10-14. The build pins
[OpenTS commit 51b52aa](https://github.com/OpenTS-Developers/OpenTS/tree/51b52aa3839281471496652ecfcedb40ca85dbc4)
and verifies its archive SHA-256. OpenTS reconstructs the standalone Tiberian
Sun 2.03 Firestorm engine. Its
[build guide](https://github.com/OpenTS-Developers/OpenTS/blob/51b52aa3839281471496652ecfcedb40ca85dbc4/docs/BUILDING.md)
supports Windows/MSVC, Win32 and x64. Its claims of playable campaigns do
not establish browser compatibility.

Other candidates:

| Project | Fit |
| --- | --- |
| [TS++](https://github.com/Vinifera-Developers/TSpp) | Maps and interacts with the original binary; not a standalone portable engine. |
| [Vinifera](https://github.com/Vinifera-Developers/Vinifera) | Extends the existing Tiberian Sun engine. |
| [Vanilla Conquer](https://github.com/TheAssemblyArmada/Vanilla-Conquer) | Portable C++, but targets Tiberian Dawn and Red Alert rather than Tiberian Sun. |
| [OpenTS](https://github.com/OpenTS-Developers/OpenTS) | Standalone reconstruction covering Tiberian Sun and Firestorm; selected for this experiment. |

`third_party/opents/portable_lcw.patch` removes the unused `always.h`
include from `lcw.cpp`. That umbrella header pulls in engine platform
assumptions. The LCW implementation and header otherwise remain unchanged;
Bazel supplies the C++ standard library through Emscripten. This is a narrow
library build, not a port of OpenTS's CMake configuration.

## Next milestones

1. Load a player's local MIX files and list their contents in the browser.
   Validate archive bounds before passing data to legacy parsers. Keep
   game files local; do not upload or redistribute them.
2. Decode one local palette and sprite and display it. Use this to establish
   asset decoding, indexed colour conversion, and rendering parity.
3. Port engine startup and the simulation loop. Replace `WinMain` and
   synchronous waits with browser scheduling; introduce browser filesystem
   access and save persistence. Verify deterministic simulation separately.
4. Connect rendering, input and audio. The current engine uses bgfx, SDL3,
   miniaudio, RmlUi, and FreeType; their presence alone does not establish
   that the engine integration builds or runs on the web.
5. Run an asset-backed skirmish, then campaigns and Firestorm. Defer
   multiplayer until transport and deterministic execution are verified.

Concrete platform work includes Windows APIs in `gamedirs.cpp`,
`mapgen.cpp`, `loaddlg.cpp`, and `nettime.cpp`, Windows startup in
`startup.cpp`, and waits in `mainloop.cpp`. Save/network compatibility
also needs a decision: OpenTS's build guide documents incompatible raw
layouts between its Win32 and x64 builds without a compatibility guard.
A wasm32 build must not silently claim compatibility with either.

## Licensing and distribution

[OpenTS's license](https://github.com/OpenTS-Developers/OpenTS/blob/51b52aa3839281471496652ecfcedb40ca85dbc4/LICENSE.md)
is GPL-3.0-or-later with additional terms for EA-derived material. The
local `LICENSE.md` reproduces those terms. Preserve file notices,
and distribute corresponding source and build/patch instructions with any
public binary release. The source archive and checksum are in `MODULE.bazel`;
the external `@opents//:source_and_license` target identifies the compiled
upstream files and license. The local C++ adapter, JavaScript harnesses,
and HTML are GPL-3.0-or-later.

The engine license does not grant unrestricted redistribution of original
game data. “Abandonware” is not a redistribution license. EA's
[2025 franchise modding guidelines](https://www.ea.com/games/command-and-conquer/news/modding-faq)
set conditions on community mods, including non-commercial distribution,
no implied endorsement, and no included game music. Those guidelines do not
settle every question about hosting a complete browser edition. Before
hosting original data, establish the applicable asset permissions. The first
milestones use synthetic data and then user-supplied local files.
