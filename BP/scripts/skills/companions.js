// ============================================================
// ARISE — Companheiros vivos
// Subfase 1: recrutar lobo/gato com Selos do Nome, seguir dono
// via tameable vanilla quando disponível, drenar mana e persistir.
// ============================================================

import { world, system, EquipmentSlot, ItemStack } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { getStats, spendMana } from "../player/stats.js";

const NS = CONFIG.NAMESPACE;
const C = CONFIG.COMPANIONS;
const MSG = CONFIG.MESSAGES.SYSTEM_PREFIX;
const DP_COMPANIONS = `${NS}:${C.DP_KEY}`;

function safeId(id) {
  return String(id ?? "player").replace(/[^A-Za-z0-9_]/g, "_");
}

function ownerTag(player) {
  return `arise_own_${safeId(player.id)}`;
}

function cidTag(cid) {
  return `arise_cid_${cid}`;
}

function isValidEntity(entity) {
  try {
    return !!entity && (typeof entity.isValid === "function" ? entity.isValid() : entity.isValid !== false);
  } catch {
    return false;
  }
}

function tierForItem(typeId) {
  for (const [tier, cfg] of Object.entries(C.TIERS)) {
    if (cfg.item === typeId) return tier;
  }
  return null;
}

function readRegistry(player) {
  const raw = player.getDynamicProperty(DP_COMPANIONS);
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c) => c?.cid && c?.tier) : [];
  } catch {
    return [];
  }
}

function writeRegistry(player, entries) {
  player.setDynamicProperty(DP_COMPANIONS, JSON.stringify(entries));
}

function consumeMainhand(player, typeId) {
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

function refundSeal(player, typeId) {
  try {
    const item = new ItemStack(typeId, 1);
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv || inv.emptySlotsCount === 0) player.dimension.spawnItem(item, player.location);
    else inv.addItem(item);
  } catch (e) {
    console.error("[ARISE] Erro ao devolver selo: " + e);
  }
}

function findCompanion(player, entry) {
  const tags = [C.TAG, ownerTag(player), cidTag(entry.cid)];
  const dims = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
  for (const dimId of dims) {
    try {
      const found = world.getDimension(dimId).getEntities({ tags })?.[0];
      if (isValidEntity(found)) return found;
    } catch {
      // Dimensão indisponível ou chunk descarregado: trata como ausente.
    }
  }
  return null;
}

function companionName(tier, typeId) {
  const cfg = C.TIERS[tier];
  const mob = typeId === "minecraft:cat" ? "Gato" : "Lobo";
  return `${cfg.cor}${mob} Selado §8[${cfg.nome}]`;
}

function applyTier(entity, tier) {
  const cfg = C.TIERS[tier];
  if (!cfg) return;
  try {
    if (cfg.healthAmp > 0) {
      entity.addEffect("health_boost", C.EFFECT_DURATION, {
        amplifier: cfg.healthAmp - 1,
        showParticles: false,
      });
    }
    if (cfg.strengthAmp > 0) {
      entity.addEffect("strength", C.EFFECT_DURATION, {
        amplifier: cfg.strengthAmp - 1,
        showParticles: false,
      });
    }
    if (cfg.particle) {
      entity.dimension.spawnParticle("minecraft:enchanting_table_particle", {
        x: entity.location.x,
        y: entity.location.y + 1,
        z: entity.location.z,
      });
    }
  } catch (e) {
    console.error("[ARISE] Erro ao aplicar tier de companheiro: " + e);
  }
}

function tryTame(entity, player) {
  try {
    const tameable = entity.getComponent("minecraft:tameable");
    if (tameable && typeof tameable.tame === "function") {
      tameable.tame(player);
      return true;
    }
  } catch (e) {
    console.error("[ARISE] Erro ao domar companheiro: " + e);
  }
  return false;
}

function recruit(player, target, tier, itemType) {
  if (!isValidEntity(player) || !isValidEntity(target)) return;
  if (!C.ELIGIBLE.includes(target.typeId)) {
    player.sendMessage(MSG + "§cEste selo só aceita lobo ou gato nesta subfase.");
    return;
  }
  if (target.hasTag(C.TAG)) {
    player.sendMessage(MSG + "§7Esta criatura já possui um vínculo ativo.");
    return;
  }

  const stats = getStats(player);
  if (stats.mana < C.RECRUIT_COST) {
    player.sendMessage(MSG + `§cMana insuficiente para selar vínculo. Custo: ${C.RECRUIT_COST}.`);
    return;
  }
  if (!consumeMainhand(player, itemType)) return;
  if (!spendMana(player, C.RECRUIT_COST)) {
    refundSeal(player, itemType);
    player.sendMessage(MSG + "§cMana insuficiente para selar vínculo.");
    return;
  }

  const cid = `${Date.now().toString(36)}_${Math.floor(Math.random() * 100000).toString(36)}`;
  const entry = { cid, typeId: target.typeId, tier };
  try {
    target.addTag(C.TAG);
    target.addTag(ownerTag(player));
    target.addTag(cidTag(cid));
    target.nameTag = companionName(tier, target.typeId);
    target.setDynamicProperty(`${NS}:companion_owner`, player.id);
    target.setDynamicProperty(`${NS}:companion_tier`, tier);
    target.setDynamicProperty(`${NS}:companion_cid`, cid);
    tryTame(target, player);
    applyTier(target, tier);

    const list = readRegistry(player);
    list.push(entry);
    writeRegistry(player, list);

    target.dimension.spawnParticle("minecraft:totem_particle", {
      x: target.location.x,
      y: target.location.y + 1,
      z: target.location.z,
    });
    player.playSound("beacon.activate", { volume: 0.5 });
    player.sendMessage(MSG + `§aVínculo selado: ${target.nameTag}§a.`);
  } catch (e) {
    console.error("[ARISE] Erro ao recrutar companheiro: " + e);
  }
}

function dismiss(player, entry, entity, reason) {
  try {
    if (isValidEntity(entity)) {
      try {
        entity.dimension.spawnParticle("minecraft:basic_smoke_particle", {
          x: entity.location.x,
          y: entity.location.y + 0.8,
          z: entity.location.z,
        });
      } catch {
        // Partícula é cosmética.
      }
      entity.remove();
    }
    player.sendMessage(MSG + reason);
  } catch (e) {
    console.error("[ARISE] Erro ao dispensar companheiro: " + e);
  }
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function maintainFollow(player, entity) {
  if (player.dimension.id !== entity.dimension.id ||
      distance(player.location, entity.location) > C.FOLLOW_TELEPORT_DIST) {
    entity.teleport({
      x: player.location.x + 1,
      y: player.location.y,
      z: player.location.z + 1,
    }, { dimension: player.dimension });
  }
}

function reconcile(player) {
  const list = readRegistry(player);
  if (list.length === 0) return list;
  const kept = [];
  for (const entry of list) {
    const entity = findCompanion(player, entry);
    if (!entity) continue;
    kept.push(entry);
    try {
      entity.addTag(C.TAG);
      entity.addTag(ownerTag(player));
      entity.addTag(cidTag(entry.cid));
      entity.nameTag = companionName(entry.tier, entry.typeId);
      tryTame(entity, player);
      applyTier(entity, entry.tier);
    } catch (e) {
      console.error("[ARISE] Erro ao reconciliar companheiro: " + e);
    }
  }
  if (kept.length !== list.length) writeRegistry(player, kept);
  return kept;
}

export function tickCompanions(player, ciclo) {
  try {
    let list = readRegistry(player);
    if (list.length === 0) return;

    const kept = [];
    for (const entry of list) {
      const cfg = C.TIERS[entry.tier];
      if (!cfg) continue;
      const entity = findCompanion(player, entry);
      if (!entity) continue;

      if (!spendMana(player, cfg.drain)) {
        dismiss(player, entry, entity, `§cSem mana para manter ${entity.nameTag || "companheiro"}.`);
        continue;
      }

      applyTier(entity, entry.tier);
      if (ciclo % C.FOLLOW_CHECK_EVERY === 0) maintainFollow(player, entity);
      kept.push(entry);
    }
    if (kept.length !== list.length) writeRegistry(player, kept);
  } catch (e) {
    console.error("[ARISE] Erro em tickCompanions: " + e);
  }
}

export function initCompanions() {
  const signal = world.afterEvents.playerInteractWithEntity ?? world.beforeEvents.playerInteractWithEntity;
  if (signal?.subscribe) {
    signal.subscribe((ev) => {
      try {
        const player = ev.player;
        const target = ev.target;
        const itemType = ev.itemStack?.typeId;
        const tier = tierForItem(itemType);
        if (!tier) return;
        system.run(() => {
          try {
            recruit(player, target, tier, itemType);
          } catch (e) {
            console.error("[ARISE] Erro em interação de companheiro: " + e);
          }
        });
      } catch (e) {
        console.error("[ARISE] Erro em playerInteractWithEntity(companions): " + e);
      }
    });
  } else {
    console.error("[ARISE] Evento playerInteractWithEntity indisponível; companheiros não podem ser recrutados.");
  }

  world.afterEvents.playerSpawn.subscribe((ev) => {
    try {
      if (!ev.initialSpawn) return;
      system.runTimeout(() => {
        try {
          reconcile(ev.player);
        } catch (e) {
          console.error("[ARISE] Erro em relog de companheiros: " + e);
        }
      }, 20);
    } catch (e) {
      console.error("[ARISE] Erro em playerSpawn(companions): " + e);
    }
  });
}
