"""Extract convex floor meshes and wall spans from classic Doom map lumps.

The disk layout is documented in id Software's linuxdoom-1.10/doomdata.h.
Subsector floors are clipped against the BSP and their directed wall segments;
joining segment endpoints alone would bridge concave rooms and courtyards.
"""

import json
import struct
from pathlib import Path
from zipfile import ZipFile

from py.doom.textures import extract_textures


def clip(polygon, a, b, side=0):
    """Intersect a convex polygon with the right (0) or left (1) half-plane."""
    def distance(p):
        cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        return cross if side else -cross

    result = []
    for p, q in zip(polygon, polygon[1:] + polygon[:1]):
        dp, dq = distance(p), distance(q)
        if dp >= -1e-7:
            result.append(p)
        if (dp < 0) != (dq < 0):
            t = dp / (dp - dq)
            result.append([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])])
    return result


def extract(data, name):
    magic, count, directory = struct.unpack_from('<4sii', data)
    if magic not in (b'IWAD', b'PWAD') or count < 0 or directory < 12:
        raise ValueError('Invalid WAD header')
    lumps = []
    for i in range(count):
        offset, size, raw_name = struct.unpack_from('<ii8s', data, directory + i * 16)
        if offset < 0 or size < 0 or offset + size > len(data):
            raise ValueError('WAD lump outside file')
        lumps.append((raw_name.rstrip(b'\0').decode('ascii').upper(), data[offset:offset + size]))
    start = next(i for i, lump in enumerate(lumps) if lump[0] == name)
    section = dict(lumps[start + 1:start + 11])

    def records(lump, fmt):
        return list(struct.iter_unpack('<' + fmt, section[lump]))

    vertices = records('VERTEXES', 'hh')
    lines = records('LINEDEFS', '7H')
    sides = records('SIDEDEFS', 'hh8s8s8sH')
    sectors = records('SECTORS', 'hh8s8shhh')
    segs = records('SEGS', '6H')
    leaves = records('SSECTORS', '2H')
    nodes = records('NODES', '12h2H')
    spawn = next(thing for thing in records('THINGS', '5h') if thing[3] == 1)
    xs, ys = list(zip(*vertices))
    center = [(min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2]

    def world(p, height):
        return [round((p[0] - center[0]) / 64, 6), height / 64,
                round((center[1] - p[1]) / 64, 6)]

    walls = []
    for v1, v2, _flags, _special, _tag, front, back in lines:
        floor, ceiling, *_ = sectors[sides[front][-1]]
        spans = [(floor, ceiling)]
        if back != 65535:
            other_floor, other_ceiling, *_ = sectors[sides[back][-1]]
            spans = [(min(floor, other_floor), max(floor, other_floor)),
                     (min(ceiling, other_ceiling), max(ceiling, other_ceiling))]
        for bottom, top in spans:
            if top > bottom:
                walls.append([world(vertices[v1], bottom), world(vertices[v2], bottom),
                              world(vertices[v2], top), world(vertices[v1], top)])

    floors = []
    cells = []
    spawn_floor = 0

    def visit(child, polygon, contains_spawn):
        nonlocal spawn_floor
        if not polygon:
            return
        if child & 0x8000:
            count, first = leaves[child & 0x7fff]
            segments = segs[first:first + count]
            sector = sectors[sides[lines[segments[0][3]][5 + segments[0][4]]][-1]]
            for segment in segments:
                polygon = clip(polygon, vertices[segment[0]], vertices[segment[1]])
            cells.append({'sector': sides[lines[segments[0][3]][5 + segments[0][4]]][-1],
                          'polygon': [[world(p, 0)[0], world(p, 0)[2]] for p in polygon]})
            if contains_spawn:
                spawn_floor = sector[0]
            # Convex BSP leaves can be triangulated as a fan without filling holes.
            for i in range(1, len(polygon) - 1):
                triangle = [polygon[0], polygon[i], polygon[i + 1]]
                a, b, c = triangle
                area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
                if abs(area) > 1e-6:
                    floors.append([world(p, sector[0]) for p in triangle])
            return
        node = nodes[child]
        a, b = node[:2], [node[0] + node[2], node[1] + node[3]]
        cross = node[2] * (spawn[1] - node[1]) - node[3] * (spawn[0] - node[0])
        for side in (0, 1):
            visit(node[12 + side], clip(polygon, a, b, side),
                  contains_spawn and side == int(cross > 0))

    visit(len(nodes) - 1, [[min(xs), min(ys)], [max(xs), min(ys)],
                           [max(xs), max(ys)], [min(xs), max(ys)]], True)
    def texture_name(raw):
        return raw.rstrip(b'\0').decode().upper()

    def side_data(index):
        if index == 65535:
            return None
        side = sides[index]
        return {'sector': side[-1], 'xOffset': side[0], 'yOffset': side[1],
                'upper': texture_name(side[2]), 'lower': texture_name(side[3]),
                'middle': texture_name(side[4])}

    textures = extract_textures(dict(lumps), sectors, sides)
    rooms = [{'floor': sector[0] / 64, 'ceiling': sector[1] / 64,
              'floorTexture': texture_name(sector[2]), 'ceilingTexture': texture_name(sector[3]),
              'light': sector[4], 'tag': sector[6]} for sector in sectors]
    map_lines = [{'a': [world(vertices[line[0]], 0)[0], world(vertices[line[0]], 0)[2]],
                  'b': [world(vertices[line[1]], 0)[0], world(vertices[line[1]], 0)[2]],
                  'flags': line[2], 'special': line[3], 'tag': line[4],
                  'front': side_data(line[5]), 'back': side_data(line[6])} for line in lines]
    return {'origin': center, 'rooms': rooms, 'lines': map_lines, 'cells': cells,
            'textures': textures, 'walls': walls, 'floors': floors,
            'spawn': world(spawn[:2], spawn_floor + 41), 'angle': spawn[2],
            'linedefs': len(lines), 'sectors': len(sectors)}


def generate(archive, output, name):
    with ZipFile(archive) as source:
        level = extract(source.read('DOOM1.WAD'), name)
    Path(output).write_text(
        '// Generated from Doom shareware by //py/doom; do not edit.\n'
        "import type { DoomLevel } from '#root/ts/doom/level.js';\n"
        'export const level: DoomLevel = '
        + json.dumps(level, separators=(',', ':')) + ';\n'
    )
