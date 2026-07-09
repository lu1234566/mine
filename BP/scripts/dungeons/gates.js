// ============================================================
// ARISE — gates.js
// Portais ranqueados: usar uma Chave de Portal abre uma instância
// (uma por vez) numa arena local deslocada do jogador. Ondas de
// mobs -> chefe com boss bar -> recompensas.
//
// Estado da instância fica em memória (script recarrega junto com
// o mundo em single player). Mobs da instância levam tag arise_gate
// e são limpos no fim/abandono.
// ============================================================

import { world, system, EquipmentSlot, EnchantmentTypes, ItemStack } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { addXp, giveItem } from "../player/stats.js";
import { arenaSizeFor, buildArena, clamp, clearBox, clearGateArena, dimensionHeightRange } from "./arenaBuilder.js";

const G = CONFIG.GATES;
const MSG = CONFIG.MESSAGES.SYSTEM_PREFIX;

// instância única: null ou
// { rank, playerId, returnTo, phase: "build"|"wave"|"delay"|"boss"|"reward",
//   wave, delayTicks, until, built, dim, origin, center, arena, spawnConfirmed, bossKilled }
let gate = null;

function localArenaFor(player, rank) {
  const dim = player.dimension;
  const loc = player.location;
  const size = arenaSizeFor(rank);
  const halfX = Math.floor(size.sizeX / 2);
  const halfZ = Math.floor(size.sizeZ / 2);
  const range = dimensionHeightRange(dim);
  const maxY = range.max - size.height - 2;
  const minY = Math.min(G.ARENA.LOCAL_MIN_Y, maxY);
  const origin = {
    x: Math.floor(loc.x) + G.ARENA.LOCAL_OFFSET_X - halfX,
    y: clamp(Math.floor(loc.y) + G.ARENA.LOCAL_Y_OFFSET, minY, maxY),
    z: Math.floor(loc.z) - halfZ,
  };
  const center = {
    x: origin.x + halfX + 0.5,
    y: origin.y + 1,
    z: origin.z + halfZ + 0.5,
  };
  return { dim: dim.id, origin, center };
}

function gateDimension(g = gate) {
  return world.getDimension(g?.dim ?? "minecraft:overworld");
}

function findPlayer(id) {
  return world.getAllPlayers().find((p) => p.id === id);
}

// usado pelo breaks.js para não disparar ruptura dentro de portal
export function isInGate(playerId) {
  return gate !== null && gate.playerId === playerId;
}

// ---------- abertura ----------
function consumeKey(player) {
  try {
    const eq = player.getComponent("minecraft:equippable");
    const item = eq?.getEquipment(EquipmentSlot.Mainhand);
    if (!item) return false;
    if (item.amount > 1) {
      item.amount -= 1;
      eq.setEquipment(EquipmentSlot.Mainhand, item);
    } else {
      eq.setEquipment(EquipmentSlot.Mainhand, undefined);
    }
    return true;
  } catch (e) {
    console.error("[ARISE] Erro ao consumir chave: " + e);
    return false;
  }
}

function consumeMainhandItem(player, typeId) {
  const eq = player.getComponent("minecraft:equippable");
  const item = eq?.getEquipment(EquipmentSlot.Mainhand);
  if (!item || item.typeId !== typeId) return false;
  if (item.amount > 1) {
    item.amount -= 1;
    eq.setEquipment(EquipmentSlot.Mainhand, item);
  } else {
    eq.setEquipment(EquipmentSlot.Mainhand, undefined);
  }
  return true;
}

function tryOpenGate(player, rank) {
  if (gate) {
    player.sendMessage(MSG + "§cJá existe um portal aberto. Aguarde a instância encerrar.");
    return;
  }
  if (!consumeKey(player)) return;

  // Portal Vermelho (8B): raro; a saída só libera derrotando o Guardião
  const vermelho = Math.random() < CONFIG.BREAKS.RED_CHANCE;

  const loc = player.location;
  const arena = localArenaFor(player, rank);

  gate = {
    rank,
    playerId: player.id,
    returnTo: { x: loc.x, y: loc.y, z: loc.z, dim: player.dimension.id },
    phase: "build",
    wave: 0,
    delayTicks: 0,
    until: Date.now() + G.TIMEOUT_MS,
    buildUntil: Date.now() + (G.BUILD_TIMEOUT_MS_BY_RANK?.[rank] ?? G.BUILD_TIMEOUT_MS),
    buildState: {},
    built: false,
    dim: arena.dim,
    origin: arena.origin,
    center: arena.center,
    spawnConfirmed: 0,
    spawnExpected: 0,
    bossKilled: false,
    red: vermelho,
  };

  if (vermelho) {
    player.onScreenDisplay.setTitle("§4[ PORTAL VERMELHO ]", {
      subtitle: "§cA fenda se LACRA atrás de você. Só o Guardião abre a saída.",
      fadeInDuration: 5, stayDuration: 80, fadeOutDuration: 20,
    });
    player.playSound("mob.enderdragon.growl", { volume: 0.5 });
    player.sendMessage(MSG + `§4Portal VERMELHO Rank ${rank}! §cNão há retorno sem vitória.`);
  } else {
    player.onScreenDisplay.setTitle(`§5[ PORTAL ${rank} ]`, {
      subtitle: "§fA fenda se abre...",
      fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15,
    });
    player.playSound("portal.travel", { volume: 0.6 });
    player.sendMessage(MSG + `§5Portal Rank ${rank} aberto. Sobreviva às ondas e derrote o Guardião.`);
  }

  player.sendMessage(MSG + "§7Preparando arena local...");
}

// ---------- encerramento ----------
function cleanupMobs(g = gate) {
  try {
    const c = g?.arena?.center ?? g?.center;
    if (!c) return;
    for (const e of gateDimension(g).getEntities({ tags: [G.TAG], location: c, maxDistance: 80 })) {
      e.remove();
    }
  } catch (e) {
    console.error("[ARISE] Erro em cleanupMobs(gate): " + e);
  }
}

function cleanupArena(g) {
  if (!g?.origin) return;
  try {
    if (g.arena) {
      clearGateArena(gateDimension(g), g.arena);
    } else {
      clearBox(
        gateDimension(g),
        g.origin,
        { x: g.origin.x + G.ARENA.SIZE - 1, y: g.origin.y + G.ARENA.HEIGHT - 1, z: g.origin.z + G.ARENA.SIZE - 1 }
      );
    }
  } catch (e) {
    console.error("[ARISE] Erro em cleanupArena(gate): " + e);
  }
}

function closeGate(voltarJogador, motivoMsg) {
  const g = gate;
  gate = null;
  cleanupMobs(g);
  try {
    if (!g) return;
    const player = findPlayer(g.playerId);
    if (player && motivoMsg) player.sendMessage(MSG + motivoMsg);
    if (player && voltarJogador) {
      try {
        const r = g.returnTo;
        player.teleport({ x: r.x, y: r.y, z: r.z }, { dimension: world.getDimension(r.dim) });
        player.playSound("portal.travel", { volume: 0.5 });
      } catch (e) {
        console.error("[ARISE] Erro ao devolver jogador do portal: " + e);
      }
    }
  } finally {
    cleanupArena(g);
  }
}

// ---------- ondas ----------
function spawnWave(player, mobs, mobEffects) {
  const points = gate.arena?.spawnPoints ?? [gate.center];
  const dim = gateDimension();
  let i = 0;
  let confirmed = 0;
  for (const typeId of mobs) {
    try {
      const p = points[i % points.length];
      const lane = Math.floor(i / points.length);
      const mob = dim.spawnEntity(typeId, {
        x: p.x + (lane % 2) * 0.8,
        y: p.y,
        z: p.z + (lane % 3) * 0.8,
      });
      if (!mob) throw new Error("spawnEntity retornou vazio");
      mob.addTag(G.TAG);
      confirmed++;
      // ranks altos: mobs buffados por efeitos (escala sem novas entidades)
      for (const fx of mobEffects ?? []) {
        try {
          mob.addEffect(fx.type, G.MOB_EFFECT_DURATION, {
            amplifier: fx.amplifier, showParticles: false,
          });
        } catch { /* mob sem suporte ao efeito */ }
      }
      i++;
    } catch (e) {
      console.error("[ARISE] Erro ao spawnar onda: " + e);
    }
  }
  if (confirmed > 0) player.playSound("mob.evocation_illager.prepare_summon", { volume: 0.7 });
  return confirmed;
}

function spawnBoss(player, rankCfg) {
  const c = gate.arena?.bossPoint ?? gate.center;
  try {
    const dim = gateDimension();
    const boss = dim.spawnEntity("arise:gate_guardian", { x: c.x, y: c.y, z: c.z });
    if (!boss) throw new Error("spawnEntity retornou vazio");
    boss.addTag(G.TAG);
    boss.addTag(G.BOSS_TAG);
    boss.triggerEvent(rankCfg.bossEvent);
    boss.nameTag = rankCfg.bossName;
    dim.spawnParticle("minecraft:huge_explosion_emitter", {
      x: c.x, y: c.y + 1, z: c.z,
    });
    player.onScreenDisplay.setTitle("§4[ GUARDIÃO ]", {
      subtitle: rankCfg.bossName,
      fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15,
    });
    player.playSound("mob.wither.spawn", { volume: 0.6 });
    return 1;
  } catch (e) {
    console.error("[ARISE] Erro ao spawnar chefe: " + e);
    return 0;
  }
}

function aliveGateMobs() {
  const c = gate.arena?.center ?? gate.center;
  return gateDimension().getEntities({ tags: [G.TAG], location: c, maxDistance: 60 }).length;
}

function arenaReady() {
  try {
    const arena = gate.arena;
    if (!arena) {
      const floor = gateDimension().getBlock({
        x: Math.floor(gate.center.x), y: gate.origin.y, z: Math.floor(gate.center.z),
      });
      return floor !== undefined && floor.typeId !== "minecraft:air";
    }
    const floor = gateDimension().getBlock({
      x: Math.floor(arena.center.x), y: arena.floorY, z: Math.floor(arena.center.z),
    });
    return floor !== undefined && floor.typeId !== "minecraft:air";
  } catch {
    return false;
  }
}

function buildGateInstanceArena() {
  if (G.SCRIPTED_ARENA_RANKS.includes(gate.rank)) {
    gate.arena = buildArena(gate.rank, gateDimension(), gate.origin, gate.buildState);
  } else {
    world.structureManager.place(G.STRUCTURE, gateDimension(), gate.origin);
  }
}

function rollAmount(entry) {
  const min = entry.min ?? entry.amount ?? 1;
  const max = entry.max ?? entry.amount ?? min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function applyEnchantments(item, entry) {
  const enchantable = item.getComponent("minecraft:enchantable");
  if (!enchantable || !entry.enchantments) return;

  for (const enchantment of entry.enchantments) {
    try {
      const type = EnchantmentTypes.get(enchantment.id);
      if (!type) continue;
      enchantable.addEnchantment({ type, level: enchantment.level });
    } catch (e) {
      console.error("[ARISE] Erro ao encantar recompensa do portal: " + e);
    }
  }
}

function makeLootItem(entry) {
  const item = new ItemStack(entry.item, rollAmount(entry));
  if (entry.lore) item.setLore(entry.lore);
  applyEnchantments(item, entry);
  return item;
}

function giveItemStack(player, item) {
  try {
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) {
      player.dimension.spawnItem(item, player.location);
      return;
    }
    const leftover = inv.addItem(item);
    if (leftover) player.dimension.spawnItem(leftover, player.location);
  } catch (e) {
    console.error("[ARISE] Erro ao entregar item de loot do portal: " + e);
    try { player.dimension.spawnItem(item, player.location); } catch { /* sem fallback seguro */ }
  }
}

function rollRankLoot(player, rank) {
  const table = G.LOOT?.[rank];
  if (!table?.rolls) return [];

  const drops = [];
  for (const entry of table.rolls) {
    if (Math.random() >= entry.chance) continue;
    const item = makeLootItem(entry);
    giveItemStack(player, item);
    drops.push(`${entry.label ?? entry.item}${item.amount > 1 ? ` x${item.amount}` : ""}`);
  }
  return drops;
}

// ---------- vitória ----------
function onBossKilled() {
  if (!gate || gate.phase === "reward") return;
  gate.bossKilled = true;
  gate.phase = "reward";
  const player = findPlayer(gate.playerId);
  const cfg = G.RANKS[gate.rank];
  if (player && cfg) {
    try {
      player.onScreenDisplay.setTitle("§a[ PORTAL CONQUISTADO ]", {
        subtitle: `§f+${cfg.xp} XP`,
        fadeInDuration: 5, stayDuration: 70, fadeOutDuration: 20,
      });
      player.playSound("random.levelup");
      addXp(player, cfg.xp);
      giveItem(player, CONFIG.ITEMS.ESSENCE_CRYSTAL, cfg.crystals);
      let extra = `§f+${cfg.crystals} Cristal(is) de Essência.`;
      if (cfg.upgradeKey && Math.random() < cfg.upgradeChance) {
        giveItem(player, cfg.upgradeKey, 1);
        extra += " §aUma chave de rank superior caiu!";
      }
      const drops = rollRankLoot(player, gate.rank);
      if (drops.length > 0) {
        extra += ` §dLoot: ${drops.join(", ")}.`;
      }
      player.sendMessage(MSG + `§aPortal Rank ${gate.rank} conquistado! ` + extra);
    } catch (e) {
      console.error("[ARISE] Erro nas recompensas do portal: " + e);
    }
  }
  // devolve o jogador alguns segundos depois e fecha a instância
  system.runTimeout(() => {
    try { closeGate(true, "§7A fenda se fecha atrás de você."); } catch (e) {
      console.error("[ARISE] Erro ao fechar portal: " + e);
    }
  }, 100);
}

// ---------- tick (chamado pelo main.js) ----------
export function tickGates(ciclo) {
  if (!gate) return;
  if (ciclo % G.CHECK_EVERY !== 0) return;
  try {
    const player = findPlayer(gate.playerId);
    // jogador sumiu (desconectou) -> encerra
    if (!player) { closeGate(false, null); return; }

    // tempo esgotado -> falha
    if (Date.now() >= gate.until) {
      closeGate(true, "§cO portal colapsou antes de você derrotar o Guardião.");
      return;
    }

    const c = gate.arena?.center ?? gate.center;

    if (gate.phase === "build") {
      if (Date.now() >= gate.buildUntil) {
        giveItem(player, CONFIG.ITEMS.GATE_KEYS[gate.rank], 1);
        closeGate(false,
          "§cFalha técnica ao preparar a arena do portal. A chave foi devolvida. " +
          "Tente abrir em uma área mais livre."
        );
        return;
      }
      try {
        buildGateInstanceArena();
        if (gate.arena?.buildComplete === false) return;
        if (!arenaReady()) return;
        gate.built = true;
      } catch {
        return; // chunk ainda carregando; tenta no próximo ciclo
      }
      player.addEffect("slow_falling", 600, { amplifier: 0, showParticles: false });
      player.addEffect("resistance", 300, { amplifier: 3, showParticles: false });
      player.teleport(gate.arena?.center ?? c, { dimension: gateDimension() });
      gate.phase = "delay";
      gate.delayTicks = G.WAVE_DELAY_TICKS;
      return;
    }

    if (gate.arena?.openSky && player.dimension.id === gate.dim && player.location.y < gate.arena.floorY - 3) {
      player.teleport(c, { dimension: gateDimension() });
      player.sendMessage(MSG + "§5O vazio rejeita sua fuga. Volte ao trono.");
      return;
    }

    // abandono: saiu da região da arena
    if (player.dimension.id !== gate.dim ||
        Math.abs(player.location.x - c.x) > 60 ||
        Math.abs(player.location.z - c.z) > 60) {
      if (gate.red && gate.phase !== "reward") {
        // Portal Vermelho: não há fuga — de volta para dentro
        player.teleport(c, { dimension: gateDimension() });
        player.sendMessage(MSG + "§4A fenda vermelha não permite fuga.");
      } else {
        closeGate(false, "§cVocê abandonou o portal. A instância colapsou.");
        return;
      }
    }

    if (gate.phase === "delay") {
      gate.delayTicks -= G.CHECK_EVERY * CONFIG.INTERVALS.MAIN;
      if (gate.delayTicks > 0) return;
      const cfg = G.RANKS[gate.rank];
      if (gate.wave < cfg.waves.length) {
        gate.wave++;
        player.onScreenDisplay.setTitle(`§5Onda ${gate.wave}§7/${cfg.waves.length}`, {
          fadeInDuration: 5, stayDuration: 30, fadeOutDuration: 10,
        });
        gate.spawnExpected = cfg.waves[gate.wave - 1].length;
        gate.spawnConfirmed = spawnWave(player, cfg.waves[gate.wave - 1], cfg.mobEffects);
        if (gate.spawnConfirmed <= 0) {
          closeGate(true,
            "§cFalha técnica ao invocar a onda do portal. A instância foi abortada sem recompensa."
          );
          return;
        }
        gate.phase = "wave";
      } else {
        gate.spawnExpected = 1;
        gate.spawnConfirmed = spawnBoss(player, cfg);
        gate.bossKilled = false;
        if (gate.spawnConfirmed <= 0) {
          closeGate(true,
            "§cFalha técnica ao invocar o Guardião. A instância foi abortada sem recompensa."
          );
          return;
        }
        gate.phase = "boss";
      }
      return;
    }

    if (gate.phase === "wave" || gate.phase === "boss") {
      if (aliveGateMobs() === 0) {
        if (gate.phase === "boss") {
          if (!gate.bossKilled) {
            closeGate(true,
              "§cO Guardião desapareceu antes de ser derrotado. A instância foi abortada sem recompensa."
            );
          }
        } else {
          gate.phase = "delay";
          gate.delayTicks = G.WAVE_DELAY_TICKS;
        }
      }
    }
  } catch (e) {
    console.error("[ARISE] Erro em tickGates: " + e);
  }
}

// ---------- registro ----------
export function initGates() {
  // usar chave abre o portal; usar cristal dá XP
  world.afterEvents.itemUse.subscribe((ev) => {
    try {
      const typeId = ev.itemStack?.typeId;
      if (!typeId) return;
      const rank = G.KEY_RANKS[typeId];
      if (rank) {
        tryOpenGate(ev.source, rank);
        return;
      }
      if (typeId === CONFIG.ITEMS.ESSENCE_CRYSTAL) {
        const p = ev.source;
        if (!consumeMainhandItem(p, CONFIG.ITEMS.ESSENCE_CRYSTAL)) return;
        addXp(p, CONFIG.CRYSTAL_XP);
        p.playSound("random.orb");
        p.sendMessage(MSG + `§dCristal de Essência absorvido: §f+${CONFIG.CRYSTAL_XP} XP.`);
        return;
      }
      if (typeId === CONFIG.ITEMS.SYSTEM_XP_POTION) {
        const p = ev.source;
        if (!consumeMainhandItem(p, CONFIG.ITEMS.SYSTEM_XP_POTION)) return;
        addXp(p, CONFIG.SYSTEM_XP_POTION_XP);
        p.playSound("random.orb");
        p.sendMessage(MSG + `§bPoção de XP do Sistema consumida: §f+${CONFIG.SYSTEM_XP_POTION_XP} XP ARISE.`);
      }
    } catch (e) {
      console.error("[ARISE] Erro em itemUse(gates): " + e);
    }
  });

  // morte do chefe -> vitória
  world.afterEvents.entityDie.subscribe((ev) => {
    try {
      const dead = ev.deadEntity;
      if (dead?.typeId === "arise:gate_guardian" && dead.hasTag?.(G.BOSS_TAG)) {
        onBossKilled();
      }
    } catch (e) {
      console.error("[ARISE] Erro em entityDie(gates): " + e);
    }
  });

  // morte do jogador dentro do portal -> falha
  world.afterEvents.playerSpawn.subscribe((ev) => {
    try {
      if (ev.initialSpawn) return;
      if (gate && gate.playerId === ev.player.id) {
        closeGate(false, gate.red
          ? "§4O Portal Vermelho o cuspiu. A chave foi consumida pela fenda."
          : "§cVocê caiu dentro do portal. A instância colapsou.");
      }
    } catch (e) {
      console.error("[ARISE] Erro em playerSpawn(gates): " + e);
    }
  });
}
