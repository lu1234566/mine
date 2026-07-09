// ============================================================
// ARISE — bladeLootTest.js
// Teste temporário: gera uma Adaga Sombria como se viesse de loot,
// já com Afiação IV, para validar slot "none" no Android.
// Acione no jogo: /scriptevent arise:debug_blade_loot
// ============================================================

import {
  system,
  ItemStack,
  EnchantmentTypes,
} from "@minecraft/server";
import { CONFIG } from "../config.js";

const EVENT_ID = `${CONFIG.NAMESPACE}:debug_blade_loot`;
const MSG = CONFIG.MESSAGES.SYSTEM_PREFIX;

function giveOrDrop(player, item) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv || inv.emptySlotsCount === 0) {
    player.dimension.spawnItem(item, player.location);
    return;
  }
  inv.addItem(item);
}

function makeSharpnessBlade(player) {
  const item = new ItemStack(CONFIG.ITEMS.BLADES.SHADOW, 1);
  const ench = item.getComponent("minecraft:enchantable");
  if (!ench) {
    player.sendMessage(MSG + "§cTeste falhou: a adaga nao tem componente minecraft:enchantable.");
    return undefined;
  }

  const sharpness = EnchantmentTypes.get("sharpness") ?? EnchantmentTypes.get("minecraft:sharpness");
  if (!sharpness) {
    player.sendMessage(MSG + "§cTeste falhou: encantamento Afiação nao existe neste runtime.");
    return undefined;
  }

  const enchantment = { type: sharpness, level: 4 };
  const canAdd = ench.canAddEnchantment(enchantment);
  if (!canAdd) {
    player.sendMessage(MSG + "§cTeste falhou: slot none recusou Afiação IV por API de loot/script.");
    player.sendMessage(MSG + "§7A solução precisa mudar antes das Subfases 2/3.");
    return undefined;
  }

  ench.addEnchantment(enchantment);
  item.setLore([
    "§8Teste temporario ARISE",
    "§7Gerada por /scriptevent como loot encantado.",
    "§7Validar mesa/bigorna: player nao deve conseguir encantar.",
  ]);
  return item;
}

export function initBladeLootTest() {
  if (!system.afterEvents.scriptEventReceive?.subscribe) {
    console.warn("[ARISE] /scriptevent indisponivel; teste temporario de adaga encantada desativado.");
    return;
  }

  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    try {
      if (ev.id !== EVENT_ID) return;
      const player = ev.sourceEntity;
      if (!player || player.typeId !== "minecraft:player") return;

      const item = makeSharpnessBlade(player);
      if (!item) return;

      giveOrDrop(player, item);
      player.sendMessage(MSG + "§aAdaga Sombria de teste entregue com Afiação IV.");
      player.sendMessage(MSG + "§7Agora teste: ela deve estar encantada, mas mesa/bigorna nao devem encantar a adaga base.");
    } catch (e) {
      console.error("[ARISE] Erro em scriptEvent(debug_blade_loot): " + e);
      const player = ev.sourceEntity;
      if (player?.typeId === "minecraft:player") {
        player.sendMessage(MSG + "§cErro no teste de adaga encantada. Veja o Content Log.");
      }
    }
  });
}
