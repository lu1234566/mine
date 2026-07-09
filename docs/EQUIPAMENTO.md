# ARISE - Equipamento

## Subfase 1 - Adagas

Ids usados:

- `arise:blade_shadow` - Adaga Sombria
- `arise:blade_serpent` - Adaga da Serpente
- `arise:blade_monarch` - Adaga do Monarca
- `arise:blade_headsman` - Adaga do Algoz
- `arise:blade_void` - Adaga do Vazio

Componentes de item:

- `minecraft:enchantable` com `slot: "sword"` permite encantamentos vanilla de espada, como Afiacao, Saque e Aspecto Flamejante. Durabilidade e Remendo dependem do item ter `minecraft:durability`.
- `minecraft:damage` define dano 8, acima da espada de diamante indicada na spec.
- `minecraft:durability` define durabilidade 1200 e perda de durabilidade no uso.

Limite de velocidade:

- A documentacao oficial expoe `minecraft:cooldown` com `type: "attack"` para velocidade/cooldown de arma, mas esse campo exige `format_version` 1.21.130. O projeto esta em 1.21.0, entao a Subfase 1 nao declara velocidade de ataque para manter compatibilidade com a base estavel atual.

Bônus furtivo:

- A API estavel nao oferece uma forma robusta de saber se o alvo esta "de costas" em todos os casos. A Subfase 1 usa o proxy da spec: se o jogador estiver agachado no momento do acerto com uma adaga, aplica dano extra por script.
