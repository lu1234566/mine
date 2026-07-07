// ============================================================
// ARISE — main.js (Fase 1: esqueleto)
// Responsabilidades desta fase:
//   1. Confirmar que o pack de script carregou (log + mensagem).
//   2. Detectar primeiro login do jogador e exibir o "despertar".
//   3. Estabelecer o loop principal (vazio por enquanto, será
//      preenchido nas fases seguintes).
// ============================================================

import { world, system } from "@minecraft/server";
import { CONFIG } from "./config.js";

const NS = CONFIG.NAMESPACE;
// Chave de dynamic property que marca que o jogador já despertou
const DP_AWAKENED = `${NS}:awakened`;

// ------------------------------------------------------------
// Log de inicialização — visível no Log de Conteúdo (Content Log)
// ------------------------------------------------------------
console.log("[ARISE] Script carregado com sucesso. Fase 1 ativa.");

// ------------------------------------------------------------
// Despertar: roda quando o jogador entra e o spawn é concluído
// ------------------------------------------------------------
world.afterEvents.playerSpawn.subscribe((ev) => {
  try {
    if (!ev.initialSpawn) return; // ignora respawns após morte
    const player = ev.player;

    const jaDespertou = player.getDynamicProperty(DP_AWAKENED) === true;

    if (!jaDespertou) {
      // Primeiro login neste mundo: sequência de despertar
      player.setDynamicProperty(DP_AWAKENED, true);

      // Pequeno atraso para garantir que o cliente já renderizou o HUD
      system.runTimeout(() => {
        try {
          // O jogador pode ter saído do mundo durante o atraso
          if (!player.isValid()) return;
          player.onScreenDisplay.setTitle(CONFIG.MESSAGES.AWAKENING_TITLE, {
            subtitle: CONFIG.MESSAGES.AWAKENING_SUBTITLE,
            fadeInDuration: 10,
            stayDuration: 60,
            fadeOutDuration: 20,
          });
          player.playSound("beacon.activate");
          player.sendMessage(
            CONFIG.MESSAGES.SYSTEM_PREFIX +
              "§fBem-vindo, §d" + player.name + "§f. Sua jornada começa agora."
          );
        } catch (e) {
          console.error("[ARISE] Erro na sequência de despertar: " + e);
        }
      }, 40); // ~2 segundos após o spawn
    } else {
      // Login recorrente: saudação curta
      player.sendMessage(
        CONFIG.MESSAGES.SYSTEM_PREFIX + "§7Sistema online. Fase 1 (esqueleto)."
      );
    }
  } catch (e) {
    console.error("[ARISE] Erro em playerSpawn: " + e);
  }
});

// ------------------------------------------------------------
// Loop principal — placeholder da Fase 1.
// Nas próximas fases: HUD (actionbar), regen de mana, timers de
// missão diária, manutenção de sombras.
// ------------------------------------------------------------
system.runInterval(() => {
  try {
    // Fase 2 preencherá este loop.
  } catch (e) {
    console.error("[ARISE] Erro no loop principal: " + e);
  }
}, CONFIG.TICK_INTERVAL);
