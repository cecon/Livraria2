# ADR-0005 — Dinheiro como inteiro em centavos

**Status**: Aceito · **Data**: 2026-06-14

## Contexto
SC-004 exige reconciliação **exata** (R$ 0,00) entre formas de pagamento e totais. O legado guarda valores
como `Currency`/`Double` (float), sujeito a erro de arredondamento.

## Decisão
Representar **todo valor monetário como inteiro de centavos (`i64`)** no domínio e no banco. Formatar para
pt-BR (`R$ 1.234,56`) só na borda (UI); parsing aceita vírgula decimal. Import multiplica por 100 e
arredonda.

## Consequências
- (+) Somas e conferências exatas; elimina drift de float (SC-004).
- (+) Simples (2 casas fixas) — sem dependência de biblioteca decimal.
- (−) Conversão na fronteira de UI e na importação do legado (explícita, testável).

## Alternativas
`f64`/REAL (erro de arredondamento — rejeitado). Decimal de precisão arbitrária (overkill — YAGNI).
