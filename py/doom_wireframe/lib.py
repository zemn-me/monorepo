"""Extract architectural edges from classic Doom map lumps, in original units.

Record layouts follow id Software's linuxdoom-1.10/doomdata.h. Texture, sprite,
sound and gameplay data are deliberately absent from the emitted illustration.
"""

import re
import struct

Point = tuple[int, int, int]
Edge = tuple[Point, Point]


def map_lumps(wad: bytes, level: str) -> dict[str, bytes]:
    if len(wad) < 12 or wad[:4] not in (b"IWAD", b"PWAD"):
        raise ValueError("Expected a classic Doom WAD")
    count, directory = struct.unpack_from("<II", wad, 4)
    if directory + count * 16 > len(wad):
        raise ValueError("Truncated WAD directory")
    active = False
    lumps = {}
    for index in range(count):
        offset, size, raw_name = struct.unpack_from(
            "<II8s", wad, directory + index * 16
        )
        name = raw_name.rstrip(b"\0").decode("ascii")
        if re.fullmatch(r"E\dM\d|MAP\d\d", name):
            if active:
                break
            active = name == level
        elif active:
            if offset + size > len(wad):
                raise ValueError(f"Truncated {name} lump")
            lumps[name] = wad[offset : offset + size]
    required = {"VERTEXES", "LINEDEFS", "SIDEDEFS", "SECTORS"}
    if not required.issubset(lumps):
        raise ValueError(f"Missing geometry for {level}")
    return lumps


def wireframe(wad: bytes, level: str) -> list[Edge]:
    lumps = map_lumps(wad, level)
    vertices = list(struct.iter_unpack("<hh", lumps["VERTEXES"]))
    sides = list(struct.iter_unpack("<hh8s8s8sH", lumps["SIDEDEFS"]))
    sectors = list(struct.iter_unpack("<hh8s8shhh", lumps["SECTORS"]))
    edges: set[Edge] = set()

    def edge(a: Point, b: Point) -> None:
        if a != b:
            edges.add((a, b) if a < b else (b, a))

    def wall(a: tuple[int, int], b: tuple[int, int], low: int, high: int) -> None:
        # Doom's XY plan becomes XZ; reflecting map Y preserves its handedness.
        p, q = (a[0], low, -a[1]), (b[0], low, -b[1])
        r, s = (a[0], high, -a[1]), (b[0], high, -b[1])
        edge(p, q)
        edge(r, s)
        edge(p, r)
        edge(q, s)

    def sector(side: int) -> tuple:
        if side >= len(sides) or sides[side][-1] >= len(sectors):
            raise ValueError("Invalid sidedef or sector reference")
        return sectors[sides[side][-1]]

    for v1, v2, _flags, _special, _tag, front, back in struct.iter_unpack(
        "<HHHHHHH", lumps["LINEDEFS"]
    ):
        if max(v1, v2) >= len(vertices):
            raise ValueError("Invalid vertex reference")
        a, b = vertices[v1], vertices[v2]
        right = sector(front)
        if back == 0xFFFF:
            wall(a, b, right[0], right[1])
            continue
        left = sector(back)
        # Portals between equal-height rooms have no wall. Retain only steps,
        # pits and ceiling changes, rather than drawing the editor's sector grid.
        if right[0] != left[0]:
            wall(a, b, min(right[0], left[0]), max(right[0], left[0]))
        both_sky = right[3].rstrip(b"\0") == left[3].rstrip(b"\0") == b"F_SKY1"
        if right[1] != left[1] and not both_sky:
            wall(a, b, min(right[1], left[1]), max(right[1], left[1]))
    if not edges:
        raise ValueError(f"No architectural edges in {level}")
    return sorted(edges)
