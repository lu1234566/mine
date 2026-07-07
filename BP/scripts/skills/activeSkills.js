// ============================================================
// ARISE — activeSkills.js (Fase 8A)
// Habilidades ativas disparadas pelo "Grimório de Habilidades":
//   usar o item        -> dispara a skill ARMADA (1 toque em combate)
//   agachar + usar     -> abre o menu para armar/trocar skill
// Cooldowns em dynamic property com timestamp (persistem no relog):
//   arise:cd_<skillId> = ms de quando a skill libera
//   arise:armed_skill  = id da skill armada
//   arise:analyzed     = JSON {typeId, until} (marca da Clarividência)
// ============================================================

import { world, ItemStack, EntityDamageCause } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { CONFIG } from "../config.js";
import { getStats, spendMana, registerHudSuffix } from "../player/stats.js";
import { getSpecies } from "../player/classes.js";
import { registerSkill } from "./skillRegistry.js";

const NS = CONFIG.NAMESPACE;
const SK = CONFIG.SKILLS;
const MSG = CONFIG.MESSAGES.SYSTEM_PREFIX;

function dp(p, key) { return p.getDynamicProperty(`${NS}:${key}`); }
function setDp(p, key, v) { p.setDynamicProperty(`${NS}:${key}`, v); }

// ---------- desbloqueio / cooldown ----------
// Skill com lista `species` é exclusiva dessas espécies; Clarividência
// abre para todos a partir de `geralAposNivel`.
function isUnlocked(p, id) {
  const cfg = SK.LIST[id];
  const s = getStats(p);
  if (s.level < cfg.unlock) return false;
  if (cfg.species) {
    const sp = getSpecies(p);
    if (!cfg.species.includes(sp)) {
      if (!(cfg.geralAposNivel && s.level >= cfg.geralAposNivel)) return false;
    }
  }
  return true;
}

function requisitoTexto(cfg) {
  let t = `Nv.${cfg.unlock}`;
  if (cfg.species) {
    const nomes = cfg.species.map((s) => CONFIG.SPECIES[s]?.nome ?? s).join("/");
    t += cfg.geralAposNivel ? ` (${nomes}; geral no Nv.${cfg.geralAposNivel})` : ` (${nomes})`;
  }
  return t;
}

function cooldownRestMs(p, id) {
  const t = dp(p, `cd_${id}`);
  return typeof t === "number" ? Math.max(0, t - Date.now()) : 0;
}

// ---------- execução das skills ----------
function castImpulso(p, cfg) {
  const dir = p.getViewDirection();
  p.applyKnockback(dir.x, dir.z, cfg.forca, cfg.vertical);
  p.playSound("mob.endermen.portal", { pitch: 1.8, volume: 0.4 });
  return true;
}

function castGolpeFantasma(p, cfg) {
  const s = getStats(p);
  const dano = Math.round(cfg.danoBase + s.str * cfg.danoPorForca);
  // só hostis (família monster); sombras/jogador ficam de fora por família
  const alvos = p.dimension.getEntities({
    location: p.location, maxDistance: cfg.raio, families: ["monster"],
  });
  for (const e of alvos) {
    try {
      e.applyDamage(dano, { cause: EntityDamageCause.entityAttack, damagingEntity: p });
    } catch { /* alvo pode ter morrido no meio do loop */ }
  }
  try {
    p.dimension.spawnParticle("minecraft:large_explosion", {
      x: p.location.x, y: p.location.y + 1, z: p.location.z,
    });
  } catch { }
  p.playSound("mob.warden.sonic_boom", { volume: 0.4, pitch: 1.4 });
  p.onScreenDisplay.setActionBar(`§d⚔ Golpe Fantasma: §f${alvos.length}§7 alvo(s), §c${dano}§7 de dano`);
  return true;
}

function castOcultacao(p, cfg) {
  p.addEffect("invisibility", cfg.duracaoTicks, { showParticles: false });
  p.playSound("mob.endermen.portal", { pitch: 0.6, volume: 0.5 });
  // Limitação da API estável: não dá para limpar o alvo de mobs que JÁ
  // estavam agressivos — eles continuam atacando até perder a linha.
  p.sendMessage(MSG + `§7Você se dissolve nas sombras por ${Math.round(cfg.duracaoTicks / 20)}s.`);
  return true;
}

function alvoOlhado(p, alcance) {
  const vistos = p.getEntitiesFromViewDirection({ maxDistance: alcance });
  for (const v of vistos) {
    const e = v.entity;
    if (e && e.typeId !== "minecraft:player" && !e.hasTag("arise_shadow")) return e;
  }
  return undefined;
}

function castDreno(p, cfg) {
  const alvo = alvoOlhado(p, cfg.alcance);
  if (!alvo) {
    p.onScreenDisplay.setActionBar("§7Mire em uma criatura para drenar.");
    return false; // não gasta mana/cooldown
  }
  const s = getStats(p);
  const dano = Math.round(cfg.danoBase + s.str * cfg.danoPorForca);
  alvo.applyDamage(dano, { cause: EntityDamageCause.entityAttack, damagingEntity: p });
  const hc = p.getComponent("minecraft:health");
  if (hc && hc.currentValue > 0) {
    hc.setCurrentValue(Math.min(hc.effectiveMax, hc.currentValue + dano * cfg.curaPct));
  }
  try {
    p.dimension.spawnParticle("minecraft:heart_particle", {
      x: p.location.x, y: p.location.y + 1.8, z: p.location.z,
    });
  } catch { }
  p.playSound("mob.endermen.portal", { pitch: 0.5, volume: 0.5 });
  p.onScreenDisplay.setActionBar(`§5🩸 Dreno: §c${dano}§7 de dano, §a+${Math.round(dano * cfg.curaPct)}§7 de vida`);
  return true;
}

function castClarividencia(p, cfg) {
  const alvo = alvoOlhado(p, cfg.alcance);
  if (!alvo) {
    p.onScreenDisplay.setActionBar("§7Mire em uma criatura para analisar.");
    return false;
  }
  const hc = alvo.getComponent("minecraft:health");
  const nome = CONFIG.MOB_NAMES[alvo.typeId.replace("minecraft:", "")] ?? alvo.typeId.replace("minecraft:", "");
  const vida = hc ? `§c❤ ${Math.ceil(hc.currentValue)}§7/${Math.ceil(hc.effectiveMax)}` : "§7vida desconhecida";
  setDp(p, "analyzed", JSON.stringify({ typeId: alvo.typeId, until: Date.now() + SK.ANALYZE_MARK_MS }));
  p.playSound("random.orb", { pitch: 1.5 });
  p.onScreenDisplay.setActionBar(
    `§b👁 ${nome} §8— ${vida} §8— §d+XP/Devorar por ${SK.ANALYZE_MARK_MS / 1000}s`
  );
  return true;
}

const CASTERS = {
  impulso: castImpulso,
  golpe_fantasma: castGolpeFantasma,
  ocultacao: castOcultacao,
  dreno: castDreno,
  clarividencia: castClarividencia,
};

function castSkill(p, id) {
  const cfg = SK.LIST[id];
  if (!cfg) return;
  if (!isUnlocked(p, id)) {
    p.sendMessage(MSG + `§c${cfg.nome} bloqueada — requisito: ${requisitoTexto(cfg)}.`);
    return;
  }
  const rest = cooldownRestMs(p, id);
  if (rest > 0) {
    p.onScreenDisplay.setActionBar(`§7${cfg.nome} recarrega em §c${Math.ceil(rest / 1000)}s`);
    p.playSound("note.bass", { pitch: 0.7 });
    return;
  }
  if (getStats(p).mana < cfg.mana) {
    p.onScreenDisplay.setActionBar(`§bMana insuficiente (${cfg.mana}) para ${cfg.nome}.`);
    p.playSound("note.bass", { pitch: 0.7 });
    return;
  }
  // o caster retorna false quando o alvo era inválido (não consome nada)
  const ok = CASTERS[id](p, cfg);
  if (ok) {
    spendMana(p, cfg.mana);
    setDp(p, `cd_${id}`, Date.now() + cfg.cooldownMs);
  }
}

// ---------- menu de armar ----------
async function openSkillMenu(p) {
  try {
    const armed = dp(p, "armed_skill");
    const form = new ActionFormData().title("§dGrimório de Habilidades");
    form.body(
      "§7Toque numa habilidade para ARMÁ-LA.\n" +
      "§7Usar o Grimório dispara a skill armada; §fagachar+usar§7 reabre este menu.\n\n" +
      (typeof armed === "string" && SK.LIST[armed]
        ? `§fArmada: §d${SK.LIST[armed].nome}`
        : "§8Nenhuma skill armada.")
    );
    const ids = Object.keys(SK.LIST);
    const selecionaveis = [];
    for (const id of ids) {
      const cfg = SK.LIST[id];
      if (isUnlocked(p, id)) {
        const rest = cooldownRestMs(p, id);
        const estado = rest > 0 ? `§c(recarrega ${Math.ceil(rest / 1000)}s)` : "§a(pronta)";
        const marca = armed === id ? "§d► " : "§f";
        form.button(`${marca}${cfg.nome} ${estado}\n§7${cfg.desc} §8· §b${cfg.mana} mana`);
        selecionaveis.push(id);
      } else {
        form.button(`§8${cfg.nome} — ${requisitoTexto(cfg)}\n§8${cfg.desc}`);
        selecionaveis.push(null);
      }
    }
    if (typeof armed === "string") form.button("§8Desarmar");
    form.button("§8Fechar");

    const r = await form.show(p);
    if (r.canceled || r.selection === undefined) return;
    if (r.selection < ids.length) {
      const id = selecionaveis[r.selection];
      if (!id) {
        p.sendMessage(MSG + "§7Habilidade ainda bloqueada.");
        return;
      }
      setDp(p, "armed_skill", id);
      p.playSound("random.orb");
      p.sendMessage(MSG + `§d${SK.LIST[id].nome}§f armada. Use o Grimório para disparar.`);
    } else if (typeof armed === "string" && r.selection === ids.length) {
      setDp(p, "armed_skill", undefined);
      p.sendMessage(MSG + "§7Grimório desarmado.");
    }
  } catch (e) {
    console.error("[ARISE] Erro em openSkillMenu: " + e);
  }
}

// ---------- item Grimório ----------
export function ensureGrimoire(player) {
  try {
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) return;
    for (let i = 0; i < inv.size; i++) {
      if (inv.getItem(i)?.typeId === CONFIG.ITEMS.SKILL_GRIMOIRE) return;
    }
    const item = new ItemStack(CONFIG.ITEMS.SKILL_GRIMOIRE, 1);
    item.keepOnDeath = true;
    item.setLore(["§7Usar: dispara a skill armada.", "§7Agachar + usar: abre o menu."]);
    inv.addItem(item);
  } catch (e) {
    console.error("[ARISE] Erro em ensureGrimoire: " + e);
  }
}

// ---------- registro ----------
export function initActiveSkills() {
  world.afterEvents.itemUse.subscribe((ev) => {
    try {
      if (ev.itemStack?.typeId !== CONFIG.ITEMS.SKILL_GRIMOIRE) return;
      const p = ev.source;
      const armed = dp(p, "armed_skill");
      if (p.isSneaking || typeof armed !== "string" || !SK.LIST[armed]) {
        openSkillMenu(p);
      } else {
        castSkill(p, armed);
      }
    } catch (e) {
      console.error("[ARISE] Erro em itemUse(grimório): " + e);
    }
  });

  // HUD: sufixo com a skill armada (e cooldown, se houver)
  registerHudSuffix((p) => {
    const armed = dp(p, "armed_skill");
    if (typeof armed !== "string" || !SK.LIST[armed]) return "";
    const rest = cooldownRestMs(p, armed);
    return rest > 0
      ? `§8| §7⚔ ${SK.LIST[armed].nome} §c${Math.ceil(rest / 1000)}s`
      : `§8| §d⚔ ${SK.LIST[armed].nome}`;
  });

  // entrada no menu Habilidades existente (descoberta sem o item)
  registerSkill({
    id: "grimoire",
    nome: "Grimório de Habilidades",
    requisito: "",
    unlocked: () => true,
    statusText: (p) => {
      const armed = dp(p, "armed_skill");
      return typeof armed === "string" && SK.LIST[armed]
        ? `§8[§d${SK.LIST[armed].nome}§8]`
        : "§8[§7desarmado§8]";
    },
    onSelect: openSkillMenu,
  });
}
