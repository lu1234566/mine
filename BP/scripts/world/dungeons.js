// ============================================================
// ARISE — dungeons.js
// Dungeons de exploração: geração determinística por região,
// marco visível, entrada física e baú final finito.
// ============================================================

import { world, system, ItemStack } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { perm, setBlock, fillBox, clearBox, dimensionHeightRange } from "../dungeons/arenaBuilder.js";

const NS = CONFIG.NAMESPACE;
const D = CONFIG.DUNGEONS;
const DP_DUNGEONS = `${NS}:${D.DP_KEY}`;
const OVERWORLD = "minecraft:overworld";
const DEBUG_DUNGEON_EVENT = `${NS}:debug_dungeon`;

const sessionFailed = [];

const P = {
  air: () => perm("minecraft:air"),
  chest: () => perm("minecraft:chest"),
  blackstone: () => perm("minecraft:blackstone"),
  polishedBlackstone: () => perm("minecraft:polished_blackstone"),
  polishedBlackstoneBricks: () => perm("minecraft:polished_blackstone_bricks"),
  chiseledBlackstone: () => perm("minecraft:chiseled_polished_blackstone"),
  cryingObsidian: () => perm("minecraft:crying_obsidian"),
  soulLantern: () => perm("minecraft:soul_lantern"),
  deepslate: () => perm("minecraft:deepslate"),
  deepslateBricks: () => perm("minecraft:deepslate_bricks"),
  crackedDeepslate: () => perm("minecraft:cracked_deepslate_bricks"),
  cobbledDeepslate: () => perm("minecraft:cobbled_deepslate"),
  soulTorch: () => perm("minecraft:soul_torch"),
};

const BAD_SURFACE = new Set([
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:lava",
  "minecraft:flowing_lava",
  "minecraft:ice",
  "minecraft:packed_ice",
  "minecraft:blue_ice",
  "minecraft:powder_snow",
  "minecraft:cactus",
]);

const PLAYER_BLOCK_HINTS = [
  "planks", "glass", "chest", "barrel", "torch", "lantern", "crafting_table",
  "furnace", "bed", "door", "trapdoor", "fence", "wall_sign", "standing_sign",
  "rail", "redstone", "anvil", "enchanting_table", "bookshelf", "ladder",
];

function hashInt(...values) {
  let h = 2166136261;
  for (const value of values) {
    const s = String(value);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

function hash01(...values) {
  return hashInt(...values) / 4294967296;
}

function loadDungeons() {
  const raw = world.getDynamicProperty(DP_DUNGEONS);
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error("[ARISE] Erro ao ler dungeons persistidas: " + e);
    return [];
  }
}

function saveDungeons(list) {
  try {
    const compact = list.slice(-D.MAX_STORED);
    world.setDynamicProperty(DP_DUNGEONS, JSON.stringify(compact));
  } catch (e) {
    console.error("[ARISE] Erro ao salvar dungeons persistidas: " + e);
  }
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

function regionFor(loc) {
  return {
    x: Math.floor(loc.x / D.REGION_SIZE),
    z: Math.floor(loc.z / D.REGION_SIZE),
  };
}

function regionId(r) {
  return `${r.x},${r.z}`;
}

function sessionFailedHas(id) {
  return sessionFailed.includes(id);
}

function rememberSessionFailed(id) {
  if (sessionFailedHas(id)) return;
  sessionFailed.push(id);
  while (sessionFailed.length > D.SESSION_FAILED_LIMIT) sessionFailed.shift();
}

function regionQualifies(r) {
  return hash01("arise_dungeon_region", r.x, r.z) < D.REGION_CHANCE;
}

function candidateNear(player, r, attempt) {
  const angle = (hash01("arise_dungeon_angle", r.x, r.z) +
    attempt * 0.38196601125) * Math.PI * 2;
  const dx = Math.cos(angle);
  let dz = Math.sin(angle);
  // O layout se estende para +Z; manter o marco ao norte/lateral evita empurrar a sala para chunk de borda.
  if (dz > 0.25) dz *= -1;
  const jitterSpan = D.SPAWN_DISTANCE_JITTER * 2 + 1;
  const jitter = Math.floor(hash01("arise_dungeon_radius", r.x, r.z, attempt) * jitterSpan) -
    D.SPAWN_DISTANCE_JITTER;
  const radius = Math.max(24, D.SPAWN_DISTANCE + jitter);
  return {
    x: Math.floor(player.location.x + dx * radius),
    z: Math.floor(player.location.z + dz * radius),
  };
}

function isAirLike(typeId) {
  return typeId === "minecraft:air" ||
    typeId === "minecraft:short_grass" ||
    typeId === "minecraft:tall_grass" ||
      typeId === "minecraft:fern" ||
      typeId === "minecraft:large_fern" ||
      typeId === "minecraft:tallgrass" ||
      typeId === "minecraft:double_plant" ||
      typeId.includes("snow_layer") ||
      typeId.includes("flower");
}

function isSolidSurface(block) {
  if (!block) return false;
  const typeId = block.typeId;
  if (BAD_SURFACE.has(typeId)) return false;
  if (isAirLike(typeId)) return false;
  if (typeId.includes("leaves") || typeId.includes("log")) return false;
  return true;
}

function findSurface(dim, x, z, playerY) {
  const range = dimensionHeightRange(dim);
  const top = Math.min(range.max - 2, Math.floor(playerY) + D.SURFACE_SCAN_UP);
  const bottom = Math.max(range.min + 8, Math.floor(playerY) - D.SURFACE_SCAN_DOWN);

  for (let y = top; y >= bottom; y--) {
    const below = dim.getBlock({ x, y, z });
    const air1 = dim.getBlock({ x, y: y + 1, z });
    const air2 = dim.getBlock({ x, y: y + 2, z });
    if (!below || !air1 || !air2) throw new Error("chunk descarregado");
    if (!isSolidSurface(below)) continue;
    if (!isAirLike(air1.typeId) || !isAirLike(air2.typeId)) continue;
    return { x, y: y + 1, z };
  }
  return undefined;
}

function hasPlayerConstruction(dim, surface) {
  for (let dx = -8; dx <= 8; dx += 4) {
    for (let dz = -8; dz <= 8; dz += 4) {
      for (let dy = -1; dy <= 4; dy++) {
        const block = dim.getBlock({ x: surface.x + dx, y: surface.y + dy, z: surface.z + dz });
        if (!block) throw new Error("chunk descarregado");
        const typeId = block.typeId;
        if (PLAYER_BLOCK_HINTS.some((hint) => typeId.includes(hint))) return true;
      }
    }
  }
  return false;
}

function farFromExisting(surface, list) {
  const min2 = D.MIN_DISTANCE * D.MIN_DISTANCE;
  return !list.some((d) => dist2(surface, d) < min2);
}

function rel(base, dx, dy, dz) {
  return { x: base.x + dx, y: base.y + dy, z: base.z + dz };
}

function dungeonLayout(surface) {
  const room = { x: surface.x - 6, y: surface.y - 9, z: surface.z + 13 };
  const chest = { x: surface.x, y: room.y + 1, z: room.z + 11 };
  const guardPoints = [
    rel(room, 3.5, 1, 3.5),
    rel(room, 9.5, 1, 3.5),
    rel(room, 3.5, 1, 8.5),
    rel(room, 9.5, 1, 8.5),
    rel(room, 6.5, 1, 6.5),
  ];
  return { room, chest, guardPoints };
}

function dungeonBounds(surface) {
  return {
    from: { x: surface.x - 6, y: surface.y - 10, z: surface.z - 3 },
    to: { x: surface.x + 6, y: surface.y + 9, z: surface.z + 25 },
  };
}

function assertLoadedBlock(dim, pos) {
  const block = dim.getBlock({
    x: Math.floor(pos.x),
    y: Math.floor(pos.y),
    z: Math.floor(pos.z),
  });
  if (!block) throw new Error("chunk descarregado");
  return block;
}

function assertLoadedBox(dim, from, to) {
  const minX = Math.min(from.x, to.x);
  const maxX = Math.max(from.x, to.x);
  const minY = Math.min(from.y, to.y);
  const maxY = Math.max(from.y, to.y);
  const minZ = Math.min(from.z, to.z);
  const maxZ = Math.max(from.z, to.z);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        assertLoadedBlock(dim, { x, y, z });
      }
    }
  }
}

function preflightDungeonVolume(dim, surface) {
  const { room, chest, guardPoints } = dungeonLayout(surface);

  // Valida todos os volumes usados antes de escrever qualquer bloco.
  assertLoadedBox(dim, rel(surface, -3, -1, -3), rel(surface, 3, 9, 3)); // marco
  assertLoadedBox(dim, { x: surface.x - 2, y: surface.y - 8, z: surface.z + 3 },
    { x: surface.x + 2, y: surface.y + 3, z: surface.z + 13 }); // entrada/tunel
  assertLoadedBox(dim, room, rel(room, 12, 6, 12)); // sala
  assertLoadedBlock(dim, chest);
  for (const point of guardPoints) assertLoadedBlock(dim, point);
}

function cleanupPartialDungeon(dim, surface) {
  try {
    const b = dungeonBounds(surface);
    clearBox(dim, b.from, b.to);
    const center = { x: surface.x, y: surface.y - 8, z: surface.z + 19 };
    for (const e of dim.getEntities({ tags: [D.TAG], location: center, maxDistance: 32 })) {
      e.remove();
    }
  } catch (e) {
    console.error("[ARISE] Erro ao limpar dungeon parcial: " + e);
  }
}

function buildMarker(dim, surface) {
  // Plataforma e obelisco: visível de longe e aponta para a entrada.
  fillBox(dim, rel(surface, -3, -1, -3), rel(surface, 3, -1, 3), P.polishedBlackstone());
  fillBox(dim, rel(surface, -1, 0, -1), rel(surface, 1, 0, 1), P.chiseledBlackstone());
  for (let y = 1; y <= 8; y++) {
    setBlock(dim, rel(surface, 0, y, 0), y % 3 === 0 ? P.cryingObsidian() : P.blackstone());
  }
  setBlock(dim, rel(surface, 0, 9, 0), P.soulLantern());
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    setBlock(dim, rel(surface, dx, 0, dz), P.cryingObsidian());
    setBlock(dim, rel(surface, dx, 1, dz), P.soulTorch());
  }
}

function buildEntranceAndRoom(dim, surface) {
  const { room, chest } = dungeonLayout(surface);

  // Entrada aberta no lado sul do marco, com degraus claros ate a sala.
  for (let i = 0; i <= 10; i++) {
    const y = surface.y - Math.floor(i * 0.75);
    const z = surface.z + 3 + i;
    fillBox(dim, { x: surface.x - 1, y, z }, { x: surface.x + 1, y: y + 3, z }, P.air());
    fillBox(dim, { x: surface.x - 1, y: y - 1, z }, { x: surface.x + 1, y: y - 1, z }, P.deepslateBricks());
    setBlock(dim, { x: surface.x - 2, y, z }, P.cobbledDeepslate());
    setBlock(dim, { x: surface.x + 2, y, z }, P.cobbledDeepslate());
  }

  // Sala final simples: casca sólida, interior vazio, luzes e baú.
  fillBox(dim, room, rel(room, 12, 6, 12), P.deepslateBricks());
  fillBox(dim, rel(room, 1, 1, 1), rel(room, 11, 5, 11), P.air());
  fillBox(dim, rel(room, 5, 1, 0), rel(room, 7, 3, 1), P.air());
  fillBox(dim, rel(room, 2, 0, 2), rel(room, 10, 0, 10), P.crackedDeepslate());
  for (const [dx, dz] of [[1, 1], [11, 1], [1, 11], [11, 11]]) {
    setBlock(dim, rel(room, dx, 1, dz), P.cryingObsidian());
    setBlock(dim, rel(room, dx, 2, dz), P.soulLantern());
  }
  setBlock(dim, chest, P.chest());
  return { room, chest };
}

function addToContainer(container, item) {
  try {
    if (!container) return false;
    container.addItem(item);
    return true;
  } catch (e) {
    console.error("[ARISE] Erro ao inserir loot no baú: " + e);
    return false;
  }
}

function fallbackLoot() {
  const loot = [];
  const push = (id, amount = 1) => loot.push(new ItemStack(id, amount));

  push(CONFIG.ITEMS.ESSENCE_CRYSTAL, 2 + Math.floor(Math.random() * 4));
  if (Math.random() < 0.45) push(CONFIG.ITEMS.GATE_KEYS.E);
  if (Math.random() < 0.25) push(CONFIG.ITEMS.GATE_KEYS.D);
  if (Math.random() < 0.10) push(CONFIG.ITEMS.GATE_KEYS.C);
  if (Math.random() < 0.18) push(CONFIG.ITEMS.BLADES.SHADOW);
  if (Math.random() < 0.04) {
    const variants = [
      CONFIG.ITEMS.BLADES.SERPENT,
      CONFIG.ITEMS.BLADES.MONARCH,
      CONFIG.ITEMS.BLADES.HEADSMAN,
      CONFIG.ITEMS.BLADES.VOID,
    ];
    push(variants[Math.floor(Math.random() * variants.length)]);
  }
  const armorRoll = Math.random();
  if (armorRoll < 0.22) push("minecraft:iron_chestplate");
  else if (armorRoll < 0.30) push("minecraft:iron_leggings");
  else if (armorRoll < 0.34) push("minecraft:diamond_boots");
  if (Math.random() < 0.35) push("minecraft:bread", 3 + Math.floor(Math.random() * 4));
  if (Math.random() < 0.20) push("minecraft:golden_apple");
  return loot;
}

function fillChest(dim, chestPos) {
  const block = dim.getBlock(chestPos);
  const container = block?.getComponent("minecraft:inventory")?.container;
  if (!container) return false;

  let loot;
  try {
    const manager = world.getLootTableManager?.();
    const table = manager?.getLootTable?.(D.LOOT_TABLE);
    loot = table ? manager.generateLootFromTable(table) : undefined;
  } catch (e) {
    console.error("[ARISE] Erro ao gerar loot table de dungeon; usando fallback: " + e);
  }
  if (!loot || loot.length === 0) loot = fallbackLoot();
  for (const item of loot) addToContainer(container, item);
  return true;
}

function fillChestSoon(dim, chestPos) {
  if (fillChest(dim, chestPos)) return;
  system.runTimeout(() => {
    try {
      fillChest(dim, chestPos);
    } catch (e) {
      console.error("[ARISE] Erro ao preencher baú de dungeon com atraso: " + e);
    }
  }, 2);
}

function spawnGuards(dim, guardPoints) {
  for (let i = 0; i < guardPoints.length; i++) {
    const typeId = D.MOBS[i % D.MOBS.length];
    const mob = dim.spawnEntity(typeId, guardPoints[i]);
    if (!mob) throw new Error("spawnEntity retornou vazio");
    mob.addTag(D.TAG);
  }
}

function buildDungeon(dim, surface, r) {
  preflightDungeonVolume(dim, surface);
  const layout = dungeonLayout(surface);
  let chest;
  try {
    buildMarker(dim, surface);
    ({ chest } = buildEntranceAndRoom(dim, surface));

    const chestBlock = dim.getBlock(chest);
    if (chestBlock?.typeId !== "minecraft:chest") {
      throw new Error("bau de dungeon nao confirmado");
    }

    fillChestSoon(dim, chest);
    spawnGuards(dim, layout.guardPoints);
  } catch (e) {
    cleanupPartialDungeon(dim, surface);
    throw e;
  }

  return {
    id: `${r.x},${r.z}:${surface.x},${surface.z}`,
    regionX: r.x,
    regionZ: r.z,
    x: surface.x,
    y: surface.y,
    z: surface.z,
    chest,
    looted: false,
    createdAt: Date.now(),
  };
}

function tryGenerateNear(player) {
  if (player.dimension.id !== OVERWORLD) return;
  const r = regionFor(player.location);
  const id = regionId(r);
  if (sessionFailedHas(id)) return;
  if (!regionQualifies(r)) return;

  const list = loadDungeons();
  if (list.some((d) => d.regionX === r.x && d.regionZ === r.z)) return;
  if (list.length >= D.MAX_STORED) return;

  const dim = player.dimension;
  let lastError = "sem ponto valido";
  for (let attempt = 0; attempt < D.SPAWN_ATTEMPTS; attempt++) {
    try {
      const c = candidateNear(player, r, attempt);
      const surface = findSurface(dim, c.x, c.z, player.location.y);
      if (!surface) {
        lastError = "superficie nao encontrada";
        continue;
      }
      if (!farFromExisting(surface, list)) return;
      if (hasPlayerConstruction(dim, surface)) {
        lastError = "construcao do jogador perto demais";
        continue;
      }

      const meta = buildDungeon(dim, surface, r);
      list.push(meta);
      saveDungeons(list);
      player.sendMessage(CONFIG.MESSAGES.SYSTEM_PREFIX + "§8Uma presença sombria foi sentida por perto...");
      return;
    } catch (e) {
      lastError = String(e);
      console.error("[ARISE] Candidato de dungeon de exploração recusado: " + e);
    }
  }

  rememberSessionFailed(id);
  console.error("[ARISE] Regiao de dungeon sem candidato valido: " + id + " (" + lastError + ")");
}

function debugDungeonCandidates(player) {
  const x = Math.floor(player.location.x);
  const z = Math.floor(player.location.z);
  return [
    { x, z: z - 18 },
    { x: x + 18, z: z - 18 },
    { x: x - 18, z: z - 18 },
    { x: x + 18, z },
    { x: x - 18, z },
    { x, z: z + 18 },
  ];
}

function forceDebugDungeon(player) {
  if (!player || player.dimension.id !== OVERWORLD) return;
  const dim = player.dimension;
  const list = loadDungeons();
  if (list.length >= D.MAX_STORED) {
    player.sendMessage(CONFIG.MESSAGES.SYSTEM_PREFIX + "§cLimite de dungeons persistidas atingido.");
    return;
  }

  let lastError = "sem ponto valido";
  for (const c of debugDungeonCandidates(player)) {
    try {
      const surface = findSurface(dim, c.x, c.z, player.location.y);
      if (!surface) {
        lastError = "superficie nao encontrada";
        continue;
      }
      if (hasPlayerConstruction(dim, surface)) {
        lastError = "construcao do jogador perto demais";
        continue;
      }

      const r = regionFor(surface);
      const meta = buildDungeon(dim, surface, r);
      meta.debug = true;
      meta.id = `debug:${Date.now()}:${surface.x},${surface.z}`;
      list.push(meta);
      saveDungeons(list);
      player.sendMessage(CONFIG.MESSAGES.SYSTEM_PREFIX +
        `§aDungeon debug gerada em ${surface.x}, ${surface.y}, ${surface.z}.`);
      return;
    } catch (e) {
      lastError = String(e);
      console.error("[ARISE] Falha em debug_dungeon: " + e);
    }
  }

  player.sendMessage(CONFIG.MESSAGES.SYSTEM_PREFIX +
    "§cNao foi possivel gerar dungeon debug sem risco de chunk descarregado. " +
    `Tente em area aberta. (${lastError})`);
}

function samePos(a, b) {
  return a && b && a.x === b.x && a.y === b.y && a.z === b.z;
}

function markLooted(chestPos) {
  const list = loadDungeons();
  const dungeon = list.find((d) => samePos(d.chest, chestPos));
  if (!dungeon || dungeon.looted) return;
  dungeon.looted = true;
  dungeon.lootedAt = Date.now();
  saveDungeons(list);
}

export function initDungeons() {
  const ev = world.afterEvents.playerInteractWithBlock;
  if (ev?.subscribe) ev.subscribe((event) => {
    try {
      const block = event.block;
      if (block?.typeId !== "minecraft:chest") return;
      markLooted(block.location);
    } catch (e) {
      console.error("[ARISE] Erro em playerInteractWithBlock(dungeons): " + e);
    }
  });

  const scriptEvent = system.afterEvents?.scriptEventReceive;
  if (scriptEvent?.subscribe) scriptEvent.subscribe((event) => {
    try {
      if (event.id !== DEBUG_DUNGEON_EVENT) return;
      forceDebugDungeon(event.sourceEntity);
    } catch (e) {
      console.error("[ARISE] Erro em debug_dungeon: " + e);
    }
  });
}

export function tickDungeons(ciclo) {
  try {
    if (ciclo % D.CHECK_EVERY !== 0) return;
    for (const player of world.getAllPlayers()) {
      try {
        tryGenerateNear(player);
      } catch (e) {
        console.error("[ARISE] Erro em tick de dungeon por jogador: " + e);
      }
    }
  } catch (e) {
    console.error("[ARISE] Erro em tickDungeons: " + e);
  }
}
