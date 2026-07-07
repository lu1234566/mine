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

## Fase 4 — Devorar, traços e evolução

1. Menu do Núcleo → **Habilidades** → "Devorar" aparece bloqueada antes do nível 3 e liberada a partir dele.
2. Tocar em "Devorar" → alterna `[ATIVA]`/`[inativa]` com som e mensagem.
3. Com Devorar ATIVA e mana ≥ 5: matar mobs → em ~45% dos abates, som + actionbar `✦ Essência absorvida: <mob> (n)` e 5 de mana a menos. Com Devorar inativa ou sem mana, nada acontece.
4. O corpo do menu Habilidades lista as essências acumuladas e o progresso de cada traço (`✖ Pele Ígnea (3/8)` etc.).
5. Juntar 8 essências de Blaze/Cubo de Magma → título **[ TRAÇO ADQUIRIDO ] Pele Ígnea**; a partir daí você não queima em fogo/lava (efeito reaplicado a cada ~5 s — pode piscar 1 tick de dano, mas não mata).
6. Traços de teste rápido (creative/spawn eggs valem): 10 aranhas → veneno some sozinho; 12 creepers → explosão dói metade; 12 esqueletos → flechas suas dão +3 de dano; 12 zumbis → abaixo de 35% de vida você regenera.
7. Menu → **Evolução**: mostra espécie atual (Despertado) e as duas opções bloqueadas até nível 10 + 20 essências totais.
8. Cumprindo os requisitos, escolher **Predador** ou **Sábio** → confirmação explícita ("permanente"), título **[ EVOLUÇÃO ]**, som, e o nametag muda para `‹Predador› SeuNome` (visível para outro jogador/celular; em single player dá para conferir na câmera frontal do F5).
9. Bônus: Sábio → mana máxima 1,5x no HUD; Predador → chance de Devorar sobe para ~60% no texto do menu Habilidades.
10. Relogar → espécie, essências, traços e toggle do Devorar persistem; sem erros `[ARISE]` no log.

## Fase 5 — Exército de Sombras

1. Menu → **Habilidades** → "Exército de Sombras" bloqueada antes do nível 8, liberada a partir dele com contador `[ativas/limite]`.
2. Matar um zumbi ou esqueleto → abrir Habilidades → Exército → **Extrair Sombra** em até 30 s → o cadáver aparece listado ("Zumbi, há Xs — vira Sombra Guerreira").
3. Extrair (custa 15 de mana, ~60% de chance): no sucesso, título/mensagem "LEVANTE-SE", partícula + som, e surge uma **Sombra Guerreira** (humanoide negro de olhos cianos, nome `Sombra Guerreira [T1]` sobre a cabeça). Na falha, mensagem "a sombra resistiu" e o cadáver é consumido.
4. Esqueletos viram **Sombra Arqueira** (olhos roxos) que atira flechas.
5. A sombra anda solta perto de você; se você correr para longe (20+ blocos), ela teleporta até você em ~2 s. Ela ataca sozinha monstros hostis que chegarem a 16 blocos.
6. Menu → Exército → **Comandar**: "Aguardar aqui" congela a sombra no lugar (e ela para de teleportar); "Seguir-me" solta de novo; "Atacar meu alvo" mirando num mob a até 24 blocos → as sombras teleportam ao redor dele e o combate engata.
7. "Dispensar todas" → sombras somem com som e vão para a **reserva** (listada no corpo do menu Comandar). **Invocar da reserva** (8 de mana) traz de volta com o MESMO tier/xp.
8. Deixar a sombra matar ~10 mobs → mensagem "evoluiu para o Tier 2", nome atualiza para `[T2]` e ela fica mais resistente; você ganha metade do XP dos abates dela (o HUD sobe sem você encostar no mob).
9. Se a sombra morrer em combate → mensagem "caiu e retornou à reserva" (não é perdida).
10. Limite de ativas = 1 + nível/5 (nível 10 → 3). Tentar passar disso → mensagem de limite.
11. Relogar → sombras ativas continuam no mundo e a reserva persiste; sem erros `[ARISE]` no log.

## Fase 6 — Portais rank E–C

1. Conseguir uma **Chave de Portal — Rank E** (missão diária, ou `/give @s arise:gate_key_e` num mundo de teste com trapaças).
2. Usar a chave (toque longo) → título **[ PORTAL E ]**, som de portal, a chave é consumida e você é levado para o alto da arena remota, descendo de queda lenta enquanto ela é montada (piso de blackstone, muros de obsidiana com veios roxos, lanternas no chão).
3. Após pousar: título **Onda 1/2** e mobs surgem em círculo ao seu redor. Matar todos → pausa de ~3 s → **Onda 2/2**.
4. Limpar as ondas → título **[ GUARDIÃO ]** e surge o **Guardião do Portal [E]**: humanoide negro grandão (1,35x) de olhos vermelhos **com barra de chefe no topo da tela**. Suas sombras ajudam na luta (o chefe também as ataca).
5. Derrotar o chefe → título **[ PORTAL CONQUISTADO ]**, +120 XP, +1 **Cristal de Essência** e ~35% de chance de uma **Chave Rank D** (azul). ~5 s depois você volta exatamente para onde usou a chave e a arena é limpa.
6. Usar o Cristal de Essência → consumido, +40 XP.
7. Testar falhas: (a) morrer dentro → respawn normal + "instância colapsou", sem recompensa; (b) usar uma chave enquanto outro portal está aberto → mensagem de ocupado SEM consumir a chave; (c) ficar 10 min sem fechar → o portal colapsa e te devolve.
8. Rank D (3 ondas, chefe 100 HP) e Rank C (3 ondas com vingadores/saqueadores, chefe 160 HP) funcionam igual, com recompensas maiores.
9. Sem erros `[ARISE]` no log durante o ciclo completo.

## Fase 7 — Ranks B–S, segunda evolução e polish

1. Chaves **B (laranja), A (vermelha) e S (roxa)** existem e abrem portais com 3 ondas mais pesadas (esqueletos wither, blazes, invocadores, ravager no S). Os mobs dessas ondas vêm buffados (resistência/força — sem partículas visíveis, mas aguentam mais dano).
2. Vencer o rank C agora tem 25% de chance de dropar chave B; A tem 20% de dar a S. Recompensas sobem até +2600 XP e 10 cristais no S.
3. Chefes B/A/S: barra de chefe com vida 240/340/500 e dano crescente — no rank S, leve suas sombras e poções.
4. **Segunda evolução** (menu Evolução, nível 25 + 60 essências): Predador → **Monarca** (+25% Devorar, +2 Força, +3 sombras ativas) e Sábio → **Oráculo** (mana dobrada, +25% XP, +1 sombra). O nametag muda de cor (`‹Monarca›` vermelho-escuro / `‹Oráculo›` rosa).
5. Confirmar limite de sombras: nível 25 como Monarca = 1 + 5 + 3 = **9 ativas**.
6. Missão diária: com nível 15+ a chave da recompensa vira Rank D; com 30+, Rank C.
7. Polish: partícula de totem ao subir de nível; explosão visual quando o Guardião surge; curva de XP suavizada (subir de nível no early game ~20% mais rápido).
8. Passada completa sem erros `[ARISE]` no log: entrar, missão, devorar, extrair sombra, portal E→S, evoluir 2x, relogar e conferir persistência de tudo.

## Fase 8A — Habilidades ativas (v0.8.1)

1. Reimportar o pack → na tela de packs a versão deve mostrar **0.8.1** (se mostrar antiga, remova o pack e importe de novo — era esse o motivo do bump).
2. Ao entrar, além do Núcleo você recebe o **Grimório de Habilidades** (livro roxo com runa). Morrer não o perde.
3. **Agachar + usar o Grimório** → menu com as 5 skills; abaixo do nível 5, todas bloqueadas com o requisito visível.
4. No nível 5+, tocar **Impulso** → "armada"; HUD ganha `⚔ Impulso` no fim da barra. **Usar o Grimório em pé** → você é arremessado na direção do olhar, gasta 6 de mana, e o HUD mostra `⚔ Impulso 3s` durante o cooldown. Spam de uso durante cooldown → só o aviso "recarrega em Xs" (sem gastar mana).
5. **Teste de persistência do cooldown**: use Ocultação (nível 20, CD 60 s), saia do mundo IMEDIATAMENTE e volte → agachar+usar → o menu deve mostrar "recarrega ~40s", não "pronta". Se mostrar pronta, o bug é em `arise:cd_ocultacao` — procure `[ARISE] Erro em openSkillMenu` no log.
6. **Golpe Fantasma** (nível 12): arme, junte 2+ monstros, dispare → partícula de explosão, som grave e actionbar `⚔ Golpe Fantasma: N alvos, X de dano`. Sombras suas e animais passivos NÃO tomam dano.
7. **Ocultação**: invisibilidade 15 s sem partículas. **Limitação conhecida (API estável)**: mob que JÁ estava te atacando continua — a skill evita novos aggros, não limpa os antigos.
8. **Clarividência** (nível 8; antes do 30 só Sábio/Oráculo — teste com o personagem certo): mire num mob e dispare → actionbar `👁 Nome — ❤ X/Y`; matar esse TIPO nos próximos 30 s dá +25% XP e +15% de chance de Devorar.
9. **Dreno Sombrio** (nível 30, Predador/Monarca): mirar no nada → "Mire em uma criatura" e NÃO gasta mana/cooldown; mirar num mob → dano + coração de partícula + cura no actionbar.
10. Sem erros `[ARISE]` no log em nenhum disparo.

## Fase 8B — Rupturas + Portal Vermelho (v0.8.2)

1. Versão **0.8.2** na tela de packs.
2. **Forçar ruptura sem esperar 3 dias**: em `BP/scripts/config.js`, mude `BREAKS.DEBUG_FORCE_MS: 0` para `60000` (1 min), re-empacote/reimporte. Pegue uma Chave E (missão ou `/give`), espere ~2 min (a reconciliação roda a cada 60 s) SEM usar a chave.
3. Ruptura dispara: título **[ RUPTURA ]** + som de wither, a chave SOME do inventário e a onda 1 do rank E surge ao seu redor; actionbar vira `⚠ RUPTURA [E] | Sobreviva XmYs | N inimigos`.
4. Matar todos (ou aguentar 3 min) → `Ruptura contida`, +XP parcial (~36) e +1 cristal — de propósito bem menos que o portal renderia.
5. Morrer no meio → respawn normal, mensagem "a fenda se fechou", sem recompensa, mobs somem.
6. Conferir que ruptura NÃO dispara enquanto você está dentro de um portal ou na Zona de Penalidade (abra um portal com outra chave vencida no bolso — nada acontece até sair).
7. **Volte `DEBUG_FORCE_MS` para 0** antes de jogar de verdade.
8. **Portal Vermelho**: para testar rápido, mude `BREAKS.RED_CHANCE` para `1.0` (100%) e abra um portal → título vermelho **[ PORTAL VERMELHO ]** + rugido de dragão. Tentar sair andando da arena → teleporte de volta com aviso. Derrotar o Guardião → saída libera normal (recompensas normais). Morrer dentro → respawn fora, chave perdida, mensagem própria. Volte `RED_CHANCE` para 0.05 depois.
9. Se nada disparar, procure `[ARISE] Erro em triggerBreak` ou `tickBreaks` no log.

## Fase 8C — Fusão de sombras (v0.8.3)

1. Versão **0.8.3** na tela de packs.
2. Extraia 3 sombras do MESMO tipo (ex.: 3 guerreiras — todas tier 1) e **dispense todas** (fusão só olha a reserva).
3. Menu → Habilidades → Exército de Sombras → **Fundir** → aparece `3x Sombra Guerreira [T1] → [T2] · custo: 1 cristal + 30 mana`. Sem cristal/mana suficientes, a execução recusa com mensagem clara.
4. Confirmação lista EXATAMENTE o que será consumido; **Fundir** → título **[ FUSÃO COMPLETA ]** com um nome sorteado (ex.: `Umbra (Sombra Guerreira) [T2]`); as 3 somem da reserva e a nova aparece.
5. Invocar a fundida → nametag mostra o nome próprio. As 3 de MENOR XP são as consumidas (a mais treinada sobrevive se houver 4+).
6. **Cadeia até Elite**: 9x T1 → 3x T2 → 1x T3; repita até ter 3x T3 → fusão vira **[ELITE]** (custo 3 cristais). A Elite tem fumaça sutil saindo do topo, aguenta bem mais dano (resistência+vida extra) e bate mais forte.
7. Elite NÃO aparece como opção de fusão (é o teto) e sombra nunca chega a Elite por XP (T3 é o máximo por combate).
8. Deixe uma sombra NOMEADA morrer → mensagem "ferida por 10 min"; na reserva ela aparece `✚ ferida — Xm` e invocá-la é recusado até o tempo passar. Sombra sem nome continua voltando à reserva na hora.
9. Relogar → nomes, tiers, feridas e reserva persistem. Sem erros `[ARISE]` (procure `openFusion` no log se o menu falhar).

## Fase 8D — Texturas por tier das sombras (v0.8.7)

1. Reimportar o pack → na tela de packs a versão deve mostrar **0.8.7**. Se mostrar antiga, remova o pack anterior e importe o novo `.mcaddon`.
2. Invocar/obter **Sombra Guerreira** T1, T2, T3 e Elite; confirmar que cada tier tem textura diferente e que o nametag continua correto.
3. Invocar/obter **Sombra Arqueira** T1, T2, T3 e Elite; confirmar que cada tier tem textura diferente e que a arqueira continua atacando à distância.
4. Abrir portais **E/D/C/B/A/S** e conferir variação visual do Guardião: E = T1, D = T2, C/B = T3, A/S = Elite.
5. Conferir sintomas visuais: rosa/preto = caminho de textura errado; textura embaralhada = problema UV/geometria; sempre T1 = variant não aplicado; nome muda mas textura não = script salvou tier, mas não disparou evento visual.
6. Relogar, dispensar e invocar sombras da reserva para conferir que o visual é reaplicado pelo tier salvo em `arise:shadows`.
7. Evoluir uma sombra de T2 para T3 por XP e confirmar que os atributos de T3 substituem os de T2, sem duplicar vida/dano.
8. Rodar uma luta curta com sombras e Guardião; confirmar que não há erros `[ARISE]` no Log de Conteúdo.
