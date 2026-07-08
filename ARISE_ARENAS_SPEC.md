# ARISE — Arenas de Portal por Rank (arquitetura própria por rank)

Objetivo: cada rank de portal (E, D, C, B, A, S) passa a ter uma arena com layout,
materiais e ponto focal próprios, em vez de uma estrutura única para todos. Isto é
trabalho de CONTEÚDO sobre o sistema de arena-local que já existe (v0.8.11): NÃO
mude a lógica de ondas, chefe, anti-fuga, recompensa, spawn confirmado nem o
posicionamento local deslocado. Só troque O QUE é construído conforme o rank.

## COMO INTEGRAR (leia antes de codar)

- A arena hoje é montada localmente perto do jogador (offset +40 no X, Y alto),
  seja via structureManager.place() (portal) ou setPermutation() (penalidade).
  Para estas arenas por rank, use CONSTRUÇÃO BLOCO-A-BLOCO via setPermutation()
  (mesma técnica da Zona de Penalidade), NÃO .mcstructure — assim não dependemos de
  gerar arquivos NBT e tudo fica em JS.
- Crie um módulo novo: BP/scripts/dungeons/arenaBuilder.js, exportando uma função
  buildArena(rank, dim, origin) que despacha para a construtora do rank certo
  (buildCryptE, buildCatacombD, buildHallC, buildForgeB, buildSanctuaryA, buildThroneS).
- gates.js chama buildArena(gate.rank, dim, gate.origin) no lugar do
  structureManager.place() atual. O restante do fluxo de gates.js NÃO muda:
  arenaReady(), spawnWave, spawnBoss, aliveGateMobs, cleanupArena continuam, só
  passam a usar as dimensões reais da arena do rank (ver "contrato" abaixo).
- Todas as construtoras usam BlockPermutation.resolve() num loop, com try/catch e
  checagem `if (!block) throw new Error("chunk descarregado")` em CADA getBlock (a
  mesma proteção estrita que a penalidade já tem — nunca aceitar chunk não carregado).
- Performance de console: a construção roda uma vez por instância na fase "build".
  Se uma arena grande (S) travar por volume de blocos num tick, construa em FATIAS
  por camada Y ao longo de alguns ticks (ver nota em Rank S). Para E-A o volume é
  pequeno o bastante para um tick só.
- Cores/blocos: use apenas blocos vanilla estáveis (nomes minecraft:...). Se algum
  bloco citado não existir na versão alvo, escolha o vanilla mais próximo e me avise.

## CONTRATO COMUM A TODAS AS ARENAS

Cada construtora recebe (dim, origin) onde origin é o canto mínimo (x,y,z) e retorna
um objeto de metadados que a instância guarda:

  {
    center: { x, y, z },       // centro do piso — onde o jogador é teleportado e mobs base spawnam
    spawnPoints: [ {x,y,z}, ... ], // 4 a 8 pontos de spawn de onda, distribuídos pela sala
    bossPoint: { x, y, z },    // ponto focal — onde o Guardião surge
    floorY: number,            // Y do piso (para arenaReady() checar bloco sólido)
    bounds: { minX, maxX, minY, maxY, minZ, maxZ } // para cleanupArena preencher de ar
  }

- spawnWave passa a spawnar distribuído pelos spawnPoints (rodízio), não todos no
  centro — dá sensação de a sala inteira ser usada.
- bossPoint substitui o center no spawnBoss.
- cleanupArena preenche todo o volume `bounds` com ar ao encerrar (já faz isso; só
  passe os bounds do rank em vez de tamanho fixo).
- arenaReady() checa o bloco do piso em center com floorY.

Convenção de eixos abaixo: dx = leste(+x), dz = sul(+z), dy = cima(+y), a partir de
origin. "Piso" é a camada dy=0; jogador/mobs ficam em dy=1+.

═══════════════════════════════════════════════════════════════════
## RANK E — CRIPTA (fechada)
═══════════════════════════════════════════════════════════════════
Fantasia: cela de pedra tosca, apertada, úmida. A mais humilde.
Planta: quadrado 15×15, teto baixo.
- Tamanho: 15 (x) × 6 (altura) × 15 (z). origin no canto SW-baixo.
- Piso (dy=0): minecraft:cobblestone, com ~15% de minecraft:mossy_cobblestone
  espalhado (aleatório determinístico) e 4 blocos de minecraft:cobblestone_slab? não
  — piso plano sólido. Um bloco central dy=0 = minecraft:chiseled_stone_bricks (marca
  do ponto focal).
- Paredes (perímetro, dy=1..4): minecraft:cobblestone com veios de mossy_cobblestone.
- Teto (dy=5): minecraft:cobblestone. Fechado. 4 blocos de minecraft:barrier
  substituem nada — o teto sólido já veda; sem céu.
- Iluminação: 4 blocos de minecraft:soul_lantern nos cantos (dy=1, embutidos na
  parede) — luz azulada fraca, clima de cripta.
- Interior: totalmente vazio (arena de combate limpa).
- center: (7,1,7). floorY = origin.y.
- spawnPoints: 4 cantos internos, a 2 blocos da parede: (3,1,3),(11,1,3),(3,1,11),(11,1,11).
- bossPoint: (7,1,7) (mesmo centro — cripta é pequena, chefe surge no meio).
- bounds: origin até origin+(14, 5, 14).

═══════════════════════════════════════════════════════════════════
## RANK D — CATACUMBA (fechada)
═══════════════════════════════════════════════════════════════════
Fantasia: sala funerária com pilares e musgo. Um degrau acima da cripta.
Planta: retângulo 19×19, com 4 pilares internos.
- Tamanho: 19 × 7 × 19.
- Piso (dy=0): minecraft:mossy_cobblestone base, com ~20% de minecraft:cobblestone e
  algumas manchas de minecraft:moss_block. Bloco central = minecraft:chiseled_stone_bricks.
- Paredes (perímetro, dy=1..5): minecraft:stone_bricks com ~25% de
  minecraft:mossy_stone_bricks e ~10% de minecraft:cracked_stone_bricks (ruína).
- 4 PILARES internos (2×2 cada, dy=1..5), posicionados em (5,5),(13,5),(5,13),(13,13)
  no plano dx/dz: minecraft:stone_brick_wall? não — pilares sólidos de
  minecraft:polished_blackstone_bricks, com minecraft:soul_lantern no topo (dy=5).
- Teto (dy=6): minecraft:stone_bricks. Fechado.
- Iluminação: soul_lanterns nos 4 pilares + 4 nas paredes.
- center: (9,1,9). floorY = origin.y.
- spawnPoints: entre os pilares — (9,1,3),(9,1,15),(3,1,9),(15,1,9) (4 pontos nas
  laterais medianas, mobs surgem "atrás" dos pilares).
- bossPoint: (9,1,9).
- bounds: origin até origin+(18, 6, 18).

═══════════════════════════════════════════════════════════════════
## RANK C — SALÃO GÉLIDO (fechada)
═══════════════════════════════════════════════════════════════════
Fantasia: nave longa e alta, gelo e pedra escura. Primeira sala "grandiosa".
Planta: retângulo LONGO 15×25 (corredor-salão), teto alto.
- Tamanho: 15 (x) × 9 (altura) × 25 (z). É mais comprida no eixo Z.
- Piso (dy=0): minecraft:blackstone base, com faixa central (dz de 6 a 8, largura 3)
  de minecraft:packed_ice ligando as duas pontas — "tapete" gelado. Bloco central =
  minecraft:chiseled_polished_blackstone.
- Paredes (perímetro, dy=1..7): minecraft:blackstone com ~20% de minecraft:blue_ice
  em veios verticais a cada 4 blocos (colunas de gelo azul embutidas).
- Teto (dy=8): minecraft:blackstone. Fechado, mas alto (dá sensação de catedral).
- Nas duas pontas (z curto e z longo), um "altar" de 3×1 de minecraft:blue_ice
  elevado 1 bloco (dy=1), com minecraft:soul_lantern em cima — pontos de referência.
- Iluminação: soul_lanterns ao longo das paredes a cada 6 blocos (dy=3).
- center: (7,1,12).
- spawnPoints: 6 pontos ao longo do corredor: (7,1,4),(7,1,12),(7,1,20),(3,1,8),
  (11,1,8),(3,1,16),(11,1,16) — usa o comprimento da sala.
- bossPoint: (7,1,12) (centro do salão).
- bounds: origin até origin+(14, 8, 24).

═══════════════════════════════════════════════════════════════════
## RANK B — FORJA (fechada, com verticalidade)
═══════════════════════════════════════════════════════════════════
Fantasia: câmara de lava, plataformas de basalto, calor. Perigo ambiental leve.
Planta: quadrado 21×21 com plataformas e um fosso de lava periférico (visual, sem
dano real letal — ver nota de segurança).
- Tamanho: 21 × 8 × 21.
- Piso (dy=0): minecraft:polished_blackstone base. Uma MOLDURA periférica (as 2
  fileiras mais externas do piso) de minecraft:magma_block com uma "vala" de
  minecraft:lava 1 bloco abaixo — NOTA DE SEGURANÇA: para não matar o jogador
  instantaneamente e arruinar a luta, NÃO use lava aberta no piso de combate. Em vez
  disso: moldura periférica de minecraft:magma_block (dano leve por contato, tematico)
  e, atrás da parede (fora da área de combate, só visual através de FERROS),
  minecraft:lava. Se implementar lava visível for arriscado, use magma_block +
  minecraft:shroomlight para o brilho alaranjado, sem lava. Prefira o mais seguro.
- Centro do piso: plataforma elevada 5×5 em dy=1 de minecraft:chiseled_polished_blackstone
  (o chefe surge aqui, acima do resto — teatral).
- 4 plataformas menores 3×3 em dy=1 nos quadrantes intermediários (basalto:
  minecraft:polished_basalt), conectadas ao centro por passarelas 1-largura de
  minecraft:polished_blackstone.
- Paredes (dy=1..6): minecraft:blackstone com veios de minecraft:magma_block e
  minecraft:gilded_blackstone (toques dourados).
- Teto (dy=7): minecraft:blackstone. Fechado.
- Iluminação: minecraft:shroomlight e minecraft:lantern (não soul — luz quente aqui)
  nas paredes e sob as plataformas.
- center: (10,1,10) — mas como o centro é elevado, o TELEPORTE do jogador entra em
  (10,2,10) sobre a plataforma central. Ajuste: se a plataforma central é dy=1
  (topo em y=origin.y+1), o jogador fica em y=origin.y+2.
- spawnPoints: as 4 plataformas menores + 2 pontos no piso base: distribua 6 pontos.
- bossPoint: topo da plataforma central (10, 2, 10).
- floorY para arenaReady: checar o piso base (origin.y) OU o topo da plataforma
  central — escolha o piso base para consistência.
- bounds: origin até origin+(20, 7, 20).

═══════════════════════════════════════════════════════════════════
## RANK A — SANTUÁRIO (fechada)
═══════════════════════════════════════════════════════════════════
Fantasia: templo profanado, planta em CRUZ, veios de energia roxa (a estética das
sombras do ARISE). A última sala fechada antes do trono.
Planta: CRUZ (cruciforme) inscrita num 23×23 — quatro braços saindo de um centro.
- Tamanho: 23 × 9 × 23, mas só a forma de cruz é construída (os 4 cantos do quadrado
  ficam VAZIOS/de ar — a planta não é quadrada cheia).
- Definição da cruz: braço central de largura 9 (dx 7..15) no eixo Z inteiro, e
  largura 9 (dz 7..15) no eixo X inteiro — a união forma o +.
- Piso (dy=0): minecraft:polished_blackstone com incrustações de
  minecraft:crying_obsidian formando linhas que correm dos 4 braços até o centro
  (veios de energia convergindo). Centro = minecraft:chiseled_polished_blackstone com
  4 blocos de crying_obsidian ao redor.
- Paredes da cruz (dy=1..7): minecraft:blackstone com veios verticais de
  minecraft:crying_obsidian e minecraft:amethyst_block a cada 4 blocos (o roxo das
  sombras). No fim de cada braço, um "altar" de 3×2 de minecraft:crying_obsidian com
  minecraft:soul_lantern.
- Teto (dy=8): minecraft:blackstone. Fechado.
- Iluminação: soul_lanterns nos 4 altares + minecraft:amethyst_cluster? (só se
  colocável em parede; senão soul_lantern) para brilho roxo.
- center: (11,1,11).
- spawnPoints: as 4 pontas dos braços da cruz — (11,1,3),(11,1,19),(3,1,11),(19,1,11)
  — mobs surgem no fundo de cada braço e convergem para o centro.
- bossPoint: (11,1,11) (cruzamento central).
- bounds: origin até origin+(22, 8, 22). (cleanupArena preenche o quadrado todo de
  ar, mesmo os cantos vazios — inofensivo.)

═══════════════════════════════════════════════════════════════════
## RANK S — CASTELO DO MONARCA DAS SOMBRAS (ABERTA, no topo do mundo)
═══════════════════════════════════════════════════════════════════
Fantasia: o pátio do trono do monarca demoníaco, exposto ao céu, no alto do mundo.
Grandioso mas NÃO complexo — legível, teatral, sem becos. Referência: sala do trono
do castelo sombrio, versão simplificada.
Planta: OCTÓGONO grande, aberto (sem teto), com escadaria central para um trono
elevado. Muralha baixa com ameias no perímetro (parapeito, não teto).
- Tamanho: octógono inscrito em 33×33, altura de muralha 6 (sem teto — céu aberto).
  Como a arena S é construída em Y alto (a arena-local já vai para Y alto), ela fica
  literalmente acima do mundo — a fantasia de "castelo nas alturas" sai de graça.
- Piso do octógono (dy=0): minecraft:polished_blackstone base, com um GRANDE padrão
  radial de minecraft:gilded_blackstone e minecraft:polished_blackstone_bricks
  irradiando do centro (raios dourados). Anel externo (perímetro do octógono) de
  minecraft:chiseled_polished_blackstone.
- Muralha/parapeito (perímetro do octógono, dy=1..5): minecraft:polished_blackstone_bricks
  com AMEIAS no topo (dy=6 alternando bloco/ar a cada 2 — merlões), e postes de
  minecraft:gilded_blackstone nos 8 vértices do octógono subindo até dy=7 com
  minecraft:soul_lantern no topo (as "tochas" do castelo). SEM teto — aberto ao céu.
- TRONO central: uma plataforma elevada em ESCADARIA. Três degraus concêntricos
  (dy=1, dy=2, dy=3) de minecraft:polished_blackstone_bricks, cada um menor, subindo
  ao pódio central 3×3 em dy=3. No pódio, um TRONO: bloco central de
  minecraft:crying_obsidian ladeado por 2 de minecraft:gilded_blackstone (encosto
  atrás sobe mais 2 blocos, dy=4..5, de crying_obsidian). Atrás do trono, dois
  postes altos (dy=1..7) de blackstone com minecraft:soul_lantern no topo,
  emoldurando o monarca.
- Veios de crying_obsidian correndo do trono pelas escadarias até o anel externo —
  o poder do monarca irradiando.
- Iluminação: soul_lanterns nos 8 vértices + nos postes do trono. Luz azulada
  espectral, coerente com as sombras.
- center: piso base do octógono, (16,1,16) para o teleporte inicial do jogador (ele
  chega no pátio, olha para o trono).
- bossPoint: TOPO do trono — (16, 4, 16) — o Guardião S (o "monarca") surge SENTADO
  no trono e desce. Teatral.
- spawnPoints: 8 pontos ao longo do anel do octógono (nas 8 faces), mobs cercam o
  jogador vindo do perímetro em direção ao centro/trono.
- floorY: piso base (origin.y).
- bounds: origin até origin+(32, 7, 32).
- PERFORMANCE: esta é a maior arena (~33×33×8 ≈ 8700 blocos). Construa em FATIAS por
  camada Y: uma camada dy por tick (ou 2), ao longo de ~8-12 ticks, marcando
  built=true só quando a última camada e o trono estiverem colocados e arenaReady()
  confirmar bloco sólido no center. NÃO tente colocar tudo num tick só (risco de
  travar o console). O jogador só é teleportado após built=true, como já acontece.
- ABERTURA AO CÉU + ANTI-FUGA: como não há teto, o anti-fuga não pode depender de
  teto de barreira. Mantenha o anti-fuga por DISTÂNCIA que já existe (se o jogador
  sai do raio da arena, teleporta de volta ao center). Adicione um "chão de
  segurança": se o jogador cair abaixo de floorY-3 (pulou da muralha), teleporta de
  volta ao center. Isso preserva a sensação aberta sem deixar o jogador escapar/cair
  no vazio.

═══════════════════════════════════════════════════════════════════
## PROCESSO DE ENTREGA
═══════════════════════════════════════════════════════════════════
Implemente em 2 subfases, com validação e PARADA entre elas:

SUBFASE 1 — arenas fechadas (E, D, C, B, A):
- Criar arenaBuilder.js com as 5 construtoras fechadas + o contrato comum.
- Ligar gates.js para usar buildArena por rank.
- Ajustar spawnWave para distribuir pelos spawnPoints, spawnBoss para usar bossPoint,
  cleanupArena para usar bounds do rank.
- Manter TODAS as proteções da v0.8.11 (spawn confirmado, chefe só por morte real,
  bloco real, retorno limpo).
- Validar (json.tool, node --check, package.sh), bump patch, commit, push, CI verde.
- Checklist Android: abrir portal de CADA rank E-A, confirmar a arena correta aparece,
  mobs distribuídos, chefe no ponto focal, conclusão só após combate, retorno e limpeza.
PARE.

SUBFASE 2 — o trono do Rank S (aberto):
- Adicionar buildThroneS com construção em fatias por camada Y.
- Implementar o anti-fuga sem teto (distância + chão de segurança).
- Validar, bump patch, commit, push, CI verde.
- Checklist Android: abrir portal S, confirmar o castelo aberto no alto, trono central,
  Guardião surgindo no trono, anti-fuga funcionando (tentar pular a muralha devolve ao
  centro), conclusão e limpeza da arena grande.
PARE.

Antes de codar a Subfase 1, apresente em 8-12 linhas seu plano: como vai estruturar
arenaBuilder.js, como o padrão determinístico de blocos (mossy/cracked aleatório) vai
ser reproduzível, e qualquer bloco da spec que não exista na versão alvo (com o
substituto vanilla que você propõe).
