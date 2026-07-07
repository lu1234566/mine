#!/usr/bin/env bash
# ============================================================
# ARISE — package.sh
# Gera na pasta dist/:
#   1. ARISE.mcaddon        -> BP+RP juntos (import 1-toque no Android)
#   2. ARISE_BP.mcpack      -> só o Behavior Pack
#   3. ARISE_RP.mcpack      -> só o Resource Pack
#   4. ARISE_world.mcworld  -> mundo novo com os packs já ativados
#                              (level.dat gerado por make_level_dat.py)
#   5. world_behavior_packs.json / world_resource_packs.json soltos,
#      para o fluxo de injeção no Switch via JKSV (ver README)
# Requisitos: bash, zip, python3
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
STAGE="$DIST/_stage"

rm -rf "$DIST"
mkdir -p "$STAGE"

# ---------- Lê UUID e versão dos manifests ----------
read_manifest() {
  python3 - "$1" << 'PYEOF'
import json, sys
m = json.load(open(sys.argv[1]))
h = m["header"]
print(h["uuid"])
print(",".join(str(v) for v in h["version"]))
PYEOF
}

BP_INFO=($(read_manifest "$ROOT/BP/manifest.json"))
RP_INFO=($(read_manifest "$ROOT/RP/manifest.json"))
BP_UUID="${BP_INFO[0]}"; BP_VER="${BP_INFO[1]}"
RP_UUID="${RP_INFO[0]}"; RP_VER="${RP_INFO[1]}"

echo "[package] BP $BP_UUID v$BP_VER"
echo "[package] RP $RP_UUID v$RP_VER"

# ---------- 1) .mcaddon (BP + RP) ----------
mkdir -p "$STAGE/addon"
cp -r "$ROOT/BP" "$STAGE/addon/ARISE_BP"
cp -r "$ROOT/RP" "$STAGE/addon/ARISE_RP"
( cd "$STAGE/addon" && zip -qr "$DIST/ARISE.mcaddon" . -x "*.gitkeep" )
echo "[package] dist/ARISE.mcaddon criado."

# ---------- 2/3) .mcpack individuais ----------
( cd "$STAGE/addon/ARISE_BP" && zip -qr "$DIST/ARISE_BP.mcpack" . -x "*.gitkeep" )
( cd "$STAGE/addon/ARISE_RP" && zip -qr "$DIST/ARISE_RP.mcpack" . -x "*.gitkeep" )
echo "[package] dist/ARISE_BP.mcpack e dist/ARISE_RP.mcpack criados."

# ---------- JSONs de ativação dos packs no mundo ----------
to_json_ver() { echo "[${1//,/, }]"; }

cat > "$DIST/world_behavior_packs.json" << EOF
[
  { "pack_id": "$BP_UUID", "version": $(to_json_ver "$BP_VER") }
]
EOF

cat > "$DIST/world_resource_packs.json" << EOF
[
  { "pack_id": "$RP_UUID", "version": $(to_json_ver "$RP_VER") }
]
EOF
echo "[package] world_*_packs.json gerados em dist/ (para o fluxo Switch/JKSV)."

# ---------- 4) .mcworld (mundo novo com packs ativados) ----------
WORLD="$STAGE/world"
mkdir -p "$WORLD/behavior_packs/ARISE_BP" "$WORLD/resource_packs/ARISE_RP"
cp -r "$ROOT/BP/." "$WORLD/behavior_packs/ARISE_BP/"
cp -r "$ROOT/RP/." "$WORLD/resource_packs/ARISE_RP/"
cp "$DIST/world_behavior_packs.json" "$DIST/world_resource_packs.json" "$WORLD/"

# level.dat: obrigatório para o import; o jogo gera o terreno na
# primeira abertura (seed aleatória, overworld infinito)
python3 "$ROOT/tools/make_level_dat.py" "$WORLD/level.dat" "ARISE — Mundo"
printf 'ARISE — Mundo' > "$WORLD/levelname.txt"

( cd "$WORLD" && zip -qr "$DIST/ARISE_world.mcworld" . -x "*.gitkeep" )
echo "[package] dist/ARISE_world.mcworld criado."

rm -rf "$STAGE"
echo "[package] Concluído. Artefatos em dist/."
