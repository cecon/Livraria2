# Contracts — Tauri Commands (invoke API): Fornecedores & Lançamentos

Comandos da feature 003, na mesma fronteira das 001/002. UI React via `invoke(nome, args)`. Retornam
`Result<T, ErroApp>` (erro = `{ codigo, mensagem }`). **Dinheiro em centavos i64**; datas ISO. DTOs em
**camelCase**. A forma exata é fixada na implementação.

## Convenções de erro (novos códigos)
`NOME_OBRIGATORIO` (fornecedor sem nome), `FORNECEDOR_DUPLICADO` (nome_norm já existe),
`SEM_FORNECEDOR` (finalizar sem fornecedor), `SEM_ITENS` (finalizar sem itens),
`QTD_INVALIDA`, `NOTA_FINALIZADA` (tentar editar/finalizar nota já finalizada).

## Fornecedores (US1)
| Comando | Args | Retorno |
|---|---|---|
| `fornecedores_listar` | `{ termo?: string }` | `Fornecedor[]` (ativos; busca por nome) |
| `fornecedor_salvar` | `{ fornecedor: FornecedorInput }` | `Fornecedor` (cria/edita) |
| `fornecedor_excluir` | `{ id }` | `void` (soft-delete) |

`FornecedorInput`: `{ id?: number, nome, documento?, telefone?, email?, observacoes? }`. Regras: `nome`
obrigatório (`NOME_OBRIGATORIO`); `nome_norm` único (`FORNECEDOR_DUPLICADO`).

## Lançamentos / Notas (US2, US3, US4)
| Comando | Args | Retorno |
|---|---|---|
| `lancamentos_listar` | `{}` | `LancamentoResumo[]` (fornecedor, data, status, total, qtdItens) |
| `lancamento_obter` | `{ id }` | `LancamentoDetalhe` (cabeçalho + itens) |
| `lancamento_criar` | `{ fornecedorId?: number }` | `LancamentoDetalhe` (novo rascunho) |
| `lancamento_definir_fornecedor` | `{ id, fornecedorId, numero?: string }` | `void` (só rascunho) |
| `lancamento_adicionar_item` | `{ id, codigo, qtd, custoTotalCentavos?, custoUnitCentavos? }` | `LancamentoDetalhe` |
| `lancamento_remover_item` | `{ id, itemId }` | `LancamentoDetalhe` |
| `lancamento_excluir` | `{ id }` | `void` (só rascunho; não afeta estoque) |
| `lancamento_finalizar` | `{ id }` | `LancamentoDetalhe` (status finalizada) |

- `lancamento_adicionar_item`: localiza o livro por `codigo` (código de barras OU código, FR-022/002);
  deriva custo (total↔unitário); se o livro já está na nota, **soma** a qtd (`UNIQUE`).
- `lancamento_finalizar`: exige fornecedor (`SEM_FORNECEDOR`) e ≥1 item (`SEM_ITENS`); gera os movimentos
  `entrada` (referência = id da nota) e atualiza estoque/custo médio; idempotente (nota já finalizada →
  `NOTA_FINALIZADA` ou no-op retornando o detalhe).
- Editar uma nota finalizada (definir fornecedor/itens) → `NOTA_FINALIZADA`.

### DTOs (camelCase)
- `Fornecedor`: `{ id, nome, documento?, telefone?, email?, observacoes?, ativo }`.
- `LancamentoResumo`: `{ id, fornecedorNome?, data, status, totalCentavos, qtdItens }`.
- `LancamentoDetalhe`: `{ id, fornecedorId?, fornecedorNome?, numero?, data, status, totalCentavos, itens: ItemNota[] }`.
- `ItemNota`: `{ itemId, codigo, titulo, qtd, custoUnitCentavos, subtotalCentavos }`.
