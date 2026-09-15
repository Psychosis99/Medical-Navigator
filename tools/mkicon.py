#!/usr/bin/env python3
"""Generate the legacy (pre-API-26) launcher PNG with no image libraries.

Adaptive icons cover API 26+ via res/mipmap-anydpi-v26/ic_launcher.xml; older
devices need a real bitmap, so we rasterise the same mark here: a teal rounded
square with a white compass ring and a medical cross.
"""
import math
import struct
import sys
import zlib

SIZE = 192
BG_TOP = (20, 133, 123)
BG_BOTTOM = (15, 118, 110)
WHITE = (255, 255, 255)
MINT = (178, 245, 234)


def blend(dst, src, alpha):
    return tuple(int(round(d + (s - d) * alpha)) for d, s in zip(dst, src))


def coverage(inside, x, y, samples=3):
    """Box-filtered coverage of a predicate -> cheap antialiasing."""
    hits = 0
    step = 1.0 / (samples + 1)
    for i in range(1, samples + 1):
        for j in range(1, samples + 1):
            if inside(x + i * step, y + j * step):
                hits += 1
    return hits / float(samples * samples)


def main(path):
    c = SIZE / 2.0
    radius = SIZE * 0.235          # rounded-square corner radius
    ring_outer = SIZE * 0.335
    ring_inner = SIZE * 0.275
    cross_arm = SIZE * 0.075       # half-thickness of the cross
    cross_len = SIZE * 0.20        # half-length of the cross

    def in_rounded_square(x, y):
        dx = abs(x - c) - (SIZE / 2.0 - radius)
        dy = abs(y - c) - (SIZE / 2.0 - radius)
        if dx <= 0 or dy <= 0:
            return max(abs(x - c), abs(y - c)) <= SIZE / 2.0
        return dx * dx + dy * dy <= radius * radius

    def in_ring(x, y):
        d = math.hypot(x - c, y - c)
        return ring_inner <= d <= ring_outer

    def in_cross(x, y):
        dx, dy = abs(x - c), abs(y - c)
        return (dx <= cross_arm and dy <= cross_len) or (dy <= cross_arm and dx <= cross_len)

    def in_needle(x, y):
        # small mint triangles top and bottom, the "navigator" hint
        dx, dy = abs(x - c), y - c
        h = SIZE * 0.055
        if dy < 0:
            t = (-dy - ring_outer) / h
        else:
            t = (dy - ring_outer) / h
        if t < 0 or t > 1:
            return False
        return dx <= (1 - t) * SIZE * 0.045

    rows = []
    for y in range(SIZE):
        row = bytearray()
        t = y / float(SIZE - 1)
        base = tuple(int(round(a + (b - a) * t)) for a, b in zip(BG_TOP, BG_BOTTOM))
        for x in range(SIZE):
            a_sq = coverage(in_rounded_square, x, y)
            if a_sq == 0:
                row += bytes((0, 0, 0, 0))
                continue
            px = base
            a_needle = coverage(in_needle, x, y)
            if a_needle:
                px = blend(px, MINT, a_needle)
            a_fg = max(coverage(in_ring, x, y), coverage(in_cross, x, y))
            if a_fg:
                px = blend(px, WHITE, a_fg)
            row += bytes((px[0], px[1], px[2], int(round(255 * a_sq))))
        rows.append(bytes(row))

    raw = b"".join(b"\x00" + r for r in rows)

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as fh:
        fh.write(png)
    print("wrote %s (%d bytes, %dx%d)" % (path, len(png), SIZE, SIZE))


if __name__ == "__main__":
    main(sys.argv[1])
