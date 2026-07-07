# ARISE — Checklists de teste manual (Android)

Rode os passos da fase mais recente antes de atualizar o mundo de verdade.
Sempre com **Log de Conteúdo ativado** (Configurações → Criador → GUI e arquivo).
Nenhuma fase exige toggle experimental — se o jogo pedir, é bug: reporte.

---

## Fase 1 — Esqueleto

1. Importar `ARISE.mcaddon` → os dois packs aparecem em "Meus Packs" com ícone (seta ciano = BP, roxa = RP) e nome em PT-BR.
2. Criar mundo novo, ativar o BP → o RP entra junto como dependência, sem aviso de experimento.
3. Entrar no mundo → log de conteúdo mostra `[ARISE] Script carregado`.
4. ~2 s após o spawn: título **[ SISTEMA ]** + som de beacon + boas-vindas no chat.
5. Sair e voltar → apenas "Sistema online." (dynamic property persistiu).
6. (Opcional) Importar `ARISE_world.mcworld` → cria o mundo "ARISE — Mundo" com os packs ativos.

## Fase 2 — Stats

1. Entrar no mundo → HUD no actionbar: `Nv. 1 | ❤ 20/20 | ✦ 20/20 | XP 0%`, atualizando a cada ~meio segundo.
2. No inventário deve existir o item **Núcleo do Sistema** (cristal ciano com brilho de encantamento). Morrer não o perde; jogá-lo fora e relogar entrega outro.
3. Matar um zumbi → mensagem nenhuma, mas o `XP %` do HUD sobe. Matar ~5 mobs → título **NÍVEL 2** + som de level up + aviso no chat de +3 pontos.
4. Usar (toque longo / botão de usar) o Núcleo do Sistema → abre o menu **[ SISTEMA ]** com resumo (nível, XP, atributos, pontos livres).
5. Tocar **Distribuir Pontos** → formulário com 5 sliders. Colocar 3 em Vitalidade → confirmar → a vida máxima sobe (+2 corações) em até 5 s e a mensagem de confirmação aparece.
6. Distribuir pontos em Agilidade (4+) → velocidade de corrida visivelmente maior (efeito speed sem partículas).
7. Tentar distribuir mais pontos do que tem (sliders somando além do limite) → mensagem de erro em vermelho e o formulário reabre.
8. Barra de mana: gastar nada ainda (skills vêm na Fase 4), mas o `✦` regenera sozinho ~2/s se estiver abaixo do máximo; pontos em Mana aumentam o máximo (+5 cada).
9. Sair e voltar → nível, XP, atributos e pontos continuam (persistência).
10. Log de conteúdo sem erros `[ARISE]` em vermelho durante tudo isso.
