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
    GATE_KEYS: {
      E: "arise:gate_key_e",
    },
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

  // --- Missão diária ---
  DAILY: {
    // metas: base + nivel * fator
    KILL_BASE: 8, KILL_PER_LEVEL: 0.8,
    MINE_BASE: 20, MINE_PER_LEVEL: 2,
    RUN_BASE: 300, RUN_PER_LEVEL: 20,
    REWARD_XP_PCT: 0.35, // % do XP do nível atual como recompensa
    KEY_CHANCE: 0.4,     // chance de ganhar Chave de Portal (Rank E)
    RUN_SAMPLE_EVERY: 2,   // ciclos do MAIN entre amostras de distância (20 ticks)
    DAY_CHECK_EVERY: 120,  // ciclos do MAIN entre checagens de virada de dia (60 s)
  },

  // --- Zona de Penalidade ---
  PENALTY: {
    X: 100000, Y: 120, Z: 100000, // centro da arena (overworld remoto)
    RADIUS: 10,                   // metade do lado da arena
    WALL_HEIGHT: 5,
    DURATION_MS: 4 * 60 * 1000,   // 4 minutos de sobrevivência
    SPAWN_EVERY_MS: 15000,
    SPAWN_COUNT: 2,
    MAX_MOBS: 6,
    MOBS: ["minecraft:zombie", "minecraft:skeleton", "minecraft:spider"],
    TAG: "arise_pz",
  },

  // --- Devorar (predação) ---
  DEVOUR: {
    UNLOCK_LEVEL: 3,   // nível para desbloquear a skill
    CHANCE: 0.45,      // chance base de absorver essência no abate
    MANA_COST: 5,      // custo por absorção
  },

  // Nomes de exibição (PT-BR) das essências por mob
  MOB_NAMES: {
    zombie: "Zumbi", husk: "Zumbi-Múmia", drowned: "Afogado",
    zombie_villager: "Aldeão Zumbi", skeleton: "Esqueleto", stray: "Esqueleto Gélido",
    bogged: "Esqueleto do Brejo", creeper: "Creeper", spider: "Aranha",
    cave_spider: "Aranha das Cavernas", blaze: "Blaze", magma_cube: "Cubo de Magma",
    enderman: "Enderman", witch: "Bruxa", slime: "Slime", phantom: "Phantom",
    pillager: "Saqueador", vindicator: "Vingador", evocation_illager: "Invocador",
    ghast: "Ghast", wither_skeleton: "Esqueleto Wither", guardian: "Guardião",
  },

  // --- Traços (desbloqueados por fragmentos de essência) ---
  // sources: chaves de essência que contam para o traço
  TRAITS: [
    {
      id: "pele_ignea", nome: "Pele Ígnea",
      desc: "Imunidade ao fogo e à lava",
      sources: ["blaze", "magma_cube"], need: 8,
    },
    {
      id: "sangue_frio", nome: "Sangue Frio",
      desc: "Imunidade a veneno",
      sources: ["spider", "cave_spider"], need: 10,
    },
    {
      id: "pele_estavel", nome: "Pele Estável",
      desc: "Reduz pela metade o dano de explosões",
      sources: ["creeper"], need: 12,
    },
    {
      id: "olho_certeiro", nome: "Olho Certeiro",
      desc: "Flechas causam dano extra",
      sources: ["skeleton", "stray", "bogged"], need: 12,
    },
    {
      id: "vigor_sombrio", nome: "Vigor Sombrio",
      desc: "Regenera quando estiver quase morrendo",
      sources: ["zombie", "husk", "drowned", "zombie_villager"], need: 12,
    },
  ],
  TRAIT_EXPLOSION_HEAL_PCT: 0.5, // Pele Estável: % do dano devolvido como cura
  TRAIT_PROJECTILE_BONUS: 3,     // Olho Certeiro: dano extra por flecha
  TRAIT_REGEN_HP_PCT: 0.35,      // Vigor Sombrio: ativa abaixo de 35% da vida

  // --- Evolução de espécie ---
  SPECIES: {
    despertado: { nome: "Despertado", cor: "§7" },
    predador:   { nome: "Predador",   cor: "§5" },
    sabio:      { nome: "Sábio",      cor: "§b" },
  },
  // Bônus por espécie (aplicados via hooks no stats.js)
  SPECIES_BONUS: {
    predador: { devourChance: 0.15, strengthAmp: 1, xpMult: 1.0, manaMult: 1.0, manaRegenMult: 1.0 },
    sabio:    { devourChance: 0.0,  strengthAmp: 0, xpMult: 1.1, manaMult: 1.5, manaRegenMult: 1.5 },
  },
  // Requisitos: nível mínimo + total de fragmentos de essência
  EVOLUTIONS: [
    { from: "despertado", to: "predador", level: 10, essences: 20,
      desc: "+15% chance de Devorar, +1 de Força efetiva" },
    { from: "despertado", to: "sabio", level: 10, essences: 20,
      desc: "+50% de mana máxima e regeneração, +10% de XP" },
  ],

  // Mensagens do Sistema
  MESSAGES: {
    AWAKENING_TITLE: "§b[ SISTEMA ]",
    AWAKENING_SUBTITLE: "§fVocê foi §ddespertado§f.",
    SYSTEM_PREFIX: "§b[Sistema]§r ",
  },
};
