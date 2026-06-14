# ADR-0006 — Import do legado Access via mdbtools (upsert idempotente)

**Status**: Aceito · **Data**: 2026-06-14

## Contexto
Fonte de dados: Access `../Livraria/livraria.mdb` (tabelas `cadastro`, `venda`, `usuario`). Durante a
transição os dois sistemas convivem; a importação deve ser **re-executável** (Clarifications Q1/Q3,
Princípio IV). Não há leitor `.mdb` puro-Rust maduro; `mdbtools` está disponível no ambiente.

## Decisão
O adapter `legado/mdb_importer.rs` lê o `.mdb` chamando **mdbtools** (`mdb-export`) como subprocesso e
aplica **upsert** por chave estável (livro: código de barras; pedido: número). Vendas desnormalizadas são
**reconstruídas** em `pedido`+`item_pedido`; split de pagamento derivado de `vdmetodo` quando ausente.
Registros criados no novo sistema são **preservados**. Gera **relatório de migração** com divergências.

## Consequências
- (+) Re-sync seguro na transição; sem duplicar (SC-009).
- (+) Sane dados sujos (categorias, métodos) com defaults logados.
- (−) Dependência de `mdbtools` na máquina de import (transição/dev) — documentada.
- (−) Mapa de `vdmetodo`/`vdturma` a validar contra amostra real antes do corte.

## Alternativas
Conversão única `.mdb`→SQLite (não cobre re-sync — rejeitado). Arquivo read-only ou só-totais (usuário
preferiu reconstrução normalizada — rejeitado).
