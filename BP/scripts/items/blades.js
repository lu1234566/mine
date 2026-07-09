// ============================================================
// ARISE — blades.js
// Adagas sombrias: armas encantáveis com bônus furtivo.
// Limitação estável 1.21.0: velocidade de ataque declarativa
// via minecraft:cooldown type=attack exige formato 1.21.130.
// ============================================================

import { world, system, EquipmentSlot, EntityDamageCause } from "@minecraft/server";
import { CONFIG } from "../config.js";

const B = CONFIG.BLADES;
const IDS = new Set(Object.values(CONFIG.ITEMS.BLADES));
const ultimoGolpe = new Map();

function getBladeConfig(typeId) {
  return B.VARIANTS[typeId] ?? B.DEFAULT;
}

function mainhandBlade(player) {
  const eq = player.getComponent("minecraft:equippable");
  const item = eq?.getEquipment(EquipmentSlot.Mainhand);
  if (!item || !IDS.has(item.typeId)) return undefined;
  return item;
}

function stealthKey(player, target) {
  return `${player.id}:${target.id}`;
}

function canApplyStealth(player, target, cooldownTicks) {
  const key = stealthKey(player, target);
  const now = systemCurrentTick();
  const last = ultimoGolpe.get(key) ?? -999999;
  if (now - last < cooldownTicks) return false;
  ultimoGolpe.set(key, now);
  return true;
}

function systemCurrentTick() {
  // system.currentTick existe nas versões estáveis recentes; Date.now
  // mantém o handler funcional se o runtime expuser apenas relógio real.
  return system.currentTick ?? Math.floor(Date.now() / 50);
}

function isSneaking(player) {
  return player.isSneaking === true;
}

function applyStealthBonus(player, target, item) {
  const cfg = getBladeConfig(item.typeId);
  const extra = Math.max(1, Math.round(cfg.damage * (cfg.stealthMultiplier - 1)));
  if (!canApplyStealth(player, target, B.DEFAULT.stealthCooldownTicks)) return;
  target.applyDamage(extra, {
    cause: EntityDamageCause.entityAttack,
    damagingEntity: player,
  });
  try {
    player.onScreenDisplay.setActionBar(`§8Golpe furtivo: §c+${extra}§7 dano`);
    player.playSound("mob.endermen.portal", { pitch: 1.7, volume: 0.25 });
  } catch (e) {
    console.error("[ARISE] Erro no feedback de golpe furtivo: " + e);
  }
}

function handleBladeHit(player, target) {
  if (!player || player.typeId !== "minecraft:player") return;
  if (!target || target.typeId === "minecraft:player") return;
  const item = mainhandBlade(player);
  if (!item) return;

  // Proxy estável para "golpe pelas costas": o jogador precisa
  // estar agachado no momento do acerto.
  if (!isSneaking(player)) return;
  applyStealthBonus(player, target, item);
}

export function initBlades() {
  if (world.afterEvents.entityHitEntity?.subscribe) {
    world.afterEvents.entityHitEntity.subscribe((ev) => {
      try {
        handleBladeHit(ev.damagingEntity, ev.hitEntity);
      } catch (e) {
        console.error("[ARISE] Erro em entityHitEntity(blades): " + e);
      }
    });
    return;
  }

  world.afterEvents.entityHurt.subscribe((ev) => {
    try {
      handleBladeHit(ev.damageSource?.damagingEntity, ev.hurtEntity);
    } catch (e) {
      console.error("[ARISE] Erro em entityHurt(blades): " + e);
    }
  });
}
