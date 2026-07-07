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
    "d": ((24, 52, 92, 255), (90, 160, 250, 255)),     # azul
    "c": ((92, 74, 18, 255), (250, 208, 84, 255)),     # amarelo
    "b": ((100, 52, 14, 255), (255, 150, 60, 255)),    # laranja
    "a": ((92, 22, 22, 255), (245, 90, 90, 255)),      # vermelho
    "s": ((60, 14, 80, 255), (200, 90, 255, 255)),     # roxo
}


def gate_key_palette(rank):
    d, c = GATE_KEY_RANKS[rank]
    return {".": T, "d": d, "c": c}


# ---------- Texturas de entidade: pele 64x32 escura c/ olhos ----------
# IMPORTANTE: geometry.zombie.v1.8 (vanilla) declara textura 64x32.
# Gerar 64x64 desloca o UV (olhos fora do rosto) — não mude o tamanho.
def make_shadow_skin(path, eye, seed):
    import random
    rng = random.Random(seed)
    px = []
    for y in range(32):
        row = []
        for x in range(64):
            v = 8 + rng.randint(0, 7)  # quase preto com ruído sutil
            row.append((v, v, v + 9, 255))
        px.append(row)
    # Olhos na face frontal da cabeça (layout humanoide: x 8..15, y 8..15)
    dim = (max(eye[0] // 3, 20), max(eye[1] // 3, 20), max(eye[2] // 3, 20), 255)
    for ex in (9, 13):
        for dx in range(2):
            for dy in range(2):
                px[11 + dy][ex + dx] = dim
        px[11][ex] = eye
        px[11][ex + 1] = eye
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png_bytes(64, 32, px))
    print(f"[textures] {path}")


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    items = f"{root}/RP/textures/items"
    write_png(f"{items}/system_core.png", SYSTEM_CORE_ART, SYSTEM_CORE_PALETTE)
    for rank in GATE_KEY_RANKS:
        write_png(f"{items}/gate_key_{rank}.png", GATE_KEY_ART, gate_key_palette(rank))
    # cristal de essência: mesma arte do núcleo, paleta roxa
    write_png(f"{items}/essence_crystal.png", SYSTEM_CORE_ART, {
        ".": T,
        "d": (56, 22, 88, 255),
        "b": (140, 70, 200, 255),
        "c": (190, 120, 255, 255),
        "w": (245, 225, 255, 255),
    })
    ent = f"{root}/RP/textures/entity/arise"
    make_shadow_skin(f"{ent}/shadow_warrior.png", (70, 224, 255, 255), 11)   # olhos cianos
    make_shadow_skin(f"{ent}/shadow_archer.png", (178, 107, 255, 255), 22)   # olhos roxos
    make_shadow_skin(f"{ent}/gate_guardian.png", (255, 74, 74, 255), 33)     # olhos vermelhos


if __name__ == "__main__":
    main()
