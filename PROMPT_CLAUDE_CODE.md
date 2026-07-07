# PROMPT PARA O CLAUDE CODE — cole isto na primeira mensagem

Você está no repositório do **ARISE**, um add-on de Minecraft Bedrock (progressão RPG inspirada em manhwas de "sistema de níveis" + evolução por predação). **A FASE 1 JÁ ESTÁ PRONTA E VALIDADA NESTE REPO** — não recrie manifests, UUIDs, package.sh, workflow ou main.js do zero. Leia os arquivos existentes antes de qualquer mudança e construa em cima deles. Seu trabalho começa na **FASE 2**.

## CONTEXTO E RESTRIÇÕES (NÃO NEGOCIÁVEL)

- Dev num Chromebook (Linux container). Teste: Minecraft Bedrock Android no próprio Chromebook. Alvo final: Nintendo Switch (Bedrock, console desbloqueado, packs injetados via save com JKSV — fluxo já documentado no README.md).
- PRIORIZE a Script API ESTÁVEL (@minecraft/server 1.x, @minecraft/server-ui — versões já fixadas no BP/manifest.json). Só use módulo beta se um recurso for impossível sem ele; nesse caso PARE, me avise qual toggle experimental o mundo passará a exigir e ofereça alternativa estável se existir.
- JavaScript puro (ES2022+), módulos ES nativos. SEM TypeScript, SEM bundler, SEM npm no pack. Nada de eval/Function dinâmica.
- Persistência: dynamic properties (world/player.setDynamicProperty), prefixadas com o namespace definido em BP/scripts/config.js. Scoreboard só como espelho de exibição, nunca storage primário.
- Single player OFFLINE sempre.
- Textos visíveis ao jogador em PT-BR via BP/texts/pt_BR.lang e RP/texts/pt_BR.lang (en_US.lang como fallback). Código comentado em PT-BR.
- Nomes 100% originais — mecânicas inspiradas nas obras, zero nomes/personagens/termos delas.
- TODO número de balanceamento vai em BP/scripts/config.js (seções de Fase 2 já esboçadas lá). Nenhum número mágico espalhado.
- Performance de console: lógica pesada em system.runInterval com intervalo >= CONFIG.TICK_INTERVAL (10 ticks); getEntities sempre filtrado por tag/type; try/catch com console.error("[ARISE] ...") em todo handler (debugo pelo Log de Conteúdo do Android).
- Nunca invente campos de JSON de entidade/item: se não tiver certeza da sintaxe da versão estável atual, consulte a documentação oficial (learn.microsoft.com/minecraft/creator) antes.
- Após alterar/criar JSONs ou JS, rode as mesmas validações do CI localmente: `python3 -m json.tool` em cada JSON e `node --check` (via cópia .mjs) em cada script; depois `bash tools/package.sh` para garantir que o empacotamento não quebrou.

## O QUE JÁ EXISTE (FASE 1 ✅)

- BP/manifest.json e RP/manifest.json com UUIDs reais e dependências estáveis fixadas
- BP/scripts/main.js: despertar no primeiro login (dynamic property arise:awakened), saudação em logins seguintes, loop principal vazio pronto para receber lógica
- BP/scripts/config.js: namespace, TICK_INTERVAL, curvas de XP/mana esboçadas
- tools/package.sh: gera dist/ARISE.mcaddon + dist/ARISE_world.mcworld (com world_*_packs.json corretos)
- .github/workflows/build.yml: valida JSONs, checa sintaxe JS, publica artifacts
- Estrutura de pastas completa (scripts/player, skills, dungeons, ui; entities, items, loot_tables, structures; RP espelhado)

## MECÂNICAS — ESPECIFICAÇÃO COMPLETA

### Fase 2 — Sistema de Nível ("O Sistema")
- XP ao matar mobs (tabela em config.js por família: undead, arthropod, illager, boss...). Curva: xpParaProximo = XP.BASE * (nivel ^ XP.EXPONENT), teto XP.MAX_LEVEL.
- Level up: +POINTS_PER_LEVEL pontos distribuíveis via menu (ActionFormData/ModalFormData em BP/scripts/ui/menus.js, aberto com item "Painel do Sistema" — item custom simples ou interação definida por você, documente).
- Atributos: Força (dano corpo a corpo via recálculo em entityHitEntity/applyDamage), Vitalidade (vida máxima), Agilidade (velocidade), Percepção (reservado p/ fases futuras — chance de crítico/drop), Mana (recurso próprio: máx = MANA.BASE + pontos * MANA.PER_POINT, regen no loop principal).
- HUD no actionbar dentro do loop existente do main.js: `Nv. X | HP a/b | MP c/d | XP n%`.
- Módulo: BP/scripts/player/stats.js (persistência + API interna get/add XP, atributos), integrado ao main.js.

### Fase 3 — Missão Diária + Penalidade
- Ciclo via timestamp em dynamic property + system.runInterval. Missões simples sorteadas (matar N mobs / minerar N blocos / andar N metros — rastrear com eventos, sem varreduras).
- Completar: XP + chance de item "Chave de Portal" (placeholder até a Fase 6).
- Expirar sem completar: teleporte para Zona de Penalidade — arena hostil (estrutura .mcstructure no BP posicionada em coordenadas remotas reservadas) onde sobrevive X minutos antes de voltar.
- Módulo: BP/scripts/player/dailyQuest.js.

### Fase 4 — Predação e Evolução
- Skill "Devorar" (toggle no menu): ao matar mob com a skill ativa, chance de absorver → fragmentos de essência por tipo (dynamic property).
- N fragmentos do mesmo tipo → Traço (creeper → resistência a explosão; esqueleto → bônus com arco; aranha → imune a lentidão de teia; blaze → resistência ao fogo; etc. — tabela em config.js). Traços aplicados por efeitos reaplicados no loop ou lógica em eventos.
- Evolução de espécie em marcos (nível + traços): menu oferece ramo (ex.: Despertado → Predador → Monarca OU → Sábio), permanente, muda título no nametag/chat.
- Módulos: BP/scripts/skills/devour.js + BP/scripts/player/classes.js.

### Fase 5 — Exército de Sombras
- Skill "Extrair Sombra" (marco de nível): usável sobre morte recente de mob elegível (Map de mortes: posição+tipo+timestamp, janela de X s). Custo de mana proporcional; chance de sucesso em config.js.
- Sucesso: spawna entidade custom sombria (BP/entities + RP/entity; começar com zumbi e esqueleto sombrios — textura escura, olhos brilhantes, IA de combate herdada do mob base + follow-owner estilo lobo).
- Limite ativo = f(nível). Menu de comandos (server-ui): seguir / aguardar / atacar alvo olhado / dispensar p/ reserva / invocar da reserva.
- Reserva persistente: lista serializada (tipo + nível da sombra) em dynamic property. Sombras ganham XP, 2-3 tiers visuais.
- Módulo: BP/scripts/skills/shadowArmy.js.

### Fase 6 — Portais Ranqueados
- Item "Chave de Portal" rank E–S (Fase 6 implementa E–C). Usar: gera portal no local; entrar teleporta para arena (.mcstructure pré-construída em região reservada, uma instância por vez).
- Ondas escaladas por rank (equipment/efeitos no spawn) + mini-chefe (entidade custom; se a barra de boss for inviável na API estável, use alternativa e me avise).
- Recompensas: cristais de essência, XP alto, chance de chave superior. Sair/limpar: limpeza da região + teleporte de volta.
- Módulo: BP/scripts/dungeons/gates.js.

### Fase 7 — Polish
- Ranks B–S, segunda linha de evolução, sons/partículas, revisão de balanceamento (tudo via config.js), revisão de performance.

## PROCESSO

Implemente UMA fase por vez, começando pela FASE 2. Ao final de cada fase:
1. Rode as validações locais (JSON + node --check + package.sh).
2. Me entregue um CHECKLIST DE TESTE MANUAL com passos exatos in-game para eu executar no Android (o que fazer, o que deve acontecer, o que olhar no Log de Conteúdo).
3. PARE e aguarde meu ok antes da fase seguinte.

Comece agora pela Fase 2. Antes de escrever código, liste em 5-10 linhas seu plano de implementação para eu aprovar.
