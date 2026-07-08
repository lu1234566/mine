// ============================================================
// ARISE — arenaBuilder.js
// Helpers compartilhados para construir/limpar arenas com
// checagem explícita de chunk carregado.
// ============================================================

import { BlockPermutation } from "@minecraft/server";
import { CONFIG } from "../config.js";

const AIR = "minecraft:air";
const BARRIER = "minecraft:barrier";

const permCache = new Map();

export function perm(typeId) {
  let cached = permCache.get(typeId);
  if (!cached) {
    cached = BlockPermutation.resolve(typeId);
    permCache.set(typeId, cached);
  }
  return cached;
}

export function setBlock(dim, pos, permutation) {
  const block = dim.getBlock(pos);
  if (!block) throw new Error("chunk descarregado");
  block.setPermutation(permutation);
}

export function fillBox(dim, from, to, permutation) {
  const minX = Math.min(from.x, to.x);
  const maxX = Math.max(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  const maxY = Math.max(from.y, to.y);
  const minZ = Math.min(from.z, to.z);
  const maxZ = Math.max(from.z, to.z);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        setBlock(dim, { x, y, z }, permutation);
      }
    }
  }
}

export function clearBox(dim, from, to) {
  const minX = Math.min(from.x, to.x);
  const maxX = Math.max(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  const maxY = Math.max(from.y, to.y);
  const minZ = Math.min(from.z, to.z);
  const maxZ = Math.max(from.z, to.z);
  const air = perm(AIR);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        const block = dim.getBlock({ x, y, z });
        if (block) block.setPermutation(air);
      }
    }
  }
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function dimensionHeightRange(dim) {
  try {
    const r = dim.heightRange;
    return { min: r.min ?? -64, max: r.max ?? 320 };
  } catch {
    return { min: -64, max: 320 };
  }
}

export function clearGateArena(dim, origin) {
  const a = CONFIG.GATES.ARENA;
  clearBox(
    dim,
    origin,
    { x: origin.x + a.SIZE - 1, y: origin.y + a.HEIGHT - 1, z: origin.z + a.SIZE - 1 }
  );
}

export function buildGateArena(dim, origin, rank) {
  const a = CONFIG.GATES.ARENA;
  const palette = a.BLOCKS_BY_RANK[rank] ?? a.BLOCKS_BY_RANK.E;
  const floor = perm(palette.floor);
  const floorTrim = perm(palette.floorTrim);
  const wall = perm(palette.wall);
  const wallAccent = perm(palette.wallAccent);
  const lamp = perm(palette.lamp);
  const roof = perm(BARRIER);
  const air = perm(AIR);

  for (let dx = 0; dx < a.SIZE; dx++) {
    for (let dz = 0; dz < a.SIZE; dz++) {
      const x = origin.x + dx;
      const z = origin.z + dz;
      const edge = dx === 0 || dz === 0 || dx === a.SIZE - 1 || dz === a.SIZE - 1;
      const corner = (dx === 0 || dx === a.SIZE - 1) && (dz === 0 || dz === a.SIZE - 1);
      const litFloor = !edge && dx % 8 === 0 && dz % 8 === 0;
      const trimmedFloor = edge || dx % 4 === 0 || dz % 4 === 0;

      setBlock(dim, { x, y: origin.y, z }, litFloor ? lamp : (trimmedFloor ? floorTrim : floor));

      for (let dy = 1; dy <= a.WALL_HEIGHT; dy++) {
        const accent = edge && !corner && palette.accentRows.includes(dy) &&
          (dx % palette.accentEvery === 0 || dz % palette.accentEvery === 0);
        setBlock(dim, { x, y: origin.y + dy, z }, edge ? (accent ? wallAccent : wall) : air);
      }

      for (let dy = a.WALL_HEIGHT + 1; dy < a.ROOF_Y; dy++) {
        setBlock(dim, { x, y: origin.y + dy, z }, air);
      }

      setBlock(dim, { x, y: origin.y + a.ROOF_Y, z }, roof);

      for (let dy = a.ROOF_Y + 1; dy < a.HEIGHT; dy++) {
        setBlock(dim, { x, y: origin.y + dy, z }, air);
      }
    }
  }
}
