# Data Model — 014 Ajustar estoque a partir do cadastro do livro

**Sem mudança de esquema** (nem na nuvem, nem no SQLite). A feature usa entidades existentes e
acrescenta uma regra de validação.

## Livro (`livro`, existente)

| Campo | Uso nesta feature |
|---|---|
| `sync_uid` | identidade do livro na tela "Alterar livro" e no ajuste |
| `excluido_em` | livro excluído não aparece no Cadastro (sem mudança) |

A linha do livro é travada (`for update`) pela guarda durante o insert de um ajuste.

## Movimento de estoque (`movimento_estoque`, existente)

| Campo | Valor num ajuste do Cadastro/Pesquisa |
|---|---|
| `sync_uid` | uuid novo por clique em "Aplicar" |
| `livro_uid` | `livro.sync_uid` |
| `tipo` | `ajuste` |
| `qtd` | inteiro com sinal, ≠ 0 |
| `motivo` | texto livre, obrigatório, sem espaços nas pontas |
| `origem` | `escritorio` |
| `criado_por` | usuário autenticado |
| `criado_em` | momento do ajuste |

## Saldo oficial (`vw_saldo_livro`, existente)

`saldo = Σ qtd` dos movimentos não excluídos do livro. Lido pela lista do Cadastro, pela Pesquisa e
agora pela tela "Alterar livro".

## Regra de validação do ajuste (nova, domínio)

`validar_ajuste(saldo_atual, delta, motivo)`:

| Ordem | Condição | Resultado |
|---|---|---|
| 1 | `delta == 0` | `AjusteSemQuantidade` (`AJUSTE_SEM_QUANTIDADE`) |
| 2 | `motivo.trim()` vazio | `MotivoObrigatorio` (`MOTIVO_OBRIGATORIO`) |
| 3 | `saldo_atual + delta < 0` | `EstoqueNegativo` (`ESTOQUE_NEGATIVO`) |
| — | caso contrário | `Ok(saldo_atual + delta)` (zero é aceito) |

A guarda da nuvem reaplica só a condição 3, com o saldo oficial do momento do insert.
