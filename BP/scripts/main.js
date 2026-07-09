// ============================================================
// ARISE — main.js (bootstrap)
// Registra os módulos e mantém UM único loop principal.
// Fase atual: 2 (stats). Fases seguintes se conectam aqui.
// ============================================================

import { world, system } from "@minecraft/server";
import { CONFIG } from "./config.js";
import { initStats, tickHud, tickEffects, ensureSystemCore } from "./player/stats.js";
import { initDailyQuest, tickDaily } from "./player/dailyQuest.js";
import { initClasses } from "./player/classes.js";
import { initSkills } from "./skills/skillRegistry.js";
import { initDevour, tickTraits } from "./skills/devour.js";
import { initActiveSkills, ensureGrimoire } from "./skills/activeSkills.js";
import { initShadows, tickShadows } from "./skills/shadowArmy.js";
import { initGates, tickGates } from "./dungeons/gates.js";
import { initBreaks, tickBreaks } from "./dungeons/breaks.js";
import { initBlades } from "./items/blades.js";
import { initDungeons, tickDungeons } from "./world/dungeons.js";
import { initMenus } from "./ui/menus.js";

const NS = CONFIG.NAMESPACE;
const DP_AWAKENED = `${NS}:awakened`;

// ------------------------------------------------------------
// Log de inicialização — visível no Log de Conteúdo (Content Log)
// ------------------------------------------------------------
console.log("[ARISE] Script carregado. Fase 8C (fusão) ativa.");

// A ordem define a ordem das seções no menu principal
initMenus();
initStats();
initDailyQuest();
initSkills();
initDevour();
initActiveSkills();
initShadows();
initClasses();
initGates();
initBreaks();
initBlades();
initDungeons();

// ------------------------------------------------------------
// Entrada do jogador: despertar (1ª vez) + entrega do Núcleo
// ------------------------------------------------------------
world.afterEvents.playerSpawn.subscribe((ev) => {
  try {
    if (!ev.initialSpawn) return; // ignora respawns após morte
    const player = ev.player;

    ensureSystemCore(player);
    ensureGrimoire(player);

    const jaDespertou = player.getDynamicProperty(DP_AWAKENED) === true;
    if (!jaDespertou) {
      player.setDynamicProperty(DP_AWAKENED, true);
      // Pequeno atraso para garantir que o cliente já renderizou o HUD
      system.runTimeout(() => {
        try {
          if (!player.isValid()) return; // jogador pode ter saído no atraso
          player.onScreenDisplay.setTitle(CONFIG.MESSAGES.AWAKENING_TITLE, {
            subtitle: CONFIG.MESSAGES.AWAKENING_SUBTITLE,
            fadeInDuration: 10,
            stayDuration: 60,
            fadeOutDuration: 20,
          });
          player.playSound("beacon.activate");
          player.sendMessage(
            CONFIG.MESSAGES.SYSTEM_PREFIX +
              "§fBem-vindo, §d" + player.name +
              "§f. Toque o §dNúcleo do Sistema§f no inventário para abrir o menu."
          );
        } catch (e) {
          console.error("[ARISE] Erro na sequência de despertar: " + e);
        }
      }, 40);
    } else {
      player.sendMessage(CONFIG.MESSAGES.SYSTEM_PREFIX + "§7Sistema online.");
      // Reaplica os efeitos de atributo sem esperar o loop lento
      tickEffects(player);
    }
  } catch (e) {
    console.error("[ARISE] Erro em playerSpawn: " + e);
  }
});

// ------------------------------------------------------------
// Loop principal — ÚNICO runInterval do add-on.
// A cada MAIN ticks: HUD + mana. A cada EFFECTS_EVERY ciclos:
// reaplicação dos efeitos de atributo.
// ------------------------------------------------------------
let ciclo = 0;
system.runInterval(() => {
  try {
    ciclo++;
    const players = world.getAllPlayers();
    for (const p of players) {
      try {
        // tickDaily (penalidade) e tickBreaks (ruptura) retornam true
        // quando exibem HUD própria — o HUD de stats cede a vez
        const emPenalidade = tickDaily(p, ciclo);
        const emRuptura = tickBreaks(p, ciclo);
        if (!emPenalidade && !emRuptura) tickHud(p);
        tickShadows(p, ciclo);
      } catch (e) {
        console.error("[ARISE] Erro em tick de jogador: " + e);
      }
    }
    tickGates(ciclo);
    tickDungeons(ciclo);
    if (ciclo % CONFIG.INTERVALS.EFFECTS_EVERY === 0) {
      for (const p of players) {
        try {
          tickEffects(p);
          tickTraits(p);
        } catch (e) {
          console.error("[ARISE] Erro em tickEffects: " + e);
        }
      }
    }
  } catch (e) {
    console.error("[ARISE] Erro no loop principal: " + e);
  }
}, CONFIG.INTERVALS.MAIN);
