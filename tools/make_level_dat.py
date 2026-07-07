#!/usr/bin/env python3
# ============================================================
# ARISE — make_level_dat.py
# Gera um level.dat mínimo e válido para Minecraft Bedrock.
#
# Formato do arquivo:
#   [int32 LE] storage version (10)
#   [int32 LE] tamanho do payload NBT
#   [payload]  NBT little-endian, NÃO comprimido, raiz = compound ""
#
# Sem level.dat o jogo recusa a importação do .mcworld; com este
# arquivo o mundo é gerado do zero (seed aleatória, overworld
# infinito) já com os packs ativados pelos world_*_packs.json.
#
# Uso: python3 make_level_dat.py <saida/level.dat> [NomeDoMundo]
# ============================================================
import struct
import sys
import time
import random

# ---------- Escritor NBT little-endian (subset usado pelo Bedrock) ----------
TAG_BYTE, TAG_SHORT, TAG_INT, TAG_LONG = 1, 2, 3, 4
TAG_FLOAT, TAG_STRING, TAG_LIST, TAG_COMPOUND = 5, 8, 9, 10


def _str(s):
    b = s.encode("utf-8")
    return struct.pack("<H", len(b)) + b


def _payload(tag_type, value):
    if tag_type == TAG_BYTE:
        return struct.pack("<b", value)
    if tag_type == TAG_SHORT:
        return struct.pack("<h", value)
    if tag_type == TAG_INT:
        return struct.pack("<i", value)
    if tag_type == TAG_LONG:
        return struct.pack("<q", value)
    if tag_type == TAG_FLOAT:
        return struct.pack("<f", value)
    if tag_type == TAG_STRING:
        return _str(value)
    if tag_type == TAG_LIST:
        elem_type, items = value
        out = struct.pack("<bi", elem_type, len(items))
        for item in items:
            out += _payload(elem_type, item)
        return out
    if tag_type == TAG_COMPOUND:
        out = b""
        for name, (t, v) in value.items():
            out += struct.pack("<b", t) + _str(name) + _payload(t, v)
        return out + b"\x00"  # TAG_End
    raise ValueError(f"tipo NBT não suportado: {tag_type}")


def build_level_dat(level_name):
    seed = random.getrandbits(63)
    now_ms = int(time.time())
    game_version = [1, 21, 0, 0, 0]  # casa com min_engine_version dos manifests

    root = {
        "BiomeOverride": (TAG_STRING, ""),
        "CenterMapsToOrigin": (TAG_BYTE, 0),
        "ConfirmedPlatformLockedContent": (TAG_BYTE, 0),
        "Difficulty": (TAG_INT, 2),  # normal
        "FlatWorldLayers": (TAG_STRING, '{"biome_id":1,"block_layers":[{"block_name":"minecraft:bedrock","count":1},{"block_name":"minecraft:dirt","count":2},{"block_name":"minecraft:grass_block","count":1}],"encoding_version":6,"structure_options":null,"world_version":"version.post_1_18"}'),
        "ForceGameType": (TAG_BYTE, 0),
        "GameType": (TAG_INT, 0),  # sobrevivência
        "Generator": (TAG_INT, 1),  # overworld infinito
        "InventoryVersion": (TAG_STRING, "1.21.0"),
        "LANBroadcast": (TAG_BYTE, 1),
        "LANBroadcastIntent": (TAG_BYTE, 1),
        "LastPlayed": (TAG_LONG, now_ms),
        "LevelName": (TAG_STRING, level_name),
        "LimitedWorldOriginX": (TAG_INT, 0),
        "LimitedWorldOriginY": (TAG_INT, 32767),
        "LimitedWorldOriginZ": (TAG_INT, 0),
        "MinimumCompatibleClientVersion": (TAG_LIST, (TAG_INT, game_version)),
        "MultiplayerGame": (TAG_BYTE, 1),
        "MultiplayerGameIntent": (TAG_BYTE, 1),
        "NetherScale": (TAG_INT, 8),
        "NetworkVersion": (TAG_INT, 685),  # protocolo do 1.21.0
        "Platform": (TAG_INT, 2),
        "PlatformBroadcastIntent": (TAG_INT, 3),
        "RandomSeed": (TAG_LONG, seed),
        "SpawnV1Villagers": (TAG_BYTE, 0),
        "SpawnX": (TAG_INT, 0),
        "SpawnY": (TAG_INT, 32767),  # 32767 = jogo escolhe o spawn
        "SpawnZ": (TAG_INT, 0),
        "StorageVersion": (TAG_INT, 10),
        "Time": (TAG_LONG, 0),
        "WorldVersion": (TAG_INT, 1),
        "XBLBroadcastIntent": (TAG_INT, 3),
        "baseGameVersion": (TAG_STRING, "*"),
        "bonusChestEnabled": (TAG_BYTE, 0),
        "bonusChestSpawned": (TAG_BYTE, 0),
        "commandblockoutput": (TAG_BYTE, 1),
        "commandblocksenabled": (TAG_BYTE, 1),
        "commandsEnabled": (TAG_BYTE, 0),  # trapaças desligadas (conquistas ok)
        "currentTick": (TAG_LONG, 0),
        "daylightCycle": (TAG_INT, 0),
        "dodaylightcycle": (TAG_BYTE, 1),
        "doentitydrops": (TAG_BYTE, 1),
        "dofiretick": (TAG_BYTE, 1),
        "doimmediaterespawn": (TAG_BYTE, 0),
        "doinsomnia": (TAG_BYTE, 1),
        "domobloot": (TAG_BYTE, 1),
        "domobspawning": (TAG_BYTE, 1),
        "dotiledrops": (TAG_BYTE, 1),
        "doweathercycle": (TAG_BYTE, 1),
        "drowningdamage": (TAG_BYTE, 1),
        "eduOffer": (TAG_INT, 0),
        "educationFeaturesEnabled": (TAG_BYTE, 0),
        "experiments": (TAG_COMPOUND, {
            # Fase 1 usa só API estável: nenhum experimento ligado
            "experiments_ever_used": (TAG_BYTE, 0),
            "saved_with_toggled_experiments": (TAG_BYTE, 0),
        }),
        "falldamage": (TAG_BYTE, 1),
        "firedamage": (TAG_BYTE, 1),
        "freezedamage": (TAG_BYTE, 1),
        "functioncommandlimit": (TAG_INT, 10000),
        "hasBeenLoadedInCreative": (TAG_BYTE, 0),
        "hasLockedBehaviorPack": (TAG_BYTE, 0),
        "hasLockedResourcePack": (TAG_BYTE, 0),
        "immutableWorld": (TAG_BYTE, 0),
        "isFromLockedTemplate": (TAG_BYTE, 0),
        "isFromWorldTemplate": (TAG_BYTE, 0),
        "isRandomSeedAllowed": (TAG_BYTE, 0),
        "isSingleUseWorld": (TAG_BYTE, 0),
        "isWorldTemplateOptionLocked": (TAG_BYTE, 0),
        "keepinventory": (TAG_BYTE, 0),
        "lastOpenedWithVersion": (TAG_LIST, (TAG_INT, game_version)),
        "lightningLevel": (TAG_FLOAT, 0.0),
        "lightningTime": (TAG_INT, random.randint(30000, 100000)),
        "limitedWorldDepth": (TAG_INT, 16),
        "limitedWorldWidth": (TAG_INT, 16),
        "maxcommandchainlength": (TAG_INT, 65535),
        "mobgriefing": (TAG_BYTE, 1),
        "naturalregeneration": (TAG_BYTE, 1),
        "permissionsLevel": (TAG_INT, 0),
        "playerPermissionsLevel": (TAG_INT, 1),
        "prid": (TAG_STRING, ""),
        "pvp": (TAG_BYTE, 1),
        "rainLevel": (TAG_FLOAT, 0.0),
        "rainTime": (TAG_INT, random.randint(30000, 100000)),
        "randomtickspeed": (TAG_INT, 1),
        "requiresCopiedPackRemovalCheck": (TAG_BYTE, 0),
        "respawnblocksexplode": (TAG_BYTE, 1),
        "sendcommandfeedback": (TAG_BYTE, 1),
        "serverChunkTickRange": (TAG_INT, 4),
        "showbordereffect": (TAG_BYTE, 1),
        "showcoordinates": (TAG_BYTE, 1),  # útil para os testes das fases
        "showdeathmessages": (TAG_BYTE, 1),
        "showtags": (TAG_BYTE, 1),
        "spawnMobs": (TAG_BYTE, 1),
        "spawnradius": (TAG_INT, 5),
        "startWithMapEnabled": (TAG_BYTE, 0),
        "texturePacksRequired": (TAG_BYTE, 0),
        "tntexplodes": (TAG_BYTE, 1),
        "useMsaGamertagsOnly": (TAG_BYTE, 0),
        "worldStartCount": (TAG_LONG, 0),
    }

    # Raiz: compound com nome vazio
    payload = struct.pack("<b", TAG_COMPOUND) + _str("") + _payload(TAG_COMPOUND, root)
    header = struct.pack("<ii", 10, len(payload))
    return header + payload


def main():
    if len(sys.argv) < 2:
        print("uso: make_level_dat.py <saida/level.dat> [NomeDoMundo]", file=sys.stderr)
        sys.exit(1)
    out_path = sys.argv[1]
    level_name = sys.argv[2] if len(sys.argv) > 2 else "ARISE — Mundo"
    data = build_level_dat(level_name)
    with open(out_path, "wb") as f:
        f.write(data)
    print(f"[level.dat] {out_path} gerado ({len(data)} bytes, mundo '{level_name}')")


if __name__ == "__main__":
    main()
