// ============================================================
// ARISE — dailyQuest.js
// Missão diária (ciclo de dia real via timestamp) + Zona de
// Penalidade para quem ignora a missão até o fim do dia.
// Estado persistido em dynamic properties do jogador:
//   dq_day, dq_type, dq_goal, dq_progress, dq_done,
//   pz_active, pz_until, pz_return
// ============================================================

import { world, system, BlockPermutation } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { addXp, xpForNext, giveItem } from "./stats.js";
import { registerMenuSection } from "../ui/menus.js";

const NS = CONFIG.NAMESPACE;
const D = CONFIG.DAILY;
const PZ = CONFIG.PENALTY;
const MSG = CONFIG.MESSAGES.SYSTEM_PREFIX;

// ---------- helpers de dynamic property ----------
function dp(p, key) { return p.getDynamicProperty(`${NS}:${key}`); }
function setDp(p, key, v) { p.setDynamicProperty(`${NS}:${key}`, v); }

function hoje() { return Math.floor(Date.now() / 86400000); } // dia real (UTC)

// Tipos de missão. goal() escala com o nível do jogador.
const QUEST_TYPES = {
  kill: {
    nome: "Caçada",
    desc: (goal) => `Derrote §c${goal}§7 criaturas`,
    goal: (level) => D.KILL_BASE + Math.floor(level * D.KILL_PER_LEVEL),
  },
  mine: {
    nome: "Escavação",
    desc: (goal) => `Quebre §c${goal}§7 blocos`,
    goal: (level) => D.MINE_BASE + Math.floor(level * D.MINE_PER_LEVEL),
  },
  run: {
    nome: "Percurso",
    desc: (goal) => `Percorra §c${goal}§7 metros`,
    goal: (level) => D.RUN_BASE + Math.floor(level * D.RUN_PER_LEVEL),
  },
};

// ---------- atribuição da missão do dia ----------
function assignQuest(player, level) {
  const keys = Object.keys(QUEST_TYPES);
  const type = keys[Math.floor(Math.random() * keys.length)];
  const goal = QUEST_TYPES[type].goal(level);
  setDp(player, "dq_day", hoje());
  setDp(player, "dq_type", type);
  setDp(player, "dq_goal", goal);
  setDp(player, "dq_progress", 0);
  setDp(player, "dq_done", false);
  try {
    player.onScreenDisplay.setTitle("§b[ MISSÃO DIÁRIA ]", {
      subtitle: `§f${QUEST_TYPES[type].nome}: §7${QUEST_TYPES[type].desc(goal)}`,
      fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 15,
    });
    player.playSound("random.orb");
    player.sendMessage(
      MSG + `§fMissão diária: §b${QUEST_TYPES[type].nome}§f — ` +
      QUEST_TYPES[type].desc(goal) + `§f. §cIgnorá-la tem consequências.`
    );
  } catch (e) {
    console.error("[ARISE] Erro ao anunciar missão: " + e);
  }
}

// Chamado ao entrar e a cada ~60 s. Detecta virada de dia.
function checkDay(player) {
  const stored = dp(player, "dq_day");
  const today = hoje();
  if (stored === today) return;

  const level = dp(player, "level") ?? 1;
  // Havia missão de um dia anterior não concluída -> penalidade
  if (typeof stored === "number" && dp(player, "dq_done") !== true) {
    startPenalty(player);
  }
  assignQuest(player, typeof level === "number" ? level : 1);
}

// ---------- progresso ----------
function addProgress(player, type, amount) {
  if (dp(player, "dq_done") === true) return;
  if (dp(player, "dq_type") !== type) return;
  const goal = dp(player, "dq_goal");
  if (typeof goal !== "number") return;
  const prog = Math.min(goal, (dp(player, "dq_progress") ?? 0) + amount);
  setDp(player, "dq_progress", prog);
  if (prog >= goal) completeQuest(player);
}

function completeQuest(player) {
  setDp(player, "dq_done", true);
  const level = dp(player, "level") ?? 1;
  const xp = Math.floor(xpForNext(level) * D.REWARD_XP_PCT);
  addXp(player, xp);
  let extra = "";
  if (Math.random() < D.KEY_CHANCE) {
    // rank da chave escala com o nível (primeira faixa que casar)
    const nivel = typeof level === "number" ? level : 1;
    const tier = D.KEY_TIERS.find((t) => nivel >= t.minLevel) ?? D.KEY_TIERS[D.KEY_TIERS.length - 1];
    giveItem(player, tier.key, 1);
    extra = " §fVocê recebeu uma §aChave de Portal§f!";
  }
  try {
    player.onScreenDisplay.setTitle("§a[ MISSÃO CONCLUÍDA ]", {
      subtitle: `§f+${xp} XP`,
      fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15,
    });
    player.playSound("random.levelup");
    player.sendMessage(MSG + `§aMissão diária concluída! §f+${xp} XP.` + extra);
  } catch (e) {
    console.error("[ARISE] Erro em completeQuest: " + e);
  }
}

// ---------- Zona de Penalidade ----------
// Estado runtime (não persistido): controle de spawn e construção
const pzRuntime = new Map(); // player.id -> { lastSpawn, built }

function pzCenter() {
  return { x: PZ.X + 0.5, y: PZ.Y, z: PZ.Z + 0.5 };
}

export function startPenalty(player) {
  try {
    if (dp(player, "pz_active") === true) return;
    const loc = player.location;
    setDp(player, "pz_return", JSON.stringify({
      x: loc.x, y: loc.y, z: loc.z, dim: player.dimension.id,
    }));
    setDp(player, "pz_until", Date.now() + PZ.DURATION_MS);
    setDp(player, "pz_active", true);
    pzRuntime.set(player.id, { lastSpawn: 0, built: false });

    player.onScreenDisplay.setTitle("§4[ ZONA DE PENALIDADE ]", {
      subtitle: `§cVocê ignorou o Sistema. Sobreviva ${Math.round(PZ.DURATION_MS / 60000)} minutos.`,
      fadeInDuration: 5, stayDuration: 80, fadeOutDuration: 20,
    });
    player.playSound("mob.wither.spawn");
    player.sendMessage(MSG + "§cA missão diária foi ignorada. O Sistema cobra o preço.");

    // Solta o jogador no alto da zona com queda lenta; a arena é
    // construída quando o chunk carregar (ver tickPenalty)
    const c = pzCenter();
    player.addEffect("slow_falling", 600, { amplifier: 0, showParticles: false });
    player.addEffect("resistance", 300, { amplifier: 3, showParticles: false });
    player.teleport({ x: c.x, y: c.y + 30, z: c.z }, { dimension: world.getDimension("overworld") });
  } catch (e) {
    console.error("[ARISE] Erro em startPenalty: " + e);
  }
}

function endPenalty(player, motivo) {
  try {
    setDp(player, "pz_active", false);
    setDp(player, "pz_until", undefined);
    pzRuntime.delete(player.id);
    cleanupPzMobs();

    const raw = dp(player, "pz_return");
    if (typeof raw === "string" && motivo !== "morte") {
      try {
        const r = JSON.parse(raw);
        player.teleport({ x: r.x, y: r.y, z: r.z }, { dimension: world.getDimension(r.dim) });
      } catch { /* volta pelo respawn normal */ }
    }
    if (motivo === "sobreviveu") {
      player.sendMessage(MSG + "§aVocê sobreviveu. A dívida está paga — não ignore o Sistema de novo.");
      player.playSound("random.levelup");
    } else {
      player.sendMessage(MSG + "§7O Sistema considera sua dívida paga.");
    }
  } catch (e) {
    console.error("[ARISE] Erro em endPenalty: " + e);
  }
}

function cleanupPzMobs() {
  try {
    const dim = world.getDimension("overworld");
    const c = pzCenter();
    for (const e of dim.getEntities({ tags: [PZ.TAG], location: c, maxDistance: 80 })) {
      e.remove();
    }
  } catch (e) {
    console.error("[ARISE] Erro em cleanupPzMobs: " + e);
  }
}

// Constrói a arena (plataforma + muros + teto invisível).
// Retorna false se o chunk ainda não carregou (tenta de novo depois).
function buildArena() {
  const dim = world.getDimension("overworld");
  const r = PZ.RADIUS;
  const c = pzCenter();
  try {
    const obsidian = BlockPermutation.resolve("minecraft:obsidian");
    const barrier = BlockPermutation.resolve("minecraft:barrier");
    const air = BlockPermutation.resolve("minecraft:air");
    const glow = BlockPermutation.resolve("minecraft:sea_lantern");
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const x = PZ.X + dx, z = PZ.Z + dz;
        const borda = Math.abs(dx) === r || Math.abs(dz) === r;
        // piso (com pontos de luz)
        const luz = (dx % 4 === 0 && dz % 4 === 0) && !borda;
        dim.getBlock({ x, y: PZ.Y - 1, z })?.setPermutation(luz ? glow : obsidian);
        for (let dy = 0; dy < PZ.WALL_HEIGHT; dy++) {
          dim.getBlock({ x, y: PZ.Y + dy, z })?.setPermutation(borda ? obsidian : air);
        }
        // teto invisível (anti-torre)
        dim.getBlock({ x, y: PZ.Y + PZ.WALL_HEIGHT, z })?.setPermutation(barrier);
      }
    }
    return true;
  } catch {
    return false; // chunk ainda não carregado
  }
}

// Chamado a cada ciclo MAIN para jogadores com penalidade ativa
function tickPenalty(player) {
  const until = dp(player, "pz_until");
  if (typeof until !== "number") {
    setDp(player, "pz_active", false);
    return;
  }
  let rt = pzRuntime.get(player.id);
  if (!rt) { rt = { lastSpawn: 0, built: false }; pzRuntime.set(player.id, rt); }

  const dim = world.getDimension("overworld");
  const c = pzCenter();

  // 1) constrói a arena quando o chunk carregar e posiciona o jogador
  if (!rt.built) {
    if (buildArena()) {
      rt.built = true;
      player.teleport(c, { dimension: dim });
      player.sendMessage(MSG + "§cSobreviva. O tempo está correndo.");
    }
    return;
  }

  // 2) tempo esgotado -> liberdade
  if (Date.now() >= until) {
    endPenalty(player, "sobreviveu");
    return;
  }

  // 3) anti-fuga: se saiu da arena, volta para o centro
  const l = player.location;
  if (player.dimension.id !== dim.id ||
      Math.abs(l.x - c.x) > PZ.RADIUS + 2 || Math.abs(l.z - c.z) > PZ.RADIUS + 2 ||
      Math.abs(l.y - c.y) > PZ.WALL_HEIGHT + 4) {
    player.teleport(c, { dimension: dim });
  }

  // 4) HUD do tempo restante (sobrepõe o HUD de stats — intencional)
  const restam = Math.ceil((until - Date.now()) / 1000);
  player.onScreenDisplay.setActionBar(
    `§4☠ ZONA DE PENALIDADE §8| §fSobreviva mais §c${Math.floor(restam / 60)}m${restam % 60}s`
  );

  // 5) ondas de inimigos
  if (Date.now() - rt.lastSpawn >= PZ.SPAWN_EVERY_MS) {
    rt.lastSpawn = Date.now();
    try {
      const atuais = dim.getEntities({ tags: [PZ.TAG], location: c, maxDistance: 40 }).length;
      for (let i = 0; i < PZ.SPAWN_COUNT && atuais + i < PZ.MAX_MOBS; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 3 + Math.random() * (PZ.RADIUS - 4);
        const mob = dim.spawnEntity(PZ.MOBS[Math.floor(Math.random() * PZ.MOBS.length)], {
          x: c.x + Math.cos(ang) * dist, y: c.y, z: c.z + Math.sin(ang) * dist,
        });
        mob.addTag(PZ.TAG);
      }
    } catch (e) {
      console.error("[ARISE] Erro ao spawnar na penalidade: " + e);
    }
  }
}

// ---------- rastreio de distância (missão "Percurso") ----------
const lastPos = new Map(); // player.id -> {x, z, dim}

function tickRun(player) {
  const l = player.location;
  const prev = lastPos.get(player.id);
  lastPos.set(player.id, { x: l.x, z: l.z, dim: player.dimension.id });
  if (!prev || prev.dim !== player.dimension.id) return;
  const d = Math.hypot(l.x - prev.x, l.z - prev.z);
  // ignora teleportes (mais de 30 blocos em 1s)
  if (d > 0.5 && d < 30) addProgress(player, "run", Math.round(d));
}

// ---------- ticks exportados (chamados pelo main.js) ----------
// ciclo: contador do loop principal (a cada CONFIG.INTERVALS.MAIN ticks)
export function tickDaily(player, ciclo) {
  if (dp(player, "pz_active") === true) {
    tickPenalty(player);
    return true; // avisa o main.js que o HUD normal deve ser suprimido
  }
  if (ciclo % D.RUN_SAMPLE_EVERY === 0) tickRun(player);
  if (ciclo % D.DAY_CHECK_EVERY === 0) checkDay(player);
  return false;
}

// ---------- registro ----------
export function initDailyQuest() {
  // progresso de caçada
  world.afterEvents.entityDie.subscribe((ev) => {
    try {
      const killer = ev.damageSource?.damagingEntity;
      if (!killer || killer.typeId !== "minecraft:player") return;
      if (ev.deadEntity?.typeId === "minecraft:player") return;
      addProgress(killer, "kill", 1);
    } catch (e) {
      console.error("[ARISE] Erro em entityDie(daily): " + e);
    }
  });

  // progresso de escavação
  world.afterEvents.playerBreakBlock.subscribe((ev) => {
    try {
      addProgress(ev.player, "mine", 1);
    } catch (e) {
      console.error("[ARISE] Erro em playerBreakBlock(daily): " + e);
    }
  });

  // retomada/encerramento da penalidade em spawn
  world.afterEvents.playerSpawn.subscribe((ev) => {
    try {
      const p = ev.player;
      if (dp(p, "pz_active") !== true) {
        if (ev.initialSpawn) checkDay(p);
        return;
      }
      const until = dp(p, "pz_until");
      if (!ev.initialSpawn) {
        // morreu dentro da zona: o Sistema perdoa
        endPenalty(p, "morte");
      } else if (typeof until === "number" && Date.now() >= until) {
        endPenalty(p, "sobreviveu");
      } else {
        // reconectou no meio da pena: recomeça o posicionamento
        pzRuntime.set(p.id, { lastSpawn: 0, built: false });
      }
    } catch (e) {
      console.error("[ARISE] Erro em playerSpawn(penalidade): " + e);
    }
  });

  // seção no menu principal
  registerMenuSection({
    id: "daily",
    label: "§bMissão Diária",
    icon: "textures/items/chave_portal_e",
    visible: () => true,
    open: async (player) => {
      const type = dp(player, "dq_type");
      const q = QUEST_TYPES[type];
      if (!q) {
        player.sendMessage(MSG + "§7Nenhuma missão ativa. Aguarde o próximo dia.");
        return;
      }
      const goal = dp(player, "dq_goal") ?? 0;
      const prog = dp(player, "dq_progress") ?? 0;
      const done = dp(player, "dq_done") === true;
      const msAteVirada = 86400000 - (Date.now() % 86400000);
      const horas = Math.floor(msAteVirada / 3600000);
      const mins = Math.floor((msAteVirada % 3600000) / 60000);
      player.sendMessage(
        MSG + `§b${q.nome}§f — §7${q.desc(goal)}\n` +
        (done
          ? MSG + "§aConcluída! Recompensa já entregue."
          : MSG + `§fProgresso: §e${prog}§7/${goal} §8— §7prazo: §c${horas}h${mins}m`)
      );
    },
  });
}
