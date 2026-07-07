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

## Fase 3 — Missão diária + penalidade

1. Ao entrar no mundo pela primeira vez no dia: título **[ MISSÃO DIÁRIA ]** com a missão sorteada (Caçada, Escavação ou Percurso) e aviso no chat.
2. Menu do Núcleo → **Missão Diária** → mostra tipo, progresso `X/Y` e o prazo em horas até a virada do dia (UTC).
3. Cumprir a meta (matar/quebrar/andar) → título **[ MISSÃO CONCLUÍDA ]**, +XP (~35% do nível) e, com sorte (~40%), uma **Chave de Portal — Rank E** no inventário (chave verde; ela só abre portal na Fase 6).
4. Testar a penalidade sem esperar um dia real: mude a data do Android para o dia seguinte e entre no mundo com a missão incompleta (ou aguarde a virada UTC). Em até 60 s: título vermelho **[ ZONA DE PENALIDADE ]** + som de wither e teleporte para o alto de uma arena de obsidiana remota (você desce de queda lenta enquanto ela é construída).
5. Dentro da zona: actionbar muda para `☠ ZONA DE PENALIDADE | Sobreviva mais XmYs`; zumbis/esqueletos/aranhas surgem a cada ~15 s (máx. 6 vivos); tentar escalar/fugir te devolve ao centro (teto invisível).
6. Sobreviver 4 minutos → mensagem verde de dívida paga + teleporte de volta para onde você estava; os mobs da zona somem.
7. Alternativa: morrer na zona → respawn normal + mensagem "dívida paga" (sem loop de punição).
8. Depois da penalidade, a missão do novo dia é anunciada normalmente.
9. Log de conteúdo sem erros `[ARISE]`.
