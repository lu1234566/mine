# ARISE - Equipamento

## Subfase 1 - Adagas

Ids usados:

- `arise:blade_shadow` - Adaga Sombria
- `arise:blade_serpent` - Adaga da Serpente
- `arise:blade_monarch` - Adaga do Monarca
- `arise:blade_headsman` - Adaga do Algoz
- `arise:blade_void` - Adaga do Vazio

Componentes de item:

- As adagas declaram `minecraft:enchantable` com `slot: "sword"` e `value: 0`. A documentacao oficial descreve o componente como o suporte para encantamentos no item, `slot` como a categoria de compatibilidade e `value` como o valor de encantamento minimo 0.
- Candidato tecnico atual: Caminho B. `slot: "sword"` deve permitir que a Script API aplique encantamentos de espada como Afiacao; `value: 0` tenta remover a rota vanilla da mesa por nao oferecer valor de encantamento. Este ponto precisa ser confirmado no Android com o teste temporario abaixo.
- `minecraft:damage` define dano 8, acima da espada de diamante indicada na spec.
- `minecraft:durability` define durabilidade 1200 e perda de durabilidade no uso.

Limite de velocidade:

- A documentacao oficial expoe `minecraft:cooldown` com `type: "attack"` para velocidade/cooldown de arma, mas esse campo exige `format_version` 1.21.130. O projeto esta em 1.21.0, entao a Subfase 1 nao declara velocidade de ataque para manter compatibilidade com a base estavel atual.

Bônus furtivo:

- A API estavel nao oferece uma forma robusta de saber se o alvo esta "de costas" em todos os casos. A Subfase 1 usa o proxy da spec: se o jogador estiver agachado no momento do acerto com uma adaga, aplica dano extra por script.

Sanidade para Android:

- `/give @s arise:blade_shadow` deve entregar uma adaga sem opcoes de encantamento na mesa e sem aceitar novos encantamentos pela bigorna.
- Uma adaga gerada por loot como item ja encantado, por exemplo com Afiacao IV nas Subfases 2/3, deve manter brilho/encantamento e aplicar o dano do encantamento.

Teste temporario de loot encantado:

- Com cheats/comandos habilitados no mundo de teste Android, execute: `/scriptevent arise:debug_blade_loot`
- Resultado esperado: o chat mostra que a Adaga Sombria de teste foi entregue com Afiacao IV, e o item aparece com brilho/encantamento.
- Se o chat mostrar que `sword/value 0` recusou Afiacao IV por API de loot/script, o Caminho B falhou e a solucao precisa mudar antes das Subfases 2/3.
- Depois, compare com `/give @s arise:blade_shadow`: a adaga base nao deve oferecer encantamento na mesa nem aceitar encantamento novo pela bigorna.
