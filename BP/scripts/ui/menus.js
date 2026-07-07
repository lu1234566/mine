// ============================================================
// ARISE — menus.js
// Menu principal do Sistema (ActionFormData, server-ui estável).
// Outros módulos registram seções e provedores de resumo aqui;
// este arquivo não importa nenhum módulo de gameplay (evita
// dependência circular).
// ============================================================

import { world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { CONFIG } from "../config.js";

// { id, label, icon?, visible?(player) -> bool, open(player) }
const sections = [];
// (player) -> string exibida no corpo do menu principal
const summaryProviders = [];

export function registerMenuSection(section) {
  sections.push(section);
}

export function registerSummaryProvider(fn) {
  summaryProviders.push(fn);
}

export async function openMainMenu(player) {
  try {
    const form = new ActionFormData().title("§b[ SISTEMA ]");
    const body = summaryProviders
      .map((fn) => {
        try { return fn(player); } catch { return ""; }
      })
      .filter((t) => t.length > 0)
      .join("\n\n");
    form.body(body.length > 0 ? body : "§7...");

    const visible = sections.filter((s) => !s.visible || s.visible(player));
    for (const s of visible) form.button(s.label, s.icon);
    form.button("§8Fechar");

    const r = await form.show(player);
    if (r.canceled || r.selection === undefined || r.selection >= visible.length) return;
    await visible[r.selection].open(player);
  } catch (e) {
    console.error("[ARISE] Erro em openMainMenu: " + e);
  }
}

// Abre o menu ao usar o Núcleo do Sistema
export function initMenus() {
  world.afterEvents.itemUse.subscribe((ev) => {
    try {
      if (ev.itemStack?.typeId === CONFIG.ITEMS.SYSTEM_CORE) {
        openMainMenu(ev.source);
      }
    } catch (e) {
      console.error("[ARISE] Erro em itemUse(menu): " + e);
    }
  });
}
