// ============================================================
// ARISE — config.js
// TODAS as constantes de balanceamento vivem aqui.
// Nenhum número mágico deve existir fora deste arquivo.
// ============================================================

export const CONFIG = {
  // Identidade do add-on (prefixo de dynamic properties, tags, entidades)
  NAMESPACE: "arise",

  // Intervalo (em ticks) do loop principal de HUD/regeneração.
  // 20 ticks = 1 segundo. Console é o alvo: nunca reduzir para 1.
  TICK_INTERVAL: 10,

  // --- Curva de XP (Fase 2) ---
  XP: {
    BASE: 50,          // XP para ir do nível 1 ao 2
    EXPONENT: 1.6,     // curva exponencial suave
    MAX_LEVEL: 100,
  },

  // Pontos de atributo ganhos por nível (Fase 2)
  POINTS_PER_LEVEL: 3,

  // --- Mana (Fase 2) ---
  MANA: {
    BASE: 20,
    PER_POINT: 5,      // mana máx. extra por ponto em Mana
    REGEN_PER_TICK_LOOP: 1, // regen a cada ciclo do TICK_INTERVAL
  },

  // Mensagens do Sistema (Fase 1 usa apenas AWAKENING)
  MESSAGES: {
    AWAKENING_TITLE: "§b[ SISTEMA ]",
    AWAKENING_SUBTITLE: "§fVocê foi §ddespertado§f.",
    SYSTEM_PREFIX: "§b[Sistema]§r ",
  },
};
