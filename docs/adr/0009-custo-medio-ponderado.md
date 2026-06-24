# ADR-0009 — Custo médio ponderado por livro

**Status**: Aceito · **Data**: 2026-06-23

## Contexto
A entrada de mercadoria (compra) é uma tela própria com fornecedor e custo (spec 002 FR-010..015). O
usuário pode informar o custo **total** ou **unitário** da linha. Para servir de base a margem futura, o
sistema precisa valorizar o estoque sem complexidade de FIFO/lotes (KISS/YAGNI, Princípio II).

## Decisão
Cada livro mantém `custo_medio_centavos`, recalculado **apenas em entrada**:
`novo = round_half_up((estoque × medio_atual + qtd × custo_unit) / (estoque + qtd))`, em centavos i64.
Ajuste e contagem de inventário **não** alteram o custo médio; `saldo_inicial` entra com custo médio 0
(legado sem custo). Na tela, informar total **ou** unitário — o domínio deriva o outro
(`unit = round_half_up(total/qtd)` ou `total = unit × qtd`); persiste-se o **custo unitário** no movimento
de entrada. Dinheiro sempre em centavos (ADR-0005).

## Consequências
- (+) Valorização padrão e suficiente, determinística (half-up documentado).
- (+) Independe de rastrear lotes/FIFO.
- (−) Custo médio é valorização derivada; com arredondamento inteiro não reconcilia centavo-a-centavo com
  o histórico de compras — aceitável, pois não afeta a invariante de **quantidade** (SC-001).

## Alternativas
FIFO/lotes (complexidade não pedida — rejeitado). Guardar só o custo da última compra (menos fiel para
margem — rejeitado).
