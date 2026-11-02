# Doom E1M1 — Hangar

The background is generated from **E1M1: Hangar**, the first level of the original
Doom, using the Doom shareware 1.9 WAD (id Software). It uses original map vertices
and sector floor/ceiling heights, uniformly scaled; the geometry is not hand-traced
or vertically exaggerated. Doors are shown in their initial state.

Bazel downloads the [archived shareware WAD](https://www.wad-archive.com/wad/5b2e249b9c5133ec987b3ea77596381dc0d6bc1d)
using a pinned SHA-256, then runs `//py/doom_wireframe:doom_wireframe_bin` to emit
the typed segment data. Generated geometry is not committed. Only the E1M1
architectural lines are included in the site; the WAD, textures, sprites, sound,
and the other levels are not shipped.

The converter follows the record layouts in
[id Software's doomdata.h](https://github.com/id-Software/DOOM/blob/master/linuxdoom-1.10/doomdata.h).
One-sided lines become wall outlines; two-sided lines contribute only floor or
ceiling changes. Equal-height portals and shared sky ceilings do not create
imaginary walls. Repeated and zero-length edges are removed. Map Y is reflected
into world Z to preserve the original floor plan's orientation in a Y-up scene.

Source WAD SHA-256: `1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771`.
The source map contains 475 linedefs and 85 sectors. Doom and its map data belong
to id Software; this is an architectural illustration, not a playable port.
