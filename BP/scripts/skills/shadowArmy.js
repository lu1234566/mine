// ============================================================
// ARISE — shadowArmy.js
// Exército de sombras: extrai sombras de mobs elegíveis mortos
// recentemente, comanda (seguir/aguardar/atacar), mantém reserva
// persistente e dá XP/tier às sombras.
//
// Persistência (dynamic properties do jogador):
//   arise:shadows     JSON [{id, type, tier, xp, active}]
//   arise:shadow_seq  contador de ids
// Entidades marcadas com tags:
//   arise_shadow, arise_own_<playerId>, arise_sid_<id>, arise_wait
// Mortes recentes ficam só em memória (Map) — janela curta.
// ============================================================

import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { CONFIG } from "../config.js";
import { HOOKS, applyHooks } from "../player/hooks.js";
import { spendMana, addXp, xpForMob } from "../player/stats.js";
import { registerSkill } from "./skillRegistry.js";
// import circular seguro: openFusion só é chamada em runtime (menu)
import { openFusion } from "./fusion.js";

const NS = CONFIG.NAMESPACE;
const SH = CONFIG.SHADOWS;
const MSG = CONFIG.MESSAGES.SYSTEM_PREFIX;

function dp(p, key) { return p.getDynamicProperty(`${NS}:${key}`); }
function setDp(p, key, v) { p.setDynamicProperty(`${NS}:${key}`, v); }

export function getRecords(p) {
  const raw = dp(p, "shadows");
  if (typeof raw !== "string") return [];
  try { return JSON.parse(raw); } catch { return []; }
}
export function saveRecords(p, recs) { setDp(p, "shadows", JSON.stringify(recs)); }

function shadowCap(p) {
  const level = dp(p, "level") ?? 1;
  const base = SH.CAP_BASE + Math.floor(level / SH.CAP_PER_LEVELS);
  return Math.floor(applyHooks(HOOKS.shadowCapBonus, p, base));
}

function ownTag(p) { return `arise_own_${p.id}`; }

export function nameFor(rec) {
  const rotulo = rec.tier >= CONFIG.FUSION.ELITE_TIER ? "§6ELITE§8" : `T${rec.tier}`;
  const base = rec.nome ? `§5${rec.nome} §7(${SH.TYPES[rec.type].nome})` : `§5${SH.TYPES[rec.type].nome}`;
  return `${base} §8[${rotulo}]`;
}

// ---------- mortes recentes (janela de extração) ----------
const recentDeaths = new Map(); // playerId -> [{typeId, type, loc, dimId, t}]

function pushDeath(player, dead) {
  const type = SH.ELIGIBLE[dead.typeId];
  if (!type) return;
  let lista = recentDeaths.get(player.id);
  if (!lista) { lista = []; recentDeaths.set(player.id, lista); }
  let loc;
  try { loc = { ...dead.location }; } catch { loc = { ...player.location }; }
  lista.push({ typeId: dead.typeId, type, loc, dimId: player.dimension.id, t: Date.now() });
  while (lista.length > SH.MAX_RECENT) lista.shift();
}

function freshDeaths(player) {
  const lista = recentDeaths.get(player.id) ?? [];
  const agora = Date.now();
  return lista.filter((d) => agora - d.t <= SH.EXTRACT_WINDOW_MS);
}

// ---------- spawn/gestão de entidades ----------
function findShadowEntities(player, maxDistance = 96) {
  return player.dimension.getEntities({
    tags: [ownTag(player)],
    location: player.location,
    maxDistance,
  });
}

function spawnShadow(player, rec, loc) {
  const dim = player.dimension;
  const ent = dim.spawnEntity(SH.TYPES[rec.type].entity, loc);
  ent.addTag("arise_shadow");
  ent.addTag(ownTag(player));
  ent.addTag(`arise_sid_${rec.id}`);
  ent.nameTag = nameFor(rec);
  if (rec.tier >= 2) ent.triggerEvent(`arise:tier${Math.min(rec.tier, 3)}`);
  // Elite (8C): efeitos extras "permanentes" + tag p/ partícula ambiente
  if (rec.tier >= CONFIG.FUSION.ELITE_TIER) {
    ent.addTag("arise_elite");
    for (const fx of CONFIG.FUSION.ELITE_EFFECTS) {
      try {
        ent.addEffect(fx.type, CONFIG.FUSION.ELITE_EFFECT_DURATION, {
          amplifier: fx.amplifier, showParticles: false,
        });
      } catch { /* efeito não suportado pela entidade */ }
    }
  }
  try {
    dim.spawnParticle("minecraft:large_explosion", {
      x: loc.x, y: loc.y + 1, z: loc.z,
    });
    player.playSound("mob.evocation_illager.prepare_summon", { volume: 0.5, pitch: 0.8 });
  } catch { /* cosmético */ }
  return ent;
}

function activeCount(recs) { return recs.filter((r) => r.active).length; }

// ---------- extração ----------
async function openExtract(player) {
  const mortes = freshDeaths(player);
  if (mortes.length === 0) {
    player.sendMessage(
      MSG + `§7Nenhum cadáver elegível nos últimos ${SH.EXTRACT_WINDOW_MS / 1000}s. ` +
      "§8(zumbis e esqueletos que VOCÊ matou)"
    );
    return;
  }
  const recs = getRecords(player);
  const cap = shadowCap(player);
  const form = new ActionFormData().title("§5Extrair Sombra")
    .body(
      `§7Sombras ativas: §f${activeCount(recs)}§7/${cap} — ` +
      `custo: §b${SH.EXTRACT_COST} mana§7, chance base ${Math.round(SH.BASE_CHANCE * 100)}%.`
    );
  const agora = Date.now();
  for (const d of mortes) {
    const s = Math.round((agora - d.t) / 1000);
    form.button(`§f${CONFIG.MOB_NAMES[d.typeId.replace("minecraft:", "")] ?? d.typeId}\n§7há ${s}s — vira ${SH.TYPES[d.type].nome}`);
  }
  form.button("§8Voltar");
  const r = await form.show(player);
  if (r.canceled || r.selection === undefined || r.selection >= mortes.length) return;
  const alvo = mortes[r.selection];

  // remove a morte escolhida da janela (tentativa consome o cadáver)
  const lista = recentDeaths.get(player.id) ?? [];
  const idx = lista.indexOf(alvo);
  if (idx >= 0) lista.splice(idx, 1);

  if (activeCount(recs) >= cap) {
    player.sendMessage(MSG + `§cLimite de sombras ativas (${cap}). Dispense ou suba de nível.`);
    return;
  }
  if (!spendMana(player, SH.EXTRACT_COST)) {
    player.sendMessage(MSG + `§cMana insuficiente (${SH.EXTRACT_COST}).`);
    return;
  }

  const per = dp(player, "attr_per") ?? 0;
  const chance = Math.min(0.95, SH.BASE_CHANCE + per * SH.PER_BONUS);
  if (Math.random() > chance) {
    player.playSound("note.bass");
    player.sendMessage(MSG + "§7A sombra resistiu e se dissipou...");
    return;
  }

  const seq = (dp(player, "shadow_seq") ?? 0) + 1;
  setDp(player, "shadow_seq", seq);
  const rec = { id: seq, type: alvo.type, tier: 1, xp: 0, active: true };
  recs.push(rec);
  saveRecords(player, recs);

  // nasce no local da morte se for perto e na mesma dimensão
  let loc = alvo.loc;
  if (alvo.dimId !== player.dimension.id ||
      Math.hypot(loc.x - player.location.x, loc.z - player.location.z) > 48) {
    loc = { x: player.location.x + 1.5, y: player.location.y, z: player.location.z + 1.5 };
  }
  spawnShadow(player, rec, loc);
  player.sendMessage(MSG + `§5LEVANTE-SE. §f${SH.TYPES[rec.type].nome} juntou-se ao seu exército.`);
}

// ---------- comandos ----------
async function openCommand(player) {
  const recs = getRecords(player);
  const cap = shadowCap(player);
  const reserva = recs.filter((r) => !r.active);
  let body =
    `§7Ativas: §f${activeCount(recs)}§7/${cap} — reserva: §f${reserva.length}\n`;
  const agoraCmd = Date.now();
  for (const r of recs) {
    const estado = r.active
      ? "§a(ativa)"
      : (r.woundedUntil && agoraCmd < r.woundedUntil
        ? `§c(ferida ${Math.ceil((r.woundedUntil - agoraCmd) / 60000)}m)`
        : "§8(reserva)");
    body += `§8- ${nameFor(r)} §7xp ${r.xp} ${estado}\n`;
  }
  const form = new ActionFormData().title("§5Comandar Sombras").body(body)
    .button("§aSeguir-me")
    .button("§eAguardar aqui")
    .button("§cAtacar meu alvo")
    .button("§bInvocar da reserva")
    .button("§8Dispensar todas (=> reserva)")
    .button("§8Voltar");
  const r = await form.show(player);
  if (r.canceled || r.selection === undefined) return;

  const ents = findShadowEntities(player);
  switch (r.selection) {
    case 0: { // seguir
      for (const e of ents) {
        try { e.triggerEvent("arise:follow"); e.removeTag("arise_wait"); } catch { }
      }
      player.sendMessage(MSG + "§5As sombras seguem você.");
      break;
    }
    case 1: { // aguardar
      for (const e of ents) {
        try { e.triggerEvent("arise:wait"); e.addTag("arise_wait"); } catch { }
      }
      player.sendMessage(MSG + "§5As sombras aguardam aqui.");
      break;
    }
    case 2: { // atacar alvo olhado
      const vistos = player.getEntitiesFromViewDirection({ maxDistance: 24 });
      const alvo = vistos
        .map((v) => v.entity)
        .find((e) => e && e.typeId !== "minecraft:player" && !e.hasTag("arise_shadow"));
      if (!alvo) {
        player.sendMessage(MSG + "§7Mire em uma criatura a até 24 blocos.");
        break;
      }
      let i = 0;
      for (const e of ents) {
        try {
          e.triggerEvent("arise:follow");
          e.removeTag("arise_wait");
          const ang = (Math.PI * 2 * i) / Math.max(ents.length, 1);
          e.teleport({
            x: alvo.location.x + Math.cos(ang) * 2,
            y: alvo.location.y,
            z: alvo.location.z + Math.sin(ang) * 2,
          }, { dimension: alvo.dimension });
          // "marca" o alvo: ele revida na sombra e o combate engata
          alvo.applyDamage(1, { damagingEntity: e });
          i++;
        } catch { }
      }
      player.sendMessage(MSG + "§5As sombras avançam!");
      break;
    }
    case 3: { // invocar da reserva
      await openSummon(player);
      break;
    }
    case 4: { // dispensar todas
      for (const e of ents) {
        try { e.remove(); } catch { }
      }
      for (const rec of recs) rec.active = false;
      saveRecords(player, recs);
      player.playSound("mob.endermen.portal", { pitch: 0.7 });
      player.sendMessage(MSG + "§5As sombras retornam à sua sombra.");
      break;
    }
  }
}

async function openSummon(player) {
  const recs = getRecords(player);
  const reserva = recs.filter((r) => !r.active);
  if (reserva.length === 0) {
    player.sendMessage(MSG + "§7A reserva está vazia.");
    return;
  }
  const cap = shadowCap(player);
  const agora = Date.now();
  const form = new ActionFormData().title("§5Invocar da Reserva")
    .body(`§7Ativas: §f${activeCount(recs)}§7/${cap} — custo: §b${SH.SUMMON_COST} mana§7 cada.`);
  for (const rec of reserva) {
    const ferida = rec.woundedUntil && agora < rec.woundedUntil;
    form.button(ferida
      ? `§8${nameFor(rec)}\n§c✚ ferida — ${Math.ceil((rec.woundedUntil - agora) / 60000)} min`
      : `${nameFor(rec)}\n§7xp ${rec.xp}`);
  }
  form.button("§8Voltar");
  const r = await form.show(player);
  if (r.canceled || r.selection === undefined || r.selection >= reserva.length) return;
  const rec = reserva[r.selection];

  if (rec.woundedUntil && Date.now() < rec.woundedUntil) {
    player.sendMessage(
      MSG + `§c${nameFor(rec)}§c ainda está ferida (${Math.ceil((rec.woundedUntil - Date.now()) / 60000)} min).`
    );
    return;
  }
  if (activeCount(recs) >= cap) {
    player.sendMessage(MSG + `§cLimite de sombras ativas (${cap}).`);
    return;
  }
  if (!spendMana(player, SH.SUMMON_COST)) {
    player.sendMessage(MSG + `§cMana insuficiente (${SH.SUMMON_COST}).`);
    return;
  }
  rec.active = true;
  saveRecords(player, recs);
  spawnShadow(player, rec, {
    x: player.location.x + 1.5, y: player.location.y, z: player.location.z + 1.5,
  });
  player.sendMessage(MSG + `§5${SH.TYPES[rec.type].nome} invocada da reserva.`);
}

// ---------- XP e tier das sombras ----------
function sidFromTags(ent) {
  for (const t of ent.getTags()) {
    if (t.startsWith("arise_sid_")) return Number(t.slice(10));
    }
  return undefined;
}
function ownerFromTags(ent) {
  for (const t of ent.getTags()) {
    if (t.startsWith("arise_own_")) return t.slice(10);
  }
  return undefined;
}

function onShadowKill(shadow, dead) {
  const sid = sidFromTags(shadow);
  const ownerId = ownerFromTags(shadow);
  if (sid === undefined || ownerId === undefined) return;
  const owner = world.getAllPlayers().find((p) => p.id === ownerId);
  if (!owner) return;

  // dono ganha parte do XP do abate
  const xp = xpForMob(dead.typeId);
  if (xp > 0) addXp(owner, xp * SH.OWNER_XP_SHARE);

  const recs = getRecords(owner);
  const rec = recs.find((r) => r.id === sid);
  if (!rec) return;
  rec.xp += 1;
  const novoTier = SH.TIER_THRESHOLDS.filter((t) => rec.xp >= t).length;
  if (novoTier > rec.tier && rec.tier < 3) {
    rec.tier = Math.min(novoTier, 3);
    try {
      shadow.triggerEvent(`arise:tier${rec.tier}`);
      shadow.nameTag = nameFor(rec);
      owner.playSound("beacon.power");
      owner.sendMessage(MSG + `§5Sua ${SH.TYPES[rec.type].nome} evoluiu para o §fTier ${rec.tier}§5!`);
    } catch (e) {
      console.error("[ARISE] Erro no tier-up de sombra: " + e);
    }
  }
  saveRecords(owner, recs);
}

// ---------- tick (chamado pelo main.js) ----------
// Sombras longe demais são teletransportadas para perto do dono
export function tickShadows(player, ciclo) {
  if (ciclo % SH.FOLLOW_CHECK_EVERY !== 0) return;
  try {
    const ents = findShadowEntities(player);
    for (const e of ents) {
      // Elite (8C): partícula ambiente sutil (1 por checagem, barato)
      if (e.hasTag("arise_elite")) {
        try {
          e.dimension.spawnParticle("minecraft:basic_smoke_particle", {
            x: e.location.x, y: e.location.y + 2.1, z: e.location.z,
          });
        } catch { /* cosmético */ }
      }
      if (e.hasTag("arise_wait")) continue;
      const d = Math.hypot(
        e.location.x - player.location.x,
        e.location.z - player.location.z
      );
      if (d > SH.FOLLOW_TELEPORT_DIST) {
        e.teleport({
          x: player.location.x + (Math.random() * 4 - 2),
          y: player.location.y,
          z: player.location.z + (Math.random() * 4 - 2),
        }, { dimension: player.dimension });
      }
    }
  } catch (e) {
    console.error("[ARISE] Erro em tickShadows: " + e);
  }
}

// ---------- registro ----------
export function initShadows() {
  world.afterEvents.entityDie.subscribe((ev) => {
    try {
      const dead = ev.deadEntity;
      const killer = ev.damageSource?.damagingEntity;

      // 1) sombra morreu -> volta para a reserva
      if (dead?.hasTag && dead.hasTag("arise_shadow")) {
        const sid = sidFromTags(dead);
        const ownerId = ownerFromTags(dead);
        const owner = world.getAllPlayers().find((p) => p.id === ownerId);
        if (owner && sid !== undefined) {
          const recs = getRecords(owner);
          const rec = recs.find((r) => r.id === sid);
          if (rec) {
            rec.active = false;
            // sombra nomeada (fundida) volta FERIDA: reinvocação em cooldown
            if (rec.nome) {
              rec.woundedUntil = Date.now() + CONFIG.FUSION.WOUND_MS;
              owner.sendMessage(
                MSG + `§7${nameFor(rec)}§7 caiu, mas resistiu — ferida por ` +
                `${Math.round(CONFIG.FUSION.WOUND_MS / 60000)} min na reserva.`
              );
            } else {
              owner.sendMessage(MSG + `§7Sua ${SH.TYPES[rec.type].nome} caiu e retornou à reserva.`);
            }
            saveRecords(owner, recs);
          }
        }
        return;
      }

      // 2) jogador matou mob elegível -> registra para extração
      if (killer?.typeId === "minecraft:player" && dead) {
        pushDeath(killer, dead);
      }

      // 3) sombra matou -> XP da sombra + parte para o dono
      if (killer?.hasTag && killer.hasTag("arise_shadow") && dead) {
        onShadowKill(killer, dead);
      }
    } catch (e) {
      console.error("[ARISE] Erro em entityDie(sombras): " + e);
    }
  });

  registerSkill({
    id: "shadows",
    nome: "Exército de Sombras",
    requisito: `desbloqueia no nível ${SH.UNLOCK_LEVEL}`,
    unlocked: (p) => (dp(p, "level") ?? 1) >= SH.UNLOCK_LEVEL,
    statusText: (p) => {
      const recs = getRecords(p);
      return `§8[§f${activeCount(recs)}§7/${shadowCap(p)}§8]`;
    },
    bodyText: (p) => {
      if ((dp(p, "level") ?? 1) < SH.UNLOCK_LEVEL) return "";
      const recs = getRecords(p);
      return (
        `§5Exército de Sombras§7 — extraia sombras de zumbis/esqueletos ` +
        `mortos há menos de ${SH.EXTRACT_WINDOW_MS / 1000}s. ` +
        `Ativas: §f${activeCount(recs)}§7/${shadowCap(p)}, reserva: §f${recs.length - activeCount(recs)}§7.`
      );
    },
    onSelect: async (p) => {
      const form = new ActionFormData().title("§5Exército de Sombras")
        .button("§5Extrair Sombra\n§7de um abate recente")
        .button("§5Comandar\n§7seguir, aguardar, atacar, reserva")
        .button("§5Fundir\n§73 iguais viram 1 do tier seguinte")
        .button("§8Voltar");
      const r = await form.show(p);
      if (r.canceled || r.selection === undefined) return;
      if (r.selection === 0) await openExtract(p);
      else if (r.selection === 1) await openCommand(p);
      else if (r.selection === 2) await openFusion(p);
    },
  });
}
