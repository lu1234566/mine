#!/usr/bin/env python3
# ============================================================
# ARISE — make_pack_icon.py
# Gera BP/pack_icon.png e RP/pack_icon.png (128x128) sem
# dependências externas (PNG escrito na mão via zlib/struct).
# Os PNGs são commitados no repo; este script só precisa rodar
# de novo se o desenho mudar.
#
# Uso: python3 make_pack_icon.py <raiz-do-repo>
# ============================================================
import struct
import sys
import zlib

# Arte 16x16: seta "erguendo-se" (arise) com haste e base.
# '.' = fundo, 'X' = cor principal, 'o' = brilho interno
ART = [
    "................",
    ".......XX.......",
    "......XooX......",
    ".....XooooX.....",
    "....XooXXooX....",
    "...XooX..XooX...",
    "..XoX..XX..XoX..",
    "..X....XX....X..",
    ".......XX.......",
    ".......XX.......",
    ".......XX.......",
    ".......XX.......",
    "......XXXX......",
    "...XXXXXXXXXX...",
    "................",
    "................",
]

SCALE = 8  # 16 * 8 = 128 px


def png_bytes(width, height, get_rgba):
    """Monta um PNG RGBA 8-bit a partir de uma função (x, y) -> (r, g, b, a)."""
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    rows = b""
    for y in range(height):
        rows += b"\x00"  # filtro 0 (None) por linha
        for x in range(width):
            rows += bytes(get_rgba(x, y))

    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows, 9))
            + chunk(b"IEND", b""))


def make_icon(path, bg, frame, main, glow):
    size = 16 * SCALE

    def pixel(x, y):
        gx, gy = x // SCALE, y // SCALE
        # moldura de 1 "pixel de arte" na borda
        if gx in (0, 15) or gy in (0, 15):
            return frame
        c = ART[gy][gx]
        if c == "X":
            return main
        if c == "o":
            return glow
        return bg

    with open(path, "wb") as f:
        f.write(png_bytes(size, size, pixel))
    print(f"[icon] {path} gerado ({size}x{size})")


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    # BP: azul-ciano ("Sistema")
    make_icon(f"{root}/BP/pack_icon.png",
              bg=(16, 20, 38, 255), frame=(27, 34, 64, 255),
              main=(70, 224, 255, 255), glow=(190, 245, 255, 255))
    # RP: roxo ("sombras")
    make_icon(f"{root}/RP/pack_icon.png",
              bg=(23, 16, 42, 255), frame=(38, 27, 70, 255),
              main=(178, 107, 255, 255), glow=(230, 200, 255, 255))


if __name__ == "__main__":
    main()
