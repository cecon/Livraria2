# ADR-0011 — Fornecedores e lançamento de entrada por nota

**Status**: Aceito · **Data**: 2026-06-24

## Contexto
A entrada de mercadoria da feature 002 é de um livro por vez, com fornecedor em texto livre e aplicação
imediata. A livraria recebe remessas por fornecedor com vários títulos. Precisa-se de fornecedores
formais e de notas multi-item com possibilidade de salvar incompleto (spec 003).

## Decisão
Introduzir `fornecedor` (com `nome_norm` único, soft-delete) e a nota `lancamento_entrada` +
`item_lancamento` (`UNIQUE(lancamento, livro)`). A nota é **rascunho retomável**: criar/editar/excluir sem
tocar no estoque. **Dar entrada** finaliza a nota numa **única transação**, gerando um movimento `entrada`
por item (`referencia` = id da nota, `fornecedor` = nome) e recalculando o custo médio — **reusando a razão
de movimentos e o custo médio da feature 002** (ADR-0008/0009). Finalização é **idempotente**; nota
finalizada é imutável (correções via Ajuste/Inventário). Fornecedores são semeados, de forma idempotente, a
partir dos textos de fornecedor já gravados nos movimentos da 002. A tela de "Entrada de 1 livro" é
**removida**; entrada avulsa vira nota de 1 item.

## Consequências
- (+) Padroniza fornecedores; agrupa entradas por nota; preserva a invariante `Σ movimentos == estoque`.
- (+) Reuso total do ledger/custo médio — sem reimplementar regra de estoque.
- (−) Mais três tabelas e telas; a entrada deixa de ser de aplicação imediata (passa por finalizar).

## Alternativas
Manter texto livre de fornecedor (não padroniza — rejeitado). Recebimento parcial por item (descartado na
clarificação — só rascunho retomável). Religar movimentos históricos a `fornecedor_id` (backfill arriscado
sem ganho — rejeitado).
