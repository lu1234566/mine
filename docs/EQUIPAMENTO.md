# ARISE - Equipamento

## Subfase 1 - Adagas

Ids usados:

- `arise:blade_shadow` - Adaga Sombria
- `arise:blade_serpent` - Adaga da Serpente
- `arise:blade_monarch` - Adaga do Monarca
- `arise:blade_headsman` - Adaga do Algoz
- `arise:blade_void` - Adaga do Vazio

As cinco variantes sao cosmeticas nesta subfase. Todas usam os mesmos stats base e os valores por variante ficam preparados em `CONFIG.BLADES` para balanceamento futuro.

## Encantamento

- As adagas declaram `minecraft:enchantable` com `slot: "sword"` e `value: 0`.
- `value: 0` bloqueia a mesa de encantamentos: a adaga nao e encantavel pela mesa.
- A bigorna com livro encantado e o metodo pretendido de encantamento da adaga. A escassez vem da raridade dos livros encantados, que sera controlada por loot nas proximas subfases.
- A Script API consegue aplicar encantamentos na adaga e esse caminho fica reservado para loot controlado, especialmente recompensas de portoes na Subfase 3.

## Stats

- Dano base: 8, acima da espada de diamante indicada na spec.
- Durabilidade: 1200.
- Bônus furtivo: ao acertar com a adaga enquanto o jogador esta agachado, aplica dano extra por script com multiplicador de `CONFIG.BLADES`.

## Limite de velocidade

- A documentacao oficial expoe `minecraft:cooldown` com `type: "attack"` para velocidade/cooldown de arma, mas esse campo exige `format_version` 1.21.130. O projeto esta em 1.21.0, entao a Subfase 1 nao declara velocidade de ataque para manter compatibilidade com a base estavel atual.

## Sanidade para Android

- `/give @s arise:blade_shadow` deve entregar a adaga base com icone e nome corretos.
- A mesa de encantamentos nao deve encantar a adaga.
- A bigorna deve aceitar fusao com livro encantado compativel, como Afiacao.
- O dano base deve superar a espada de diamante.
- Agachar e acertar um mob deve disparar o bonus furtivo.
- A durabilidade deve cair com uso.
