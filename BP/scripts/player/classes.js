// ============================================================
// ARISE — classes.js
// Espécie e evolução. A escolha é PERMANENTE, muda o título no
// nametag e concede bônus via hooks (stats.js aplica sem nos
// conhecer). Persistência: arise:species.
// ============================================================

import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { CONFIG } from "../config.js";
import { HOOKS } from "./hooks.js";
import { registerMenuSection, registerSummaryProvider } from "../ui/menus.js";
import { totalEssences } from "../skills/devour.js";

const NS = CONFIG.NAMESPACE;
const MSG = CONFIG.MESSAGES.SYSTEM_PREFIX;

function dp(p, key) { return p.getDynamicProperty(`${NS}:${key}`); }
function setDp(p, key, v) { p.setDynamicProperty(`${NS}:${key}`, v); }

export function getSpecies(p) {
  const s = dp(p, "species");
  return typeof s === "string" && CONFIG.SPECIES[s] ? s : "despertado";
}

function bonus(p) {
  return CONFIG.SPECIES_BONUS[getSpecies(p)] ?? null;
}

// Título no nametag: ‹Espécie› Nome
export function applyNameTag(p) {
  try {
    const sp = CONFIG.SPECIES[getSpecies(p)];
    p.nameTag = `§8‹${sp.cor}${sp.nome}§8›§r ${p.name}`;
  } catch (e) {
    console.error("[ARISE] Erro em applyNameTag: " + e);
  }
}

// ---------- evolução ----------
function availableEvolutions(p) {
  const atual = getSpecies(p);
  const level = dp(p, "level") ?? 1;
  const ess = totalEssences(p);
  return CONFIG.EVOLUTIONS.filter((e) => e.from === atual)
    .map((e) => ({ ...e, ok: level >= e.level && ess >= e.essences }));
}

async function openEvolutionMenu(player) {
  try {
    const atual = CONFIG.SPECIES[getSpecies(player)];
    const opcoes = availableEvolutions(player);
    const form = new ActionFormData().title("§5Evolução");
    const level = dp(player, "level") ?? 1;
    const ess = totalEssences(player);
    let body =
      `§7Espécie atual: ${atual.cor}${atual.nome}§7.\n` +
      `§7Nível §f${level}§7 — essências totais: §f${ess}§7.\n\n`;
    if (opcoes.length === 0) {
      body += "§8Nenhuma evolução disponível para sua espécie (por enquanto).";
    } else {
      body += "§cA escolha é permanente.";
    }
    form.body(body);
    for (const o of opcoes) {
      const alvo = CONFIG.SPECIES[o.to];
      form.button(
        o.ok
          ? `${alvo.cor}${alvo.nome}\n§7${o.desc}`
          : `§8${alvo.nome} — Nv.${o.level} e ${o.essences} essências`
      );
    }
    form.button("§8Voltar");

    const r = await form.show(player);
    if (r.canceled || r.selection === undefined || r.selection >= opcoes.length) return;
    const escolha = opcoes[r.selection];
    if (!escolha.ok) {
      player.sendMessage(
        MSG + `§7Requisitos: nível §f${escolha.level}§7 e §f${escolha.essences}§7 essências.`
      );
      return;
    }

    const alvo = CONFIG.SPECIES[escolha.to];
    const confirm = new ActionFormData()
      .title("§5Evolução permanente")
      .body(
        `§fEvoluir para ${alvo.cor}${alvo.nome}§f?\n\n§7${escolha.desc}\n\n` +
        "§cNão há como voltar atrás."
      )
      .button(`§aEvoluir para ${alvo.nome}`)
      .button("§cCancelar");
    const c = await confirm.show(player);
    if (c.canceled || c.selection !== 0) return;

    setDp(player, "species", escolha.to);
    applyNameTag(player);
    player.onScreenDisplay.setTitle("§5[ EVOLUÇÃO ]", {
      subtitle: `§fVocê agora é ${alvo.cor}${alvo.nome}§f.`,
      fadeInDuration: 10, stayDuration: 70, fadeOutDuration: 20,
    });
    player.playSound("mob.enderdragon.growl", { volume: 0.4, pitch: 1.4 });
    player.sendMessage(MSG + `§5Evolução completa: ${alvo.cor}${alvo.nome}§5. ${escolha.desc}`);
  } catch (e) {
    console.error("[ARISE] Erro em openEvolutionMenu: " + e);
  }
}

// ---------- registro ----------
export function initClasses() {
  // Bônus de espécie entram como hooks; o stats.js os aplica.
  HOOKS.xpMult.push((p, v) => {
    const b = bonus(p);
    return b ? v * b.xpMult : v;
  });
  HOOKS.manaMaxMult.push((p, v) => {
    const b = bonus(p);
    return b ? v * b.manaMult : v;
  });
  HOOKS.manaRegenMult.push((p, v) => {
    const b = bonus(p);
    return b ? v * b.manaRegenMult : v;
  });
  HOOKS.strengthAmpBonus.push((p, v) => {
    const b = bonus(p);
    return b ? v + b.strengthAmp : v;
  });
  HOOKS.devourChanceBonus.push((p, v) => {
    const b = bonus(p);
    return b ? v + b.devourChance : v;
  });

  // nametag ao entrar
  world.afterEvents.playerSpawn.subscribe((ev) => {
    try {
      if (ev.initialSpawn) applyNameTag(ev.player);
    } catch (e) {
      console.error("[ARISE] Erro em playerSpawn(nametag): " + e);
    }
  });

  registerSummaryProvider((p) => {
    const sp = CONFIG.SPECIES[getSpecies(p)];
    return `§7Espécie: ${sp.cor}${sp.nome}`;
  });

  registerMenuSection({
    id: "evolution",
    label: "§5Evolução",
    icon: "textures/items/system_core",
    visible: () => true,
    open: openEvolutionMenu,
  });
}
