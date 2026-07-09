# ARISE - Equipamento

## Subfase 1 - Adagas

Ids usados:

- `arise:blade_shadow` - Adaga Sombria
- `arise:blade_serpent` - Adaga da Serpente
- `arise:blade_monarch` - Adaga do Monarca
- `arise:blade_headsman` - Adaga do Algoz
- `arise:blade_void` - Adaga do Vazio

Componentes de item:

- As adagas declaram `minecraft:enchantable` com `slot: "none"` e `value: 0`. A documentacao oficial descreve esse componente como o suporte para encantamentos no item e lista `none` como slot valido; isso remove a adaga das categorias usadas pela mesa/bigorna do player.
- Encantamentos em adagas sao exclusivos de loot: Subfases 2/3 devem gerar o item ja encantado pela tabela/rotina de loot, sem depender de interacao do player com mesa ou bigorna. Nao usar `slot: "sword"` na adaga base.
- `minecraft:damage` define dano 8, acima da espada de diamante indicada na spec.
- `minecraft:durability` define durabilidade 1200 e perda de durabilidade no uso.

Limite de velocidade:

- A documentacao oficial expoe `minecraft:cooldown` com `type: "attack"` para velocidade/cooldown de arma, mas esse campo exige `format_version` 1.21.130. O projeto esta em 1.21.0, entao a Subfase 1 nao declara velocidade de ataque para manter compatibilidade com a base estavel atual.

Bônus furtivo:

- A API estavel nao oferece uma forma robusta de saber se o alvo esta "de costas" em todos os casos. A Subfase 1 usa o proxy da spec: se o jogador estiver agachado no momento do acerto com uma adaga, aplica dano extra por script.

Sanidade para Android:

- `/give @s arise:blade_shadow` deve entregar uma adaga sem opcoes de encantamento na mesa e sem aceitar novos encantamentos pela bigorna.
- Uma adaga gerada por loot como item ja encantado, por exemplo com Afiacao IV nas Subfases 2/3, deve manter brilho/encantamento e aplicar o dano do encantamento. A adaga base usa `slot: "none"` para separar o suporte de encantamento via loot da interacao de encantamento do player.

Teste temporario de loot encantado:

- Com cheats/comandos habilitados no mundo de teste Android, execute: `/scriptevent arise:debug_blade_loot`
- Resultado esperado: o chat mostra que a Adaga Sombria de teste foi entregue com Afiacao IV, e o item aparece com brilho/encantamento.
- Se o chat mostrar que `slot: "none"` recusou Afiacao IV por API de loot/script, a solucao precisa mudar antes das Subfases 2/3.
- Depois, compare com `/give @s arise:blade_shadow`: a adaga base nao deve oferecer encantamento na mesa nem aceitar encantamento novo pela bigorna.
