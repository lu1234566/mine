// ============================================================
// ARISE — config.js
// TODAS as constantes de balanceamento vivem aqui.
// Nenhum número mágico deve existir fora deste arquivo.
// ============================================================

export const CONFIG = {
  // Identidade do add-on (prefixo de dynamic properties, tags, entidades)
  NAMESPACE: "arise",

  // Identificadores de itens custom
  ITEMS: {
    SYSTEM_CORE: "arise:system_core",
  },

  // Intervalos (em ticks). Console é o alvo: nunca reduzir MAIN para 1.
  INTERVALS: {
    MAIN: 10,          // loop principal: HUD + regen de mana (a cada 10 ticks)
    EFFECTS_EVERY: 10, // efeitos de atributo a cada N ciclos do MAIN (10x10 = 100 ticks)
  },

  // --- Curva de XP ---
  // xpParaProximoNivel = BASE * (nivel ^ EXPONENT)
  XP: {
    BASE: 50,
    EXPONENT: 1.6,
    MAX_LEVEL: 100,
    DEFAULT: 6, // XP para mobs fora da tabela
    // XP por tipo de mob (0 = sem XP, para bloquear farm abusivo)
    TABLE: {
      "minecraft:zombie": 12,
      "minecraft:husk": 13,
      "minecraft:drowned": 13,
      "minecraft:zombie_villager": 15,
      "minecraft:skeleton": 14,
      "minecraft:stray": 15,
      "minecraft:bogged": 16,
      "minecraft:creeper": 18,
      "minecraft:spider": 10,
      "minecraft:cave_spider": 14,
      "minecraft:enderman": 40,
      "minecraft:endermite": 5,
      "minecraft:silverfish": 5,
      "minecraft:witch": 35,
      "minecraft:slime": 4,
      "minecraft:magma_cube": 6,
      "minecraft:blaze": 30,
      "minecraft:ghast": 35,
      "minecraft:piglin": 15,
      "minecraft:piglin_brute": 45,
      "minecraft:zombie_pigman": 18,
      "minecraft:hoglin": 25,
      "minecraft:zoglin": 30,
      "minecraft:wither_skeleton": 35,
      "minecraft:guardian": 30,
      "minecraft:elder_guardian": 250,
      "minecraft:phantom": 20,
      "minecraft:pillager": 22,
      "minecraft:vindicator": 40,
      "minecraft:evocation_illager": 60,
      "minecraft:vex": 15,
      "minecraft:ravager": 120,
      "minecraft:shulker": 30,
      "minecraft:breeze": 30,
      "minecraft:warden": 600,
      "minecraft:wither": 1200,
      "minecraft:ender_dragon": 1800,
      // Passivos: pouco XP; aliados/aldeões: nenhum
      "minecraft:cow": 3,
      "minecraft:pig": 3,
      "minecraft:sheep": 3,
      "minecraft:chicken": 2,
      "minecraft:rabbit": 2,
      "minecraft:cod": 1,
      "minecraft:salmon": 1,
      "minecraft:squid": 2,
      "minecraft:glow_squid": 3,
      "minecraft:bat": 1,
      "minecraft:iron_golem": 0,
      "minecraft:snow_golem": 0,
      "minecraft:villager_v2": 0,
      "minecraft:villager": 0,
      "minecraft:wandering_trader": 0,
      "minecraft:allay": 0,
      "minecraft:wolf": 0,
      "minecraft:cat": 0,
    },
  },

  // Pontos de atributo ganhos por nível
  POINTS_PER_LEVEL: 3,

  // --- Atributos -> efeitos permanentes (reaplicados em loop) ---
  ATTRIBUTES: {
    // A cada N pontos, +1 de amplificador do efeito (com teto)
    STR_POINTS_PER_AMP: 3, STR_AMP_CAP: 3,   // Força -> strength
    AGI_POINTS_PER_AMP: 4, AGI_AMP_CAP: 2,   // Agilidade -> speed
    VIT_POINTS_PER_AMP: 3, VIT_AMP_CAP: 4,   // Vitalidade -> health_boost
    PER_XP_BONUS: 0.02,  // Percepção: +2% de XP por ponto
    EFFECT_DURATION: 300, // ticks; > intervalo de reaplicação (100)
  },

  // --- Mana ---
  MANA: {
    BASE: 20,
    PER_POINT: 5,       // mana máx. extra por ponto em Mana
    REGEN_PER_LOOP: 1,  // regen a cada ciclo do MAIN (10 ticks) => 2/s
  },

  // Mensagens do Sistema
  MESSAGES: {
    AWAKENING_TITLE: "§b[ SISTEMA ]",
    AWAKENING_SUBTITLE: "§fVocê foi §ddespertado§f.",
    SYSTEM_PREFIX: "§b[Sistema]§r ",
  },
};
