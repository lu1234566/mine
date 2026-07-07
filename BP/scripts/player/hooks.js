// ============================================================
// ARISE — hooks.js
// Registro de modificadores entre módulos, para evitar imports
// circulares. Fases futuras (evolução, traços) registram funções
// aqui e o stats.js as aplica sem conhecer quem registrou.
// Cada hook recebe (player, valorBase) e retorna o novo valor.
// ============================================================

export const HOOKS = {
  xpMult: [],        // multiplicadores de ganho de XP
  manaMaxMult: [],   // multiplicadores de mana máxima
  manaRegenMult: [], // multiplicadores de regeneração de mana
  strengthAmpBonus: [], // bônus plano no amplificador de Força
  devourChanceBonus: [], // bônus plano na chance de Devorar (Fase 4)
  shadowCapBonus: [],    // bônus plano no limite de sombras (Fase 5)
};

// Aplica uma lista de hooks em sequência sobre o valor base
export function applyHooks(list, player, base) {
  let value = base;
  for (const fn of list) {
    try {
      value = fn(player, value);
    } catch (e) {
      console.error("[ARISE] Erro em hook: " + e);
    }
  }
  return value;
}
