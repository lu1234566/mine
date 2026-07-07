// ============================================================
// ARISE — breaks.js (Fase 8B)
// Rupturas: Chaves de Portal envelhecem. Chave não usada por
// CONFIG.BREAKS.DIAS dias reais rompe — some do inventário e as
// ondas do rank dela irrompem ao redor do jogador.
//
// Rastreio de idade (itens não carregam dado por-item na API
// estável): DP arise:key_ages = JSON { "E": [ts, ...], ... },
// reconciliado com a contagem real do inventário a cada ~60 s:
//   inventário > registro -> chaves novas ganham timestamp agora
//   inventário < registro -> remove os timestamps MAIS ANTIGOS
//   (assumimos que a chave usada/perdida foi a mais velha — usar
//   qualquer chave alivia a pressão mais urgente)
// Estado de ruptura ativa: DP arise:break = JSON {rank, until}.
// ============================================================

import { world } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { addXp, giveItem } from "../player/stats.js";
import { isInGate } from "./gates.js";

const NS = CONFIG.NAMESPACE;
const B = CONFIG.BREAKS;
const G = CONFIG.GATES;
const MSG = CONFIG.MESSAGES.SYSTEM_PREFIX;

function dp(p, key) { return p.getDynamicProperty(`${NS}:${key}`); }
function setDp(p, key, v) { p.setDynamicProperty(`${NS}:${key}`, v); }

function readJson(p, key, fallback) {
  const raw = dp(p, key);
  if (typeof raw !== "string") return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

// rank -> typeId da chave (invertido de KEY_RANKS)
const KEY_BY_RANK = {};
for (const [typeId, rank] of Object.entries(G.KEY_RANKS)) KEY_BY_RANK[rank] = typeId;

// ---------- inventário ----------
function countKeys(player) {
  const contagem = {};
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return contagem;
  for (let i = 0; i < inv.size; i++) {
    const item = inv.getItem(i);
    const rank = item ? G.KEY_RANKS[item.typeId] : undefined;
    if (rank) contagem[rank] = (contagem[rank] ?? 0) + item.amount;
  }
  return contagem;
}

function removeOneKey(player, rank) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return false;
  const typeId = KEY_BY_RANK[rank];
  for (let i = 0; i < inv.size; i++) {
    const item = inv.getItem(i);
    if (item?.typeId === typeId) {
      if (item.amount > 1) {
        item.amount -= 1;
        inv.setItem(i, item);
      } else {
        inv.setItem(i, undefined);
      }
      return true;
    }
  }
  return false;
}

// ---------- reconciliação + gatilho ----------
function maxAgeMs() {
  return B.DEBUG_FORCE_MS > 0 ? B.DEBUG_FORCE_MS : B.DIAS * 86400000;
}

function reconcile(player) {
  const ages = readJson(player, "key_ages", {});
  const contagem = countKeys(player);
  const agora = Date.now();
  const ranks = new Set([...Object.keys(ages), ...Object.keys(contagem)]);
  for (const rank of ranks) {
    let lista = ages[rank] ?? [];
    const real = contagem[rank] ?? 0;
    while (lista.length < real) lista.push(agora);   // chaves novas
    while (lista.length > real) lista.shift();       // usadas: sai a mais velha
    lista.sort((a, b) => a - b);
    if (lista.length > 0) ages[rank] = lista; else delete ages[rank];
  }
  setDp(player, "key_ages", JSON.stringify(ages));

  // alguma chave passou do prazo?
  const limite = agora - maxAgeMs();
  for (const [rank, lista] of Object.entries(ages)) {
    if (lista[0] <= limite) {
      lista.shift();
      if (lista.length > 0) ages[rank] = lista; else delete ages[rank];
      setDp(player, "key_ages", JSON.stringify(ages));
      triggerBreak(player, rank);
      return; // uma ruptura por vez
    }
  }
}

// ---------- ruptura ----------
function triggerBreak(player, rank) {
  try {
    removeOneKey(player, rank);
    setDp(player, "break", JSON.stringify({ rank, until: Date.now() + B.DURATION_MS }));

    player.onScreenDisplay.setTitle("§4[ RUPTURA ]", {
      subtitle: `§cA Chave Rank ${rank} rompeu. A fenda se abre AQUI.`,
      fadeInDuration: 5, stayDuration: 80, fadeOutDuration: 20,
    });
    player.playSound("mob.wither.spawn", { volume: 0.8 });
    player.sendMessage(
      MSG + `§4Uma Chave de Portal Rank ${rank} apodreceu no seu bolso. ` +
      "§cO que estava do outro lado veio até você."
    );

    // ondas do rank ao redor do jogador (reuso da config dos gates)
    const cfg = G.RANKS[rank];
    const dim = player.dimension;
    const l = player.location;
    let i = 0;
    for (const typeId of cfg.waves[0]) {
      try {
        const ang = (Math.PI * 2 * i) / cfg.waves[0].length;
        const dist = 4 + Math.random() * 4;
        const mob = dim.spawnEntity(typeId, {
          x: l.x + Math.cos(ang) * dist, y: l.y, z: l.z + Math.sin(ang) * dist,
        });
        mob.addTag(B.TAG);
        for (const fx of cfg.mobEffects ?? []) {
          try {
            mob.addEffect(fx.type, G.MOB_EFFECT_DURATION, {
              amplifier: fx.amplifier, showParticles: false,
            });
          } catch { }
        }
        i++;
      } catch (e) {
        console.error("[ARISE] Erro ao spawnar ruptura: " + e);
      }
    }
  } catch (e) {
    console.error("[ARISE] Erro em triggerBreak: " + e);
  }
}

function countBreakMobs(player) {
  return player.dimension.getEntities({
    tags: [B.TAG], location: player.location, maxDistance: 48,
  }).length;
}

function cleanupBreakMobs(player) {
  try {
    for (const e of player.dimension.getEntities({
      tags: [B.TAG], location: player.location, maxDistance: 80,
    })) e.remove();
  } catch (e) {
    console.error("[ARISE] Erro em cleanupBreakMobs: " + e);
  }
}

function endBreak(player, sobreviveu) {
  const estado = readJson(player, "break", null);
  setDp(player, "break", undefined);
  cleanupBreakMobs(player);
  if (!estado) return;
  if (sobreviveu) {
    const cfg = G.RANKS[estado.rank];
    const xp = Math.floor((cfg?.xp ?? 100) * B.REWARD_XP_PCT);
    addXp(player, xp);
    giveItem(player, CONFIG.ITEMS.ESSENCE_CRYSTAL, B.REWARD_CRYSTALS);
    player.playSound("random.levelup");
    player.sendMessage(
      MSG + `§aRuptura contida. §f+${xp} XP, +${B.REWARD_CRYSTALS} cristal(is). ` +
      "§7(Um portal teria rendido bem mais — use as chaves.)"
    );
  } else {
    player.sendMessage(MSG + "§7A fenda se fechou sozinha. Nada restou dela.");
  }
}

// ---------- tick (chamado pelo main.js) ----------
// Retorna true quando a ruptura está ativa (HUD própria)
export function tickBreaks(player, ciclo) {
  const estado = readJson(player, "break", null);
  if (estado) {
    if (ciclo % 2 !== 0) return true; // checa a cada 20 ticks
    const restam = Math.ceil((estado.until - Date.now()) / 1000);
    const vivos = countBreakMobs(player);
    if (restam <= 0 || vivos === 0) {
      endBreak(player, true);
      return false;
    }
    player.onScreenDisplay.setActionBar(
      `§4⚠ RUPTURA [${estado.rank}] §8| §fSobreviva §c${Math.floor(restam / 60)}m${restam % 60}s` +
      ` §8| §c${vivos}§7 inimigo(s)`
    );
    return true;
  }

  // sem ruptura ativa: reconcilia idades de vez em quando, fora de
  // penalidade/portal (para não empilhar ameaças)
  if (ciclo % B.CHECK_EVERY === 0 &&
      dp(player, "pz_active") !== true && !isInGate(player.id)) {
    reconcile(player);
  }
  return false;
}

// ---------- registro ----------
export function initBreaks() {
  // morrer durante a ruptura: sem recompensa, fenda se fecha
  world.afterEvents.playerSpawn.subscribe((ev) => {
    try {
      if (ev.initialSpawn) return;
      const p = ev.player;
      if (readJson(p, "break", null)) endBreak(p, false);
    } catch (e) {
      console.error("[ARISE] Erro em playerSpawn(ruptura): " + e);
    }
  });
}
