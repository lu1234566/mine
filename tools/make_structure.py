#!/usr/bin/env python3
# ============================================================
# ARISE — make_structure.py
# Gera BP/structures/arise/gate_arena.mcstructure — a arena dos
# portais — em NBT little-endian NÃO comprimido (formato Bedrock).
#
# Layout (33 x 12 x 33):
#   y0        piso: blackstone com grade de polished_blackstone_bricks
#             e sea lanterns embutidas
#   y1..y8    paredes de obsidiana no perímetro (acentos de
#             crying_obsidian), interior de ar
#   y9        teto de barrier (invisível, anti-fuga)
#
# Uso: python3 make_structure.py <raiz-do-repo>
# ============================================================
import os
import struct
import sys

TAG_BYTE, TAG_INT, TAG_LONG = 1, 3, 4
TAG_STRING, TAG_LIST, TAG_COMPOUND = 8, 9, 10

# versão de blockstate (1.21.0.3 -> (1<<24)|(21<<16)|(0<<8)|3)
BLOCK_VERSION = (1 << 24) | (21 << 16) | (0 << 8) | 3


def _str(s):
    b = s.encode("utf-8")
    return struct.pack("<H", len(b)) + b


def _payload(t, v):
    if t == TAG_BYTE:
        return struct.pack("<b", v)
    if t == TAG_INT:
        return struct.pack("<i", v)
    if t == TAG_LONG:
        return struct.pack("<q", v)
    if t == TAG_STRING:
        return _str(v)
    if t == TAG_LIST:
        et, items = v
        out = struct.pack("<bi", et, len(items))
        for item in items:
            out += _payload(et, item)
        return out
    if t == TAG_COMPOUND:
        out = b""
        for name, (tt, vv) in v.items():
            out += struct.pack("<b", tt) + _str(name) + _payload(tt, vv)
        return out + b"\x00"
    raise ValueError(t)


def block(name):
    return (TAG_COMPOUND, {
        "name": (TAG_STRING, name),
        "states": (TAG_COMPOUND, {}),
        "version": (TAG_INT, BLOCK_VERSION),
    })


SX, SY, SZ = 33, 12, 33
AIR, BLACKSTONE, BRICKS, OBSIDIAN, LANTERN, CRYING, BARRIER = range(7)
PALETTE = [
    block("minecraft:air"),
    block("minecraft:blackstone"),
    block("minecraft:polished_blackstone_bricks"),
    block("minecraft:obsidian"),
    block("minecraft:sea_lantern"),
    block("minecraft:crying_obsidian"),
    block("minecraft:barrier"),
]


def pick_block(x, y, z):
    borda = x in (0, SX - 1) or z in (0, SZ - 1)
    if y == 0:  # piso
        if (x % 8 == 0 and z % 8 == 0) and not borda:
            return LANTERN
        if x % 4 == 0 or z % 4 == 0:
            return BRICKS
        return BLACKSTONE
    if 1 <= y <= 8:  # paredes / interior
        if borda:
            # acentos brilhantes nas paredes
            if y in (2, 5) and (x % 6 == 0 or z % 6 == 0):
                return CRYING
            return OBSIDIAN
        return AIR
    if y == 9:  # teto invisível
        return BARRIER
    return AIR


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    indices = []
    for x in range(SX):
        for y in range(SY):
            for z in range(SZ):
                indices.append(pick_block(x, y, z))

    nbt = {
        "format_version": (TAG_INT, 1),
        "size": (TAG_LIST, (TAG_INT, [SX, SY, SZ])),
        "structure": (TAG_COMPOUND, {
            "block_indices": (TAG_LIST, (TAG_LIST, [
                (TAG_INT, indices),
                (TAG_INT, [-1] * len(indices)),
            ])),
            "entities": (TAG_LIST, (0, [])),  # lista vazia: elem type 0 (TAG_End)
            "palette": (TAG_COMPOUND, {
                "default": (TAG_COMPOUND, {
                    "block_palette": (TAG_LIST, (TAG_COMPOUND, [p[1] for p in PALETTE])),
                    "block_position_data": (TAG_COMPOUND, {}),
                }),
            }),
        }),
        "structure_world_origin": (TAG_LIST, (TAG_INT, [0, 0, 0])),
    }
    payload = struct.pack("<b", TAG_COMPOUND) + _str("") + _payload(TAG_COMPOUND, nbt)

    out = f"{root}/BP/structures/arise/gate_arena.mcstructure"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "wb") as f:
        f.write(payload)
    print(f"[structure] {out} ({len(payload)} bytes, {SX}x{SY}x{SZ})")


if __name__ == "__main__":
    main()
