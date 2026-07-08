// ============================================================
// ARISE — arenaBuilder.js
// Helpers compartilhados e construtoras das arenas de portal.
// Cada arena retorna metadados usados por gates.js.
// ============================================================

import { BlockPermutation } from "@minecraft/server";

const AIR = "minecraft:air";
const BARRIER = "minecraft:barrier";

const permCache = new Map();

function stableStateKey(states) {
  if (!states) return "";
  return JSON.stringify(Object.keys(states).sort().map((k) => [k, states[k]]));
}

export function perm(typeId, states = undefined) {
  const key = `${typeId}|${stableStateKey(states)}`;
  let cached = permCache.get(key);
  if (!cached) {
    cached = states ? BlockPermutation.resolve(typeId, states) : BlockPermutation.resolve(typeId);
    permCache.set(key, cached);
  }
  return cached;
}

const P = {
  air: () => perm(AIR),
  barrier: () => perm(BARRIER),
  cobble: () => perm("minecraft:cobblestone"),
  mossyCobble: () => perm("minecraft:mossy_cobblestone"),
  stone: () => perm("minecraft:stonebrick", { stone_brick_type: "default" }),
  mossyStone: () => perm("minecraft:stonebrick", { stone_brick_type: "mossy" }),
  crackedStone: () => perm("minecraft:stonebrick", { stone_brick_type: "cracked" }),
  chiseledStone: () => perm("minecraft:stonebrick", { stone_brick_type: "chiseled" }),
  blackstone: () => perm("minecraft:blackstone"),
  polishedBlackstone: () => perm("minecraft:polished_blackstone"),
  polishedBlackstoneBricks: () => perm("minecraft:polished_blackstone_bricks"),
  chiseledPolishedBlackstone: () => perm("minecraft:chiseled_polished_blackstone"),
  gildedBlackstone: () => perm("minecraft:gilded_blackstone"),
  polishedBasalt: () => perm("minecraft:polished_basalt"),
  magma: () => perm("minecraft:magma"),
  packedIce: () => perm("minecraft:packed_ice"),
  blueIce: () => perm("minecraft:blue_ice"),
  moss: () => perm("minecraft:moss_block"),
  cryingObsidian: () => perm("minecraft:crying_obsidian"),
  amethyst: () => perm("minecraft:amethyst_block"),
  soulLantern: () => perm("minecraft:soul_lantern"),
  lantern: () => perm("minecraft:lantern"),
  shroomlight: () => perm("minecraft:shroomlight"),
};

export const ARENA_SIZES = {
  E: { sizeX: 15, height: 6, sizeZ: 15 },
  D: { sizeX: 19, height: 7, sizeZ: 19 },
  C: { sizeX: 15, height: 9, sizeZ: 25 },
  B: { sizeX: 21, height: 8, sizeZ: 21 },
  A: { sizeX: 23, height: 9, sizeZ: 23 },
  S: { sizeX: 33, height: 12, sizeZ: 33 },
};

export function arenaSizeFor(rank) {
  return ARENA_SIZES[rank] ?? ARENA_SIZES.S;
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
  const air = P.air();

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

function hash(rank, dx, dy, dz) {
  let h = rank.charCodeAt(0) * 374761393 + dx * 668265263 + dy * 2147483647 + dz * 1274126177;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function rel(origin, dx, dy, dz) {
  return { x: origin.x + dx, y: origin.y + dy, z: origin.z + dz };
}

function bounds(origin, sizeX, height, sizeZ) {
  return {
    minX: origin.x,
    maxX: origin.x + sizeX - 1,
    minY: origin.y,
    maxY: origin.y + height - 1,
    minZ: origin.z,
    maxZ: origin.z + sizeZ - 1,
  };
}

function meta(origin, sizeX, height, sizeZ, center, spawnPoints, bossPoint) {
  return {
    center: rel(origin, center[0] + 0.5, center[1], center[2] + 0.5),
    spawnPoints: spawnPoints.map((p) => rel(origin, p[0] + 0.5, p[1], p[2] + 0.5)),
    bossPoint: rel(origin, bossPoint[0] + 0.5, bossPoint[1], bossPoint[2] + 0.5),
    floorY: origin.y,
    bounds: bounds(origin, sizeX, height, sizeZ),
  };
}

function setLocal(dim, origin, dx, dy, dz, permutation) {
  setBlock(dim, rel(origin, dx, dy, dz), permutation);
}

function isEdge(dx, dz, sizeX, sizeZ) {
  return dx === 0 || dz === 0 || dx === sizeX - 1 || dz === sizeZ - 1;
}

function buildCryptE(dim, origin) {
  const sizeX = 15, height = 6, sizeZ = 15;
  for (let dx = 0; dx < sizeX; dx++) {
    for (let dy = 0; dy < height; dy++) {
      for (let dz = 0; dz < sizeZ; dz++) {
        const edge = isEdge(dx, dz, sizeX, sizeZ);
        let block = P.air();
        if (dy === 0) {
          block = hash("E", dx, dy, dz) < 0.15 ? P.mossyCobble() : P.cobble();
          if (dx === 7 && dz === 7) block = P.chiseledStone();
        } else if (dy >= 1 && dy <= 4 && edge) {
          block = hash("E", dx, dy, dz) < 0.22 ? P.mossyCobble() : P.cobble();
          if (dy === 1 && ((dx === 1 || dx === 13) && (dz === 1 || dz === 13))) block = P.soulLantern();
        } else if (dy === 5) {
          block = P.cobble();
        }
        setLocal(dim, origin, dx, dy, dz, block);
      }
    }
  }
  return meta(origin, sizeX, height, sizeZ, [7, 1, 7], [
    [3, 1, 3], [11, 1, 3], [3, 1, 11], [11, 1, 11],
  ], [7, 1, 7]);
}

function buildCatacombD(dim, origin) {
  const sizeX = 19, height = 7, sizeZ = 19;
  const pillarStarts = [[5, 5], [13, 5], [5, 13], [13, 13]];
  const inPillar = (dx, dz) => pillarStarts.some(([px, pz]) => dx >= px && dx <= px + 1 && dz >= pz && dz <= pz + 1);

  for (let dx = 0; dx < sizeX; dx++) {
    for (let dy = 0; dy < height; dy++) {
      for (let dz = 0; dz < sizeZ; dz++) {
        const edge = isEdge(dx, dz, sizeX, sizeZ);
        let block = P.air();
        if (dy === 0) {
          const r = hash("D", dx, dy, dz);
          block = r < 0.08 ? P.moss() : (r < 0.28 ? P.cobble() : P.mossyCobble());
          if (dx === 9 && dz === 9) block = P.chiseledStone();
        } else if (dy >= 1 && dy <= 5 && edge) {
          const r = hash("D", dx, dy, dz);
          block = r < 0.10 ? P.crackedStone() : (r < 0.35 ? P.mossyStone() : P.stone());
        } else if (dy >= 1 && dy <= 5 && inPillar(dx, dz)) {
          block = dy === 5 ? P.soulLantern() : P.polishedBlackstoneBricks();
        } else if (dy === 6) {
          block = P.stone();
        }
        setLocal(dim, origin, dx, dy, dz, block);
      }
    }
  }
  for (const [dx, dz] of [[9, 1], [9, 17], [1, 9], [17, 9]]) {
    setLocal(dim, origin, dx, 3, dz, P.soulLantern());
  }
  return meta(origin, sizeX, height, sizeZ, [9, 1, 9], [
    [9, 1, 3], [9, 1, 15], [3, 1, 9], [15, 1, 9],
  ], [9, 1, 9]);
}

function buildHallC(dim, origin) {
  const sizeX = 15, height = 9, sizeZ = 25;
  for (let dx = 0; dx < sizeX; dx++) {
    for (let dy = 0; dy < height; dy++) {
      for (let dz = 0; dz < sizeZ; dz++) {
        const edge = isEdge(dx, dz, sizeX, sizeZ);
        let block = P.air();
        if (dy === 0) {
          block = dx >= 6 && dx <= 8 ? P.packedIce() : P.blackstone();
          if (dx === 7 && dz === 12) block = P.chiseledPolishedBlackstone();
        } else if (dy >= 1 && dy <= 7 && edge) {
          const iceVein = (dx % 4 === 0 || dz % 4 === 0) && hash("C", dx, dy, dz) < 0.45;
          block = iceVein ? P.blueIce() : P.blackstone();
          if (dy === 3 && dz % 6 === 0 && (dx === 0 || dx === sizeX - 1)) block = P.soulLantern();
        } else if (dy === 8) {
          block = P.blackstone();
        }
        setLocal(dim, origin, dx, dy, dz, block);
      }
    }
  }
  for (const z of [2, 22]) {
    for (let dx = 6; dx <= 8; dx++) setLocal(dim, origin, dx, 1, z, P.blueIce());
    setLocal(dim, origin, 7, 2, z, P.soulLantern());
  }
  return meta(origin, sizeX, height, sizeZ, [7, 1, 12], [
    [7, 1, 4], [7, 1, 12], [7, 1, 20], [3, 1, 8], [11, 1, 8], [3, 1, 16], [11, 1, 16],
  ], [7, 1, 12]);
}

function buildForgeB(dim, origin) {
  const sizeX = 21, height = 8, sizeZ = 21;
  const central = (dx, dz) => dx >= 8 && dx <= 12 && dz >= 8 && dz <= 12;
  const smallPlatforms = [[4, 4], [14, 4], [4, 14], [14, 14]];
  const small = (dx, dz) => smallPlatforms.some(([px, pz]) => dx >= px && dx <= px + 2 && dz >= pz && dz <= pz + 2);
  const walkway = (dx, dz) => (dx === 10 && dz >= 5 && dz <= 15) || (dz === 10 && dx >= 5 && dx <= 15);

  for (let dx = 0; dx < sizeX; dx++) {
    for (let dy = 0; dy < height; dy++) {
      for (let dz = 0; dz < sizeZ; dz++) {
        const edge = isEdge(dx, dz, sizeX, sizeZ);
        const frame = dx <= 1 || dz <= 1 || dx >= sizeX - 2 || dz >= sizeZ - 2;
        let block = P.air();
        if (dy === 0) {
          block = frame ? (hash("B", dx, dy, dz) < 0.18 ? P.shroomlight() : P.magma()) : P.polishedBlackstone();
        } else if (dy === 1 && central(dx, dz)) {
          block = P.chiseledPolishedBlackstone();
        } else if (dy === 1 && small(dx, dz)) {
          block = P.polishedBasalt();
        } else if (dy === 1 && walkway(dx, dz)) {
          block = P.polishedBlackstone();
        } else if (dy >= 1 && dy <= 6 && edge) {
          const r = hash("B", dx, dy, dz);
          block = r < 0.10 ? P.magma() : (r < 0.18 ? P.gildedBlackstone() : P.blackstone());
          if (dy === 3 && (dx % 5 === 0 || dz % 5 === 0)) block = P.lantern();
        } else if (dy === 7) {
          block = P.blackstone();
        }
        setLocal(dim, origin, dx, dy, dz, block);
      }
    }
  }
  return meta(origin, sizeX, height, sizeZ, [10, 2, 10], [
    [5, 2, 5], [15, 2, 5], [5, 2, 15], [15, 2, 15], [10, 1, 4], [10, 1, 16],
  ], [10, 2, 10]);
}

function buildSanctuaryA(dim, origin) {
  const sizeX = 23, height = 9, sizeZ = 23;
  const inCross = (dx, dz) => (dx >= 7 && dx <= 15) || (dz >= 7 && dz <= 15);
  const boundary = (dx, dz) => inCross(dx, dz) && (
    !inCross(dx - 1, dz) || !inCross(dx + 1, dz) || !inCross(dx, dz - 1) || !inCross(dx, dz + 1)
  );
  const vein = (dx, dz) => dx === 11 || dz === 11 || (Math.abs(dx - 11) + Math.abs(dz - 11) === 1);
  const altar = (dx, dz) =>
    (dx >= 10 && dx <= 12 && (dz === 1 || dz === 2 || dz === 20 || dz === 21)) ||
    (dz >= 10 && dz <= 12 && (dx === 1 || dx === 2 || dx === 20 || dx === 21));

  for (let dx = 0; dx < sizeX; dx++) {
    for (let dy = 0; dy < height; dy++) {
      for (let dz = 0; dz < sizeZ; dz++) {
        let block = P.air();
        if (inCross(dx, dz)) {
          if (dy === 0) {
            block = vein(dx, dz) ? P.cryingObsidian() : P.polishedBlackstone();
            if (dx === 11 && dz === 11) block = P.chiseledPolishedBlackstone();
          } else if (dy >= 1 && dy <= 7 && boundary(dx, dz)) {
            const r = hash("A", dx, dy, dz);
            block = r < 0.12 ? P.amethyst() : (r < 0.28 ? P.cryingObsidian() : P.blackstone());
          } else if (dy === 1 && altar(dx, dz)) {
            block = P.cryingObsidian();
          } else if (dy === 2 && ((dx === 11 && (dz === 2 || dz === 20)) || (dz === 11 && (dx === 2 || dx === 20)))) {
            block = P.soulLantern();
          } else if (dy === 8) {
            block = P.blackstone();
          }
        }
        setLocal(dim, origin, dx, dy, dz, block);
      }
    }
  }
  return meta(origin, sizeX, height, sizeZ, [11, 1, 11], [
    [11, 1, 3], [11, 1, 19], [3, 1, 11], [19, 1, 11],
  ], [11, 1, 11]);
}

export function buildArena(rank, dim, origin) {
  if (rank === "E") return buildCryptE(dim, origin);
  if (rank === "D") return buildCatacombD(dim, origin);
  if (rank === "C") return buildHallC(dim, origin);
  if (rank === "B") return buildForgeB(dim, origin);
  if (rank === "A") return buildSanctuaryA(dim, origin);
  return null;
}

export function clearGateArena(dim, arena) {
  if (!arena?.bounds) return;
  clearBox(
    dim,
    { x: arena.bounds.minX, y: arena.bounds.minY, z: arena.bounds.minZ },
    { x: arena.bounds.maxX, y: arena.bounds.maxY, z: arena.bounds.maxZ }
  );
}
