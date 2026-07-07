// ============================================================
// ARISE — fusion.js (Fase 8C)
// Fusão de sombras: 3 sombras IGUAIS (mesmo tipo e tier) da
// reserva -> 1 sombra do tier seguinte, com nome próprio sorteado.
// Tier 4 (Elite) só existe por fusão. Custo: cristais de essência
// (pelo tier resultante) + mana. Irreversível — confirmação via
// ActionFormData mostrando exatamente o que será consumido.
// ============================================================

import { ActionFormData } from "@minecraft/server-ui";
import { CONFIG } from "../config.js";
import { getStats, spendMana } from "../player/stats.js";
import { getRecords, saveRecords, nameFor } from "./shadowArmy.js";

const NS = CONFIG.NAMESPACE;
const F = CONFIG.FUSION;
const SH = CONFIG.SHADOWS;
const MSG = CONFIG.MESSAGES.SYSTEM_PREFIX;

function dp(p, key) { return p.getDynamicProperty(`${NS}:${key}`); }
function setDp(p, key, v) { p.setDynamicProperty(`${NS}:${key}`, v); }

// ---------- cristais ----------
function countCrystals(player) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return 0;
  let n = 0;
  for (let i = 0; i < inv.size; i++) {
    const item = inv.getItem(i);
    if (item?.typeId === CONFIG.ITEMS.ESSENCE_CRYSTAL) n += item.amount;
  }
  return n;
}

function removeCrystals(player, quanto) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return false;
  for (let i = 0; i < inv.size && quanto > 0; i++) {
    const item = inv.getItem(i);
    if (item?.typeId !== CONFIG.ITEMS.ESSENCE_CRYSTAL) continue;
    const tira = Math.min(item.amount, quanto);
    quanto -= tira;
    if (item.amount > tira) {
      item.amount -= tira;
      inv.setItem(i, item);
    } else {
      inv.setItem(i, undefined);
    }
  }
  return quanto === 0;
}

// ---------- nome sorteado (evita repetir entre as sombras do jogador) ----------
function sortearNome(recs) {
  const usados = new Set(recs.map((r) => r.nome).filter(Boolean));
  const livres = F.NOMES.filter((n) => !usados.has(n));
  if (livres.length > 0) return livres[Math.floor(Math.random() * livres.length)];
  // todos usados: sufixa numeral
  const base = F.NOMES[Math.floor(Math.random() * F.NOMES.length)];
  let i = 2;
  while (usados.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

// ---------- opções de fusão ----------
// agrupa a RESERVA por tipo+tier com 3+ disponíveis (sem feridas)
function fusionOptions(recs) {
  const grupos = new Map();
  const agora = Date.now();
  for (const r of recs) {
    if (r.active) continue;
    if (r.woundedUntil && agora < r.woundedUntil) continue;
    if (r.tier >= F.ELITE_TIER) continue; // Elite não funde
    const k = `${r.type}|${r.tier}`;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(r);
  }
  const opcoes = [];
  for (const [k, lista] of grupos) {
    if (lista.length >= F.REQUIRED) {
      const [type, tier] = k.split("|");
      // consome as de MENOR xp (protege as mais treinadas)
      lista.sort((a, b) => a.xp - b.xp);
      opcoes.push({ type, tier: Number(tier), consumir: lista.slice(0, F.REQUIRED) });
    }
  }
  return opcoes;
}

async function executeFusion(player, opcao) {
  const alvoTier = opcao.tier + 1;
  const cristais = F.CRYSTALS_BY_TIER[alvoTier] ?? 0;
  const tipoNome = SH.TYPES[opcao.type].nome;
  const rotuloAlvo = alvoTier >= F.ELITE_TIER ? "§6ELITE" : `T${alvoTier}`;

  // confirmação explícita (ActionForm; nunca MessageForm)
  const confirm = new ActionFormData()
    .title("§5Fusão — irreversível")
    .body(
      `§fSerão CONSUMIDOS:\n` +
      `§c- 3x ${tipoNome} [T${opcao.tier}]§7 (as de menor XP)\n` +
      `§c- ${cristais}x Cristal de Essência\n` +
      `§c- ${F.MANA_COST} de mana\n\n` +
      `§fResultado: §a1x ${tipoNome} [${rotuloAlvo}§a]§f com nome próprio.\n\n` +
      "§cNão há como desfazer."
    )
    .button("§aFundir")
    .button("§cCancelar");
  const r = await confirm.show(player);
  if (r.canceled || r.selection !== 0) return;

  // revalida tudo na hora de executar
  const recs = getRecords(player);
  const ids = new Set(opcao.consumir.map((c) => c.id));
  const alvos = recs.filter((x) => ids.has(x.id) && !x.active);
  if (alvos.length < F.REQUIRED) {
    player.sendMessage(MSG + "§cAs sombras selecionadas não estão mais disponíveis.");
    return;
  }
  if (countCrystals(player) < cristais) {
    player.sendMessage(MSG + `§cVocê precisa de ${cristais} Cristal(is) de Essência.`);
    return;
  }
  if (getStats(player).mana < F.MANA_COST) {
    player.sendMessage(MSG + `§cMana insuficiente (${F.MANA_COST}).`);
    return;
  }
  if (!removeCrystals(player, cristais) || !spendMana(player, F.MANA_COST)) {
    player.sendMessage(MSG + "§cA fusão falhou ao cobrar o custo. Nada foi consumido além disso.");
    return;
  }

  // consome as 3 e cria a nova
  const restantes = recs.filter((x) => !ids.has(x.id));
  const seq = (dp(player, "shadow_seq") ?? 0) + 1;
  setDp(player, "shadow_seq", seq);
  const nova = {
    id: seq, type: opcao.type, tier: alvoTier, xp: 0, active: false,
    nome: sortearNome(recs),
  };
  restantes.push(nova);
  saveRecords(player, restantes);

  player.onScreenDisplay.setTitle("§5[ FUSÃO COMPLETA ]", {
    subtitle: `§f${nameFor(nova)}§f desperta na sua reserva.`,
    fadeInDuration: 5, stayDuration: 70, fadeOutDuration: 20,
  });
  player.playSound("beacon.power");
  player.sendMessage(
    MSG + `§5Fusão completa: §f${nameFor(nova)}§5. Invoque-a pela reserva do Exército.`
  );
}

// ---------- menu ----------
export async function openFusion(player) {
  try {
    const recs = getRecords(player);
    const opcoes = fusionOptions(recs);
    const form = new ActionFormData().title("§5Fundir Sombras");
    if (opcoes.length === 0) {
      form.body(
        `§7É preciso ter §f${F.REQUIRED}§7 sombras do MESMO tipo e tier na ` +
        "reserva (sem feridas). Dispense sombras ativas para movê-las à reserva.\n\n" +
        `§7Custo por fusão: cristais (${Object.entries(F.CRYSTALS_BY_TIER)
          .map(([t, c]) => `T${t}: ${c}`).join(", ")}) + §b${F.MANA_COST} mana§7.`
      );
      form.button("§8Voltar");
      await form.show(player);
      return;
    }
    form.body(
      `§7Fusão consome §c${F.REQUIRED}§7 sombras iguais e gera §a1§7 do tier ` +
      `seguinte com nome próprio. §fT${F.ELITE_TIER - 1} funde em §6ELITE§f.\n` +
      `§7Cristais: §f${countCrystals(player)}§7 — mana: §b${Math.floor(getStats(player).mana)}`
    );
    for (const o of opcoes) {
      const alvoTier = o.tier + 1;
      const cristais = F.CRYSTALS_BY_TIER[alvoTier] ?? 0;
      const rotulo = alvoTier >= F.ELITE_TIER ? "§6ELITE" : `T${alvoTier}`;
      form.button(
        `§f3x ${SH.TYPES[o.type].nome} [T${o.tier}] §7→ §a[${rotulo}§a]\n` +
        `§7custo: ${cristais} cristal(is) + ${F.MANA_COST} mana`
      );
    }
    form.button("§8Voltar");
    const r = await form.show(player);
    if (r.canceled || r.selection === undefined || r.selection >= opcoes.length) return;
    await executeFusion(player, opcoes[r.selection]);
  } catch (e) {
    console.error("[ARISE] Erro em openFusion: " + e);
  }
}
