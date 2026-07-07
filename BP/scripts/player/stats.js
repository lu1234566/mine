// ============================================================
// ARISE — stats.js
// XP, nível, atributos, mana, HUD e persistência (dynamic
// properties do jogador). Efeitos de atributo são reaplicados
// em loop lento (nunca por tick) — console é o alvo.
// ============================================================

import { world, ItemStack } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { CONFIG } from "../config.js";
import { HOOKS, applyHooks } from "./hooks.js";
import { registerMenuSection, registerSummaryProvider } from "../ui/menus.js";

const NS = CONFIG.NAMESPACE;
const A = CONFIG.ATTRIBUTES;

// ---------- Helpers de dynamic property ----------
function num(p, key, def) {
  const v = p.getDynamicProperty(`${NS}:${key}`);
  return typeof v === "number" ? v : def;
}
function setNum(p, key, v) {
  p.setDynamicProperty(`${NS}:${key}`, v);
}

// ---------- Leitura consolidada dos stats ----------
export function getStats(p) {
  return {
    level: num(p, "level", 1),
    xp: num(p, "xp", 0),
    points: num(p, "points", 0),
    str: num(p, "attr_str", 0),
    vit: num(p, "attr_vit", 0),
    agi: num(p, "attr_agi", 0),
    per: num(p, "attr_per", 0),
    man: num(p, "attr_man", 0),
    mana: num(p, "mana", CONFIG.MANA.BASE),
  };
}

export function xpForNext(level) {
  return Math.floor(CONFIG.XP.BASE * Math.pow(level, CONFIG.XP.EXPONENT));
}

export function maxMana(p, s = getStats(p)) {
  const base = CONFIG.MANA.BASE + s.man * CONFIG.MANA.PER_POINT;
  return Math.floor(applyHooks(HOOKS.manaMaxMult, p, base));
}

// Consome mana se houver o suficiente; retorna true em sucesso.
// (usado pelas skills das fases 4+)
export function spendMana(p, cost) {
  const s = getStats(p);
  if (s.mana < cost) return false;
  setNum(p, "mana", s.mana - cost);
  return true;
}

// ---------- XP e nível ----------
export function addXp(player, base) {
  const s = getStats(player);
  if (s.level >= CONFIG.XP.MAX_LEVEL) return;

  // Percepção e modificadores externos (evolução etc.) aumentam o ganho
  let amount = base * (1 + s.per * A.PER_XP_BONUS);
  amount = applyHooks(HOOKS.xpMult, player, amount);

  let xp = s.xp + amount;
  let level = s.level;
  let points = s.points;
  let ups = 0;
  while (level < CONFIG.XP.MAX_LEVEL && xp >= xpForNext(level)) {
    xp -= xpForNext(level);
    level++;
    points += CONFIG.POINTS_PER_LEVEL;
    ups++;
  }
  setNum(player, "xp", Math.round(xp * 10) / 10);
  if (ups > 0) {
    setNum(player, "level", level);
    setNum(player, "points", points);
    onLevelUp(player, level, points);
  }
}

function onLevelUp(player, level, points) {
  try {
    player.onScreenDisplay.setTitle(`§bNÍVEL ${level}`, {
      subtitle: `§e+${CONFIG.POINTS_PER_LEVEL} pontos §7(${points} disponíveis)`,
      fadeInDuration: 5,
      stayDuration: 40,
      fadeOutDuration: 10,
    });
    player.playSound("random.levelup");
    try {
      player.dimension.spawnParticle("minecraft:totem_particle", {
        x: player.location.x, y: player.location.y + 1.5, z: player.location.z,
      });
    } catch { /* partícula é cosmética */ }
    player.sendMessage(
      CONFIG.MESSAGES.SYSTEM_PREFIX +
        `§fVocê alcançou o nível §b${level}§f. Abra o §dNúcleo do Sistema§f para distribuir pontos.`
    );
  } catch (e) {
    console.error("[ARISE] Erro em onLevelUp: " + e);
  }
}

export function xpForMob(typeId) {
  const v = CONFIG.XP.TABLE[typeId];
  return typeof v === "number" ? v : CONFIG.XP.DEFAULT;
}

// ---------- Sufixos do HUD (Fase 8A: skill armada etc.) ----------
const hudSuffixProviders = [];
export function registerHudSuffix(fn) { hudSuffixProviders.push(fn); }

// ---------- Loops (chamados pelo main.js) ----------

// A cada ciclo MAIN (10 ticks): regen de mana + HUD no actionbar
export function tickHud(p) {
  const s = getStats(p);
  const mm = maxMana(p, s);

  // Regeneração de mana
  const regen = applyHooks(HOOKS.manaRegenMult, p, CONFIG.MANA.REGEN_PER_LOOP);
  let mana = Math.min(mm, s.mana + regen);
  if (mana !== s.mana) setNum(p, "mana", mana);

  // HUD: Nv | HP | MP | XP%
  const hc = p.getComponent("minecraft:health");
  const hp = hc ? Math.ceil(hc.currentValue) : 0;
  const mhp = hc ? Math.ceil(hc.effectiveMax) : 20;
  const pct = Math.min(99, Math.floor((s.xp / xpForNext(s.level)) * 100));
  let text =
    `§7Nv. §f${s.level} §8| §c❤ ${hp}§7/${mhp} §8| ` +
    `§b✦ ${Math.floor(mana)}§7/${mm} §8| §aXP ${pct}%`;
  if (s.points > 0) text += ` §8| §e+${s.points} pts`;
  for (const fn of hudSuffixProviders) {
    try {
      const t = fn(p);
      if (t) text += " " + t;
    } catch { /* sufixo é cosmético */ }
  }
  p.onScreenDisplay.setActionBar(text);
}

// A cada ~100 ticks: reaplica efeitos derivados dos atributos
export function tickEffects(p) {
  const s = getStats(p);
  const dur = A.EFFECT_DURATION;

  // Força -> strength (+ bônus de evolução via hook)
  let strAmp = Math.min(Math.floor(s.str / A.STR_POINTS_PER_AMP), A.STR_AMP_CAP + 1);
  strAmp = applyHooks(HOOKS.strengthAmpBonus, p, strAmp);
  if (strAmp > 0) {
    p.addEffect("strength", dur, { amplifier: strAmp - 1, showParticles: false });
  }

  // Agilidade -> speed
  const agiAmp = Math.min(Math.floor(s.agi / A.AGI_POINTS_PER_AMP), A.AGI_AMP_CAP + 1);
  if (agiAmp > 0) {
    p.addEffect("speed", dur, { amplifier: agiAmp - 1, showParticles: false });
  }

  // Vitalidade -> health_boost (+2 corações por nível de efeito)
  const vitAmp = Math.min(Math.floor(s.vit / A.VIT_POINTS_PER_AMP), A.VIT_AMP_CAP + 1);
  if (vitAmp > 0) {
    p.addEffect("health_boost", dur, { amplifier: vitAmp - 1, showParticles: false });
  }
}

// ---------- Entrega de itens (inventário cheio -> dropa aos pés) ----------
export function giveItem(player, typeId, amount) {
  try {
    const inv = player.getComponent("minecraft:inventory")?.container;
    const item = new ItemStack(typeId, amount);
    if (!inv || inv.emptySlotsCount === 0) {
      player.dimension.spawnItem(item, player.location);
    } else {
      inv.addItem(item);
    }
  } catch (e) {
    console.error("[ARISE] Erro em giveItem: " + e);
  }
}

// ---------- Item "Núcleo do Sistema" ----------
export function ensureSystemCore(player) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return;
  for (let i = 0; i < inv.size; i++) {
    if (inv.getItem(i)?.typeId === CONFIG.ITEMS.SYSTEM_CORE) return;
  }
  const item = new ItemStack(CONFIG.ITEMS.SYSTEM_CORE, 1);
  item.keepOnDeath = true;
  item.setLore(["§7Toque para abrir o Sistema."]);
  inv.addItem(item);
}

// ---------- Menu de atributos ----------
const ATTR_LABELS = [
  ["str", "§cForça", "dano corpo a corpo"],
  ["vit", "§4Vitalidade", "vida máxima"],
  ["agi", "§aAgilidade", "velocidade"],
  ["per", "§6Percepção", "+XP por abate"],
  ["man", "§bMana", "mana máxima"],
];

async function openDistribute(player) {
  const s = getStats(player);
  if (s.points <= 0) {
    player.sendMessage(CONFIG.MESSAGES.SYSTEM_PREFIX + "§7Sem pontos para distribuir. Suba de nível!");
    return;
  }
  const form = new ModalFormData().title(`§dDistribuir Pontos §8(§e${s.points}§8)`);
  for (const [key, label, desc] of ATTR_LABELS) {
    form.slider(`${label} §7[${s[key]}] — ${desc}`, 0, s.points, 1, 0);
  }
  const r = await form.show(player);
  if (r.canceled) return;

  const values = r.formValues.map(Number);
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) return;
  if (total > s.points) {
    player.sendMessage(
      CONFIG.MESSAGES.SYSTEM_PREFIX +
        `§cVocê distribuiu ${total} pontos, mas só tem ${s.points}. Tente de novo.`
    );
    return openDistribute(player);
  }

  ATTR_LABELS.forEach(([key], i) => {
    if (values[i] > 0) setNum(player, `attr_${key}`, s[key] + values[i]);
  });
  setNum(player, "points", s.points - total);
  tickEffects(player); // aplica os efeitos imediatamente
  player.playSound("random.orb");
  player.sendMessage(CONFIG.MESSAGES.SYSTEM_PREFIX + `§a${total} ponto(s) distribuído(s).`);
}

// ---------- Registro (chamado uma vez pelo main.js) ----------
export function initStats() {
  // XP ao matar mobs
  world.afterEvents.entityDie.subscribe((ev) => {
    try {
      const killer = ev.damageSource?.damagingEntity;
      if (!killer || killer.typeId !== "minecraft:player") return;
      const dead = ev.deadEntity;
      if (!dead || dead.typeId === "minecraft:player") return;
      let xp = xpForMob(dead.typeId);
      // Clarividência (8A): tipo analisado rende mais XP por 30s
      const rawA = killer.getDynamicProperty(`${NS}:analyzed`);
      if (typeof rawA === "string") {
        try {
          const a = JSON.parse(rawA);
          if (a.typeId === dead.typeId && Date.now() < a.until) {
            xp *= CONFIG.SKILLS.ANALYZE_XP_MULT;
          }
        } catch { /* marca corrompida: ignora */ }
      }
      if (xp > 0) addXp(killer, xp);
    } catch (e) {
      console.error("[ARISE] Erro em entityDie(XP): " + e);
    }
  });

  // Resumo no corpo do menu principal
  registerSummaryProvider((p) => {
    const s = getStats(p);
    return (
      `§7Nível §f${s.level} §8— §7XP §f${Math.floor(s.xp)}§7/${xpForNext(s.level)}\n` +
      `§cFor ${s.str} §8| §4Vit ${s.vit} §8| §aAgi ${s.agi} §8| §6Per ${s.per} §8| §bMan ${s.man}\n` +
      `§7Pontos livres: §e${s.points}`
    );
  });

  // Seção do menu principal
  registerMenuSection({
    id: "attrs",
    label: "§dDistribuir Pontos",
    icon: "textures/items/system_core",
    visible: () => true,
    open: openDistribute,
  });
}
