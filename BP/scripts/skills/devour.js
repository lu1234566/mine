// ============================================================
// ARISE — devour.js
// Predação: com a skill ATIVA, matar um mob tem chance de
// absorver um fragmento de essência daquele tipo (custa mana).
// Fragmentos acumulados desbloqueiam Traços passivos.
// Persistência: arise:devour_on (bool), arise:essences (JSON),
// arise:traits_seen (JSON de traços já anunciados).
// ============================================================

import { world, EntityDamageCause } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { HOOKS, applyHooks } from "../player/hooks.js";
import { spendMana } from "../player/stats.js";
import { registerSkill } from "./skillRegistry.js";

const NS = CONFIG.NAMESPACE;
const DV = CONFIG.DEVOUR;
const MSG = CONFIG.MESSAGES.SYSTEM_PREFIX;

function dp(p, key) { return p.getDynamicProperty(`${NS}:${key}`); }
function setDp(p, key, v) { p.setDynamicProperty(`${NS}:${key}`, v); }

function readJson(p, key, fallback) {
  const raw = dp(p, key);
  if (typeof raw !== "string") return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

// ---------- essências ----------
export function getEssences(p) { return readJson(p, "essences", {}); }

export function totalEssences(p) {
  return Object.values(getEssences(p)).reduce((a, b) => a + b, 0);
}

function nomeMob(key) { return CONFIG.MOB_NAMES[key] ?? key; }

// ---------- traços ----------
function traitCount(ess, trait) {
  return trait.sources.reduce((a, s) => a + (ess[s] ?? 0), 0);
}

export function hasTrait(p, traitId) {
  const trait = CONFIG.TRAITS.find((t) => t.id === traitId);
  if (!trait) return false;
  return traitCount(getEssences(p), trait) >= trait.need;
}

function checkTraitUnlocks(player, ess) {
  const seen = readJson(player, "traits_seen", []);
  for (const t of CONFIG.TRAITS) {
    if (seen.includes(t.id)) continue;
    if (traitCount(ess, t) >= t.need) {
      seen.push(t.id);
      setDp(player, "traits_seen", JSON.stringify(seen));
      try {
        player.onScreenDisplay.setTitle("§5[ TRAÇO ADQUIRIDO ]", {
          subtitle: `§f${t.nome} §7— ${t.desc}`,
          fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 15,
        });
        player.playSound("beacon.power");
        player.sendMessage(MSG + `§5Traço adquirido: §f${t.nome}§7 — ${t.desc}.`);
      } catch (e) {
        console.error("[ARISE] Erro ao anunciar traço: " + e);
      }
    }
  }
}

// ---------- absorção no abate ----------
function tryDevour(player, deadEntity) {
  const level = dp(player, "level") ?? 1;
  if (level < DV.UNLOCK_LEVEL) return;
  if (dp(player, "devour_on") !== true) return;

  let chance = applyHooks(HOOKS.devourChanceBonus, player, DV.CHANCE);
  // Clarividência (8A): tipo analisado é mais fácil de devorar
  const rawA = dp(player, "analyzed");
  if (typeof rawA === "string") {
    try {
      const a = JSON.parse(rawA);
      if (a.typeId === deadEntity.typeId && Date.now() < a.until) {
        chance += CONFIG.SKILLS.ANALYZE_DEVOUR_BONUS;
      }
    } catch { /* marca corrompida: ignora */ }
  }
  if (Math.random() > chance) return;
  if (!spendMana(player, DV.MANA_COST)) return;

  const key = deadEntity.typeId.replace("minecraft:", "");
  const ess = getEssences(player);
  ess[key] = (ess[key] ?? 0) + 1;
  setDp(player, "essences", JSON.stringify(ess));

  try {
    player.playSound("mob.endermen.portal", { pitch: 1.6, volume: 0.5 });
    player.onScreenDisplay.setActionBar(
      `§5✦ Essência absorvida: §f${nomeMob(key)} §7(${ess[key]})`
    );
    player.dimension.spawnParticle("minecraft:villager_happy", {
      x: player.location.x, y: player.location.y + 1.5, z: player.location.z,
    });
  } catch { /* efeitos são cosméticos */ }

  checkTraitUnlocks(player, ess);
}

// ---------- efeitos passivos dos traços ----------
// Chamado pelo main.js junto com tickEffects (a cada ~100 ticks)
export function tickTraits(p) {
  const dur = CONFIG.ATTRIBUTES.EFFECT_DURATION;
  if (hasTrait(p, "pele_ignea")) {
    p.addEffect("fire_resistance", dur, { amplifier: 0, showParticles: false });
  }
  if (hasTrait(p, "sangue_frio") && p.getEffect("poison")) {
    p.removeEffect("poison");
  }
  if (hasTrait(p, "vigor_sombrio")) {
    const hc = p.getComponent("minecraft:health");
    if (hc && hc.currentValue > 0 &&
        hc.currentValue / hc.effectiveMax <= CONFIG.TRAIT_REGEN_HP_PCT) {
      p.addEffect("regeneration", 100, { amplifier: 1, showParticles: false });
    }
  }
}

// ---------- registro ----------
export function initDevour() {
  // absorção ao matar
  world.afterEvents.entityDie.subscribe((ev) => {
    try {
      const killer = ev.damageSource?.damagingEntity;
      if (!killer || killer.typeId !== "minecraft:player") return;
      const dead = ev.deadEntity;
      if (!dead || dead.typeId === "minecraft:player") return;
      tryDevour(killer, dead);
    } catch (e) {
      console.error("[ARISE] Erro em entityDie(devour): " + e);
    }
  });

  // Pele Estável: devolve metade do dano de explosão como cura
  world.afterEvents.entityHurt.subscribe((ev) => {
    try {
      const p = ev.hurtEntity;
      if (!p || p.typeId !== "minecraft:player") return;
      const causa = ev.damageSource?.cause;
      if (causa !== EntityDamageCause.blockExplosion &&
          causa !== EntityDamageCause.entityExplosion) return;
      if (!hasTrait(p, "pele_estavel")) return;
      const hc = p.getComponent("minecraft:health");
      if (!hc || hc.currentValue <= 0) return;
      const cura = ev.damage * CONFIG.TRAIT_EXPLOSION_HEAL_PCT;
      hc.setCurrentValue(Math.min(hc.effectiveMax, hc.currentValue + cura));
    } catch (e) {
      console.error("[ARISE] Erro em entityHurt(pele_estavel): " + e);
    }
  });

  // Olho Certeiro: dano extra em projéteis do jogador
  world.afterEvents.projectileHitEntity.subscribe((ev) => {
    try {
      const shooter = ev.source;
      if (!shooter || shooter.typeId !== "minecraft:player") return;
      if (!hasTrait(shooter, "olho_certeiro")) return;
      const hit = ev.getEntityHit()?.entity;
      if (!hit || hit.typeId === "minecraft:player") return;
      hit.applyDamage(CONFIG.TRAIT_PROJECTILE_BONUS, {
        cause: EntityDamageCause.projectile,
      });
    } catch (e) {
      console.error("[ARISE] Erro em projectileHitEntity(olho_certeiro): " + e);
    }
  });

  // skill no menu de Habilidades
  registerSkill({
    id: "devour",
    nome: "Devorar",
    requisito: `desbloqueia no nível ${DV.UNLOCK_LEVEL}`,
    unlocked: (p) => (dp(p, "level") ?? 1) >= DV.UNLOCK_LEVEL,
    statusText: (p) => (dp(p, "devour_on") === true ? "§8[§aATIVA§8]" : "§8[§7inativa§8]"),
    bodyText: (p) => {
      const ess = getEssences(p);
      let txt = `§5Devorar§7 — ao abater com a skill ativa, §f${Math.round(
        applyHooks(HOOKS.devourChanceBonus, p, DV.CHANCE) * 100
      )}%§7 de chance de absorver essência (§b${DV.MANA_COST} mana§7).`;
      const linhas = Object.entries(ess)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([k, v]) => `§8- §f${nomeMob(k)}§7: ${v}`);
      if (linhas.length > 0) txt += "\n§7Essências:\n" + linhas.join("\n");
      txt += "\n\n§7Traços:";
      for (const t of CONFIG.TRAITS) {
        const c = traitCount(ess, t);
        txt += c >= t.need
          ? `\n§5✔ ${t.nome}§7 — ${t.desc}`
          : `\n§8✖ ${t.nome} §7(${c}/${t.need}) — ${t.desc}`;
      }
      return txt;
    },
    onSelect: async (p) => {
      const novo = dp(p, "devour_on") !== true;
      setDp(p, "devour_on", novo);
      p.playSound(novo ? "random.orb" : "note.bass");
      p.sendMessage(MSG + (novo ? "§5Devorar §aATIVADA§7." : "§5Devorar §7desativada."));
    },
  });
}
