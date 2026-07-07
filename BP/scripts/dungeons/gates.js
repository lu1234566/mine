// ============================================================
// ARISE — gates.js
// Portais ranqueados: usar uma Chave de Portal abre uma instância
// (uma por vez) numa arena pré-construída (.mcstructure) em região
// remota. Ondas de mobs -> chefe com boss bar -> recompensas.
//
// Estado da instância fica em memória (script recarrega junto com
// o mundo em single player). Mobs da instância levam tag arise_gate
// e são limpos no fim/abandono.
// ============================================================

import { world, system, EquipmentSlot } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { addXp, giveItem } from "../player/stats.js";

const G = CONFIG.GATES;
const MSG = CONFIG.MESSAGES.SYSTEM_PREFIX;

// instância única: null ou
// { rank, playerId, returnTo, phase: "build"|"wave"|"delay"|"boss"|"reward",
//   wave, delayTicks, until, built }
let gate = null;

function arenaCenter() {
  const half = Math.floor(G.ARENA.SIZE / 2);
  return { x: G.ARENA.X + half + 0.5, y: G.ARENA.Y + 1, z: G.ARENA.Z + half + 0.5 };
}

function overworld() { return world.getDimension("overworld"); }

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

function tryOpenGate(player, rank) {
  if (gate) {
    player.sendMessage(MSG + "§cJá existe um portal aberto. Aguarde a instância encerrar.");
    return;
  }
  if (!consumeKey(player)) return;

  // Portal Vermelho (8B): raro; a saída só libera derrotando o Guardião
  const vermelho = Math.random() < CONFIG.BREAKS.RED_CHANCE;

  const loc = player.location;
  gate = {
    rank,
    playerId: player.id,
    returnTo: { x: loc.x, y: loc.y, z: loc.z, dim: player.dimension.id },
    phase: "build",
    wave: 0,
    delayTicks: 0,
    until: Date.now() + G.TIMEOUT_MS,
    built: false,
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

  // queda lenta enquanto a arena é montada no chunk que o próprio
  // jogador carrega ao chegar
  const c = arenaCenter();
  player.addEffect("slow_falling", 600, { amplifier: 0, showParticles: false });
  player.addEffect("resistance", 300, { amplifier: 3, showParticles: false });
  player.teleport({ x: c.x, y: c.y + 35, z: c.z }, { dimension: overworld() });
}

// ---------- encerramento ----------
function cleanupMobs() {
  try {
    const c = arenaCenter();
    for (const e of overworld().getEntities({ tags: [G.TAG], location: c, maxDistance: 80 })) {
      e.remove();
    }
  } catch (e) {
    console.error("[ARISE] Erro em cleanupMobs(gate): " + e);
  }
}

function closeGate(voltarJogador, motivoMsg) {
  const g = gate;
  gate = null;
  cleanupMobs();
  if (!g) return;
  const player = findPlayer(g.playerId);
  if (!player) return;
  if (motivoMsg) player.sendMessage(MSG + motivoMsg);
  if (voltarJogador) {
    try {
      const r = g.returnTo;
      player.teleport({ x: r.x, y: r.y, z: r.z }, { dimension: world.getDimension(r.dim) });
      player.playSound("portal.travel", { volume: 0.5 });
    } catch (e) {
      console.error("[ARISE] Erro ao devolver jogador do portal: " + e);
    }
  }
}

// ---------- ondas ----------
function spawnWave(player, mobs, mobEffects) {
  const c = arenaCenter();
  const dim = overworld();
  let i = 0;
  for (const typeId of mobs) {
    try {
      const ang = (Math.PI * 2 * i) / mobs.length;
      const dist = 6 + Math.random() * 5;
      const mob = dim.spawnEntity(typeId, {
        x: c.x + Math.cos(ang) * dist, y: c.y, z: c.z + Math.sin(ang) * dist,
      });
      mob.addTag(G.TAG);
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
  player.playSound("mob.evocation_illager.prepare_summon", { volume: 0.7 });
}

function spawnBoss(player, rankCfg) {
  const c = arenaCenter();
  try {
    const boss = overworld().spawnEntity("arise:gate_guardian", { x: c.x, y: c.y, z: c.z });
    boss.addTag(G.TAG);
    boss.addTag(G.BOSS_TAG);
    boss.triggerEvent(rankCfg.bossEvent);
    boss.nameTag = rankCfg.bossName;
    overworld().spawnParticle("minecraft:huge_explosion_emitter", {
      x: c.x, y: c.y + 1, z: c.z,
    });
    player.onScreenDisplay.setTitle("§4[ GUARDIÃO ]", {
      subtitle: rankCfg.bossName,
      fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15,
    });
    player.playSound("mob.wither.spawn", { volume: 0.6 });
  } catch (e) {
    console.error("[ARISE] Erro ao spawnar chefe: " + e);
  }
}

function aliveGateMobs() {
  const c = arenaCenter();
  return overworld().getEntities({ tags: [G.TAG], location: c, maxDistance: 60 }).length;
}

// ---------- vitória ----------
function onBossKilled() {
  if (!gate || gate.phase === "reward") return;
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

    const c = arenaCenter();

    if (gate.phase === "build") {
      try {
        world.structureManager.place(G.STRUCTURE, overworld(), {
          x: G.ARENA.X, y: G.ARENA.Y, z: G.ARENA.Z,
        });
        gate.built = true;
      } catch {
        return; // chunk ainda carregando; tenta no próximo ciclo
      }
      player.teleport(c, { dimension: overworld() });
      gate.phase = "delay";
      gate.delayTicks = G.WAVE_DELAY_TICKS;
      return;
    }

    // abandono: saiu da região da arena
    if (player.dimension.id !== "minecraft:overworld" ||
        Math.abs(player.location.x - c.x) > 60 ||
        Math.abs(player.location.z - c.z) > 60) {
      if (gate.red && gate.phase !== "reward") {
        // Portal Vermelho: não há fuga — de volta para dentro
        player.teleport(c, { dimension: overworld() });
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
        spawnWave(player, cfg.waves[gate.wave - 1], cfg.mobEffects);
        gate.phase = "wave";
      } else {
        spawnBoss(player, cfg);
        gate.phase = "boss";
      }
      return;
    }

    if (gate.phase === "wave" || gate.phase === "boss") {
      if (aliveGateMobs() === 0) {
        if (gate.phase === "boss") {
          // chefe removido sem evento de morte (ex.: descarregou) — trata como vitória
          onBossKilled();
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
        const eq = p.getComponent("minecraft:equippable");
        const item = eq?.getEquipment(EquipmentSlot.Mainhand);
        if (!item || item.typeId !== CONFIG.ITEMS.ESSENCE_CRYSTAL) return;
        if (item.amount > 1) {
          item.amount -= 1;
          eq.setEquipment(EquipmentSlot.Mainhand, item);
        } else {
          eq.setEquipment(EquipmentSlot.Mainhand, undefined);
        }
        addXp(p, CONFIG.CRYSTAL_XP);
        p.playSound("random.orb");
        p.sendMessage(MSG + `§dCristal de Essência absorvido: §f+${CONFIG.CRYSTAL_XP} XP.`);
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
