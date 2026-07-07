#!/usr/bin/env python3
# ============================================================
# ARISE — make_textures.py
# Gera as texturas do RP (itens 16x16 e, nas fases 5+, entidades)
# sem dependências externas (PNG escrito na mão via zlib/struct).
# Os PNGs são commitados; rode de novo só se a arte mudar.
#
# Uso: python3 make_textures.py <raiz-do-repo>
# ============================================================
import os
import struct
import sys
import zlib


def png_bytes(width, height, pixels):
    """pixels: lista de linhas, cada linha lista de tuplas RGBA."""
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    rows = b""
    for row in pixels:
        rows += b"\x00" + b"".join(bytes(px) for px in row)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows, 9))
            + chunk(b"IEND", b""))


def art_to_pixels(art, palette):
    return [[palette[c] for c in row] for row in art]


def write_png(path, art, palette):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pixels = art_to_pixels(art, palette)
    with open(path, "wb") as f:
        f.write(png_bytes(len(pixels[0]), len(pixels), pixels))
    print(f"[textures] {path}")


T = (0, 0, 0, 0)  # transparente

# ---------- Núcleo do Sistema: cristal ciano 16x16 ----------
SYSTEM_CORE_ART = [
    "................",
    ".......dd.......",
    "......dbbd......",
    ".....dbccbd.....",
    "....dbccccbd....",
    "...dbccwwccbd...",
    "...dbcwwwwcbd...",
    "...dbcwwwwcbd...",
    "...dbccwwccbd...",
    "....dbccccbd....",
    ".....dbccbd.....",
    "......dbbd......",
    ".......dd.......",
    "................",
    "................",
    "................",
]
SYSTEM_CORE_PALETTE = {
    ".": T,
    "d": (16, 56, 92, 255),     # borda escura
    "b": (38, 148, 210, 255),   # azul médio
    "c": (70, 224, 255, 255),   # ciano
    "w": (215, 250, 255, 255),  # brilho
}


# ---------- Chave de Portal 16x16 (recolorida por rank) ----------
GATE_KEY_ART = [
    "................",
    "....ddd.........",
    "...dcccd........",
    "..dc...cd.......",
    "..dc...cd.......",
    "..dc...cd.......",
    "...dcccd........",
    "....dcd.........",
    "....dcd.........",
    "....dcd.........",
    "....dcdcd.......",
    "....dcd.cd......",
    "....dcdcd.......",
    "....dcd.cd......",
    ".....d..d.......",
    "................",
]

# cores (borda, corpo) por rank
GATE_KEY_RANKS = {
    "e": ((30, 66, 30, 255), (94, 190, 94, 255)),      # verde
}


def gate_key_palette(rank):
    d, c = GATE_KEY_RANKS[rank]
    return {".": T, "d": d, "c": c}


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    items = f"{root}/RP/textures/items"
    write_png(f"{items}/system_core.png", SYSTEM_CORE_ART, SYSTEM_CORE_PALETTE)
    for rank in GATE_KEY_RANKS:
        write_png(f"{items}/gate_key_{rank}.png", GATE_KEY_ART, gate_key_palette(rank))


if __name__ == "__main__":
    main()
