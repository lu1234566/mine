// ============================================================
// ARISE — skillRegistry.js
// Registro central de habilidades. Cada skill declara como
// aparece no menu "Habilidades" e o que acontece ao tocá-la.
// skill = {
//   id, nome,
//   unlocked(player) -> bool,
//   requisito: string (mostrado quando bloqueada),
//   statusText?(player) -> string (ex.: "[ATIVA]"),
//   bodyText?(player) -> string (linhas extras no corpo do menu),
//   onSelect(player) -> abre submenu ou alterna toggle
// }
// ============================================================

import { ActionFormData } from "@minecraft/server-ui";
import { CONFIG } from "../config.js";
import { registerMenuSection } from "../ui/menus.js";

const skills = [];

export function registerSkill(skill) {
  skills.push(skill);
}

async function openSkillsMenu(player) {
  try {
    const form = new ActionFormData().title("§dHabilidades");
    let body = "";
    for (const s of skills) {
      if (s.bodyText) {
        const t = s.bodyText(player);
        if (t) body += t + "\n\n";
      }
    }
    form.body(body.length > 0 ? body : "§7Nenhuma habilidade ainda. Continue evoluindo.");

    const selecionaveis = [];
    for (const s of skills) {
      if (s.unlocked(player)) {
        const status = s.statusText ? " " + s.statusText(player) : "";
        form.button(`§f${s.nome}${status}`);
        selecionaveis.push(s);
      } else {
        form.button(`§8${s.nome} — ${s.requisito}`);
        selecionaveis.push(null); // bloqueada: toque não faz nada
      }
    }
    form.button("§8Voltar");

    const r = await form.show(player);
    if (r.canceled || r.selection === undefined || r.selection >= skills.length) return;
    const s = selecionaveis[r.selection];
    if (s) await s.onSelect(player);
    else player.sendMessage(CONFIG.MESSAGES.SYSTEM_PREFIX + "§7Habilidade ainda bloqueada.");
  } catch (e) {
    console.error("[ARISE] Erro em openSkillsMenu: " + e);
  }
}

export function initSkills() {
  registerMenuSection({
    id: "skills",
    label: "§dHabilidades",
    icon: "textures/items/system_core",
    visible: () => true,
    open: openSkillsMenu,
  });
}
