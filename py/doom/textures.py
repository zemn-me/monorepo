"""Decode Doom's indexed flats and column-post composite wall textures."""

import base64
import struct


def decode_patch(data):
    width, height = struct.unpack_from('<HH', data)
    pixels = [None] * (width * height)
    for x in range(width):
        offset = struct.unpack_from('<I', data, 8 + x * 4)[0]
        while data[offset] != 255:
            top, length = data[offset:offset + 2]
            for y, color in enumerate(data[offset + 3:offset + 3 + length], top):
                if y < height:
                    pixels[y * width + x] = color
            offset += length + 4
    return width, height, pixels


def encode(width, height, pixels):
    result = {'width': width, 'height': height,
              'pixels': base64.b64encode(bytes(p or 0 for p in pixels)).decode()}
    if None in pixels:
        result['alpha'] = base64.b64encode(bytes(0 if p is None else 255 for p in pixels)).decode()
    return result


def wall_textures(lumps, names):
    pnames = lumps['PNAMES']
    patch_count = struct.unpack_from('<I', pnames)[0]
    patch_names = [pnames[4 + i * 8:12 + i * 8].rstrip(b'\0').decode().upper() for i in range(patch_count)]
    output = {}
    for source in ('TEXTURE1', 'TEXTURE2'):
        if source not in lumps:
            continue
        data = lumps[source]
        count = struct.unpack_from('<I', data)[0]
        for i in range(count):
            offset = struct.unpack_from('<I', data, 4 + i * 4)[0]
            name = data[offset:offset + 8].rstrip(b'\0').decode().upper()
            if name not in names:
                continue
            width, height = struct.unpack_from('<HH', data, offset + 12)
            patches = struct.unpack_from('<H', data, offset + 20)[0]
            pixels = [None] * (width * height)
            for j in range(patches):
                ox, oy, index = struct.unpack_from('<hhH', data, offset + 22 + j * 10)
                pw, ph, patch = decode_patch(lumps[patch_names[index]])
                for py in range(ph):
                    for px in range(pw):
                        x, y = ox + px, oy + py
                        color = patch[py * pw + px]
                        if 0 <= x < width and 0 <= y < height and color is not None:
                            pixels[y * width + x] = color
            output['wall:' + name] = encode(width, height, pixels)
    missing = names - {key.removeprefix('wall:') for key in output}
    if missing:
        raise ValueError('Missing wall textures: ' + ', '.join(sorted(missing)))
    return output


def extract_textures(lumps, sectors, sides):
    names = {texture.rstrip(b'\0').decode().upper() for side in sides for texture in side[2:5]}
    names.discard('-')
    names.discard('')
    names.add('SKY1')
    textures = wall_textures(lumps, names)
    flats = {texture.rstrip(b'\0').decode().upper() for sector in sectors for texture in sector[2:4]}
    for name in flats - {'F_SKY1'}:
        textures['flat:' + name] = encode(64, 64, list(lumps[name]))
    return {name: {'width': tex['width'], 'height': tex['height'],
                   'url': png_url(tex, lumps['PLAYPAL'][:768])}
            for name, tex in textures.items()}


def png_url(texture, palette):
    """Small, deterministic RGBA PNG; no image-tool or runtime decoding dependency."""
    import zlib
    width, height = texture['width'], texture['height']
    indices = base64.b64decode(texture['pixels'])
    alpha = base64.b64decode(texture['alpha']) if 'alpha' in texture else bytes([255]) * len(indices)
    rows = bytearray()
    for y in range(height):
        rows.append(0)
        for x in range(width):
            i = y * width + x
            rows.extend(palette[indices[i] * 3:indices[i] * 3 + 3])
            rows.append(alpha[i])
    def chunk(name, data):
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', zlib.crc32(name + data))
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b'')
    return 'data:image/png;base64,' + base64.b64encode(png).decode()
