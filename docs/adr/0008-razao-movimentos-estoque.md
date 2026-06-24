# ADR-0008 — Razão de movimentos como fonte da verdade do estoque

**Status**: Aceito · **Data**: 2026-06-23

## Contexto
Até a feature 001 o estoque era um único inteiro mutável em `livro.estoque`: a venda decrementava e o
cadastro sobrescrevia, sem trilha de **por que** o número mudou. A feature 002 precisa de entrada de
mercadoria, ajuste e inventário com auditoria e reconciliação exata (spec 002 FR-001..006, SC-001).

## Decisão
Introduzir a tabela **`movimento_estoque`** (append-only, imutável): cada alteração vira um movimento com
sinal e tipo (`saldo_inicial`, `entrada`, `saida_venda`, `ajuste`, `contagem`). O `livro.estoque` passa a
ser um **saldo materializado** (cache) mantido na mesma transação do movimento. Invariante:
`estoque == Σ qtd dos movimentos do livro` (SC-001). Movimentos nunca são editados/excluídos; correções
são novos movimentos (FR-005). Na adoção, gera-se um movimento `saldo_inicial` por livro de forma
**idempotente** em runtime (só para livros sem movimento), preservando o histórico de vendas sem retroação
(FR-004/FR-006).

## Consequências
- (+) Auditoria permanente; entrada/venda/ajuste/contagem unificados num só mecanismo.
- (+) Inventário trivial (diferença vira movimento `contagem`).
- (−) Toda mutação de estoque passa a inserir movimento + atualizar saldo na mesma transação.

## Alternativas
Só campo mutável + tela de ajuste (sem histórico — rejeitado). Saldo puramente derivado sem cache
(recomputar soma a cada leitura — custo desnecessário no balcão — rejeitado).
