// ============================================================
// ARISE — instanceAreas.js
// Tickingareas defensivas para instâncias remotas.
//
// /tickingarea exige cheats/permissão no mundo. Se o comando falhar,
// os chamadores devem abortar a instância sem recompensa.
// ============================================================

import { world } from "@minecraft/server";

const PREFIX = "arise_";
const GATE_NAMES = ["arise_gate_0"];
const PENALTY_NAMES = [
  "arise_pz_0", "arise_pz_1", "arise_pz_2", "arise_pz_3",
  "arise_pz_4", "arise_pz_5", "arise_pz_6", "arise_pz_7",
];

const active = new Set();

function overworld() { return world.getDimension("overworld"); }

function run(cmd, requireSuccess = false) {
  try {
    const result = overworld().runCommand(cmd);
    if (requireSuccess && (result?.successCount ?? 0) <= 0) {
      return { ok: false, error: `comando sem sucesso: ${cmd}` };
    }
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function claimName(names) {
  for (const name of names) {
    if (!active.has(name)) {
      active.add(name);
      return name;
    }
  }
  return null;
}

export function createTickingArea(kind, center, radiusChunks) {
  const names = kind === "gate" ? GATE_NAMES : PENALTY_NAMES;
  const name = claimName(names);
  if (!name) {
    return { ok: false, error: `limite interno de tickingareas ARISE atingido (${kind})` };
  }

  const radius = Math.max(0, Math.min(4, Math.floor(radiusChunks)));
  const x = Math.floor(center.x);
  const y = Math.floor(center.y);
  const z = Math.floor(center.z);
  const res = run(`tickingarea add circle ${x} ${y} ${z} ${radius} ${name} true`, true);
  if (!res.ok) {
    active.delete(name);
    return { ok: false, error: res.error };
  }
  return { ok: true, name };
}

export function removeTickingArea(name) {
  if (!name || !String(name).startsWith(PREFIX)) return;
  try {
    run(`tickingarea remove ${name}`);
  } finally {
    active.delete(name);
  }
}

export function cleanupAriseTickingAreas() {
  for (const name of [...GATE_NAMES, ...PENALTY_NAMES]) {
    run(`tickingarea remove ${name}`);
    active.delete(name);
  }
}
