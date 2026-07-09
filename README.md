# ARISE — Add-on RPG para Minecraft Bedrock

Sistema de progressão RPG inspirado em mangás de "sistema de níveis" e evolução por predação: níveis e atributos, missões diárias com penalidade, habilidade de devorar (traços e evolução de espécie), exército de sombras e portais ranqueados.

**Alvo:** Minecraft Bedrock — desenvolvido/testado no Android (Chromebook), instalado no Nintendo Switch (desbloqueado) via injeção de save com JKSV.

**Estado atual: loop de equipamento fechado (v0.8.26).** Fases 1–7 completas (despertar, stats/HUD/mana, missão diária + Zona de Penalidade, Devorar/traços, evolução em 2 estágios, Exército de Sombras, Portais E–S) + Fase 8: **habilidades ativas** via Grimório (Impulso, Golpe Fantasma, Ocultação, Dreno Sombrio, Clarividência), **Rupturas** de chaves envelhecidas + Portal Vermelho, **Fusão de sombras** com tier Elite e nomes próprios, texturas por tier/rank para sombras e Guardião, Poção de XP do Sistema, arenas fechadas E-A, dungeons de exploração naturais persistentes com feixe/loot finito e loot de portões por rank com adagas/armaduras encantadas por script. Checklists de teste por fase: `docs/CHECKLISTS.md`.

**Toggles experimentais necessários: NENHUM.** Todas as fases usam apenas módulos estáveis (`@minecraft/server` 1.13.0 e `@minecraft/server-ui` 1.1.0). Se alguma fase futura exigir um experimento, isso será destacado aqui e no checklist da fase.

---

## Estrutura

```
BP/                  Behavior Pack (lógica: JSON + JavaScript, Script API estável)
RP/                  Resource Pack (texturas, entidades cliente, textos)
tools/package.sh     Gera os artefatos em dist/ (ver abaixo)
tools/make_level_dat.py   Gera o level.dat do mundo template (NBT Bedrock)
tools/make_pack_icon.py   Regenera os pack_icon.png (só se o desenho mudar)
.github/workflows/   CI: valida JSONs, checa sintaxe JS e publica os pacotes
```

Regras do projeto: API estável (`@minecraft/server` 1.x), JS puro sem bundler, dados persistidos em dynamic properties, textos em PT-BR (`texts/pt_BR.lang`, fallback `en_US.lang`), single player offline, performance de console (nenhuma lógica pesada por tick).

## Roadmap de fases

1. ✅ Esqueleto: manifests, despertar, CI, empacotamento
2. ✅ Stats: XP, nível, atributos, HUD (actionbar), mana, menu de pontos
3. ✅ Missão diária + zona de penalidade
4. ✅ Devorar: fragmentos de essência, traços, primeira evolução
5. ✅ Exército de sombras: extração, entidades custom, comandos, reserva
6. ✅ Portais rank E–C com arena
7. ✅ Balanceamento, ranks B–S, segunda linha de evolução, polish
8. ✅ Expansão: 8A skills ativas · 8B rupturas/Portal Vermelho · 8C fusão de sombras · 8D texturas por tier/rank

---

## Build (CI e local)

A cada push, a GitHub Action valida os JSONs, checa a sintaxe dos scripts e publica na aba **Actions → artifact "ARISE-addon"**:

| Artefato | Uso |
|---|---|
| `ARISE.mcaddon` | Import 1-toque no Android (BP + RP juntos) |
| `ARISE_world.mcworld` | Mundo novo já com os packs ativados (import no Android) |
| `ARISE_BP.mcpack` / `ARISE_RP.mcpack` | Packs individuais, se precisar |
| `world_behavior_packs.json` / `world_resource_packs.json` | Fluxo de injeção no Switch (abaixo) |

Para gerar localmente (no container Linux do Chromebook): `bash tools/package.sh` → saída em `dist/`. Requisitos: `bash`, `zip`, `python3`.

## Instalação no Android (teste)

**Caminho recomendado — `.mcaddon`:**

1. Baixe `ARISE.mcaddon` do artifact (ou gere em `dist/`).
2. Abra o arquivo com o Minecraft (o import é automático).
3. Crie um mundo novo → **Packs de comportamento** → ative "ARISE — Behavior Pack" (o RP entra junto como dependência).
4. **Configurações do mundo → Criador → ative "Log de Conteúdo" (GUI e arquivo)** — é assim que você vê `console.log`/erros de script.
5. Entre no mundo.

**Alternativa — `.mcworld`:** importe `ARISE_world.mcworld`; ele cria um mundo novo (sobrevivência, seed aleatória) com os dois packs já ativados. Se o import falhar na sua versão do jogo, use o caminho `.mcaddon` acima.

## Instalação no Switch (desbloqueado)

O console não importa `.mcpack`/`.mcaddon` — o caminho é colocar os packs dentro de um mundo via dump de save:

1. No Switch, crie um mundo qualquer no Minecraft e feche o jogo.
2. Dumpe o save com **JKSV** (ou Checkpoint) para o SD.
3. No PC/Chromebook, abra a pasta do mundo dumpado (`.../games/com.mojang/minecraftWorlds/<id>/`) e copie para dentro dela:
   - `behavior_packs/ARISE_BP/` (conteúdo da pasta `BP/` do repo)
   - `resource_packs/ARISE_RP/` (conteúdo da pasta `RP/` do repo)
   - `world_behavior_packs.json` e `world_resource_packs.json` (vêm prontos no artifact/`dist/`)
4. Restaure o save com o JKSV e abra o mundo.

> Dica: teste sempre no Android **com a mesma versão do jogo** que está no Switch antes de injetar. Se as versões divergirem muito, a Script API pode se comportar diferente.

## Checklists de teste

Os passos de teste manual de cada fase (Android) estão em **`docs/CHECKLISTS.md`** — rode o da fase mais recente antes de atualizar o mundo de verdade.

## Licença / conteúdo

Todo o conteúdo (nomes, textos, mecânicas nomeadas) é original. O add-on é *inspirado* em gêneros de manhwa/light novel, sem uso de personagens, nomes ou marcas de terceiros.
