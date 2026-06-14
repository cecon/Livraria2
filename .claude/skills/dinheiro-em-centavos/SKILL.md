---
name: dinheiro-em-centavos
description: Ao lidar com valores monetários neste projeto (preços, totais, pagamentos, troco, relatórios), use SEMPRE inteiro de centavos (i64 no Rust, number de centavos no TS) — nunca float. Use ao adicionar campos de dinheiro, parsear entrada R$, somar/conferir valores ou criar DTOs.
---

# Dinheiro é sempre centavos (inteiro)

**Regra (ADR-0005):** todo valor monetário é inteiro de **centavos**. Float (`f64`/REAL/`number`
decimal) é **proibido** para dinheiro — acumula erro de arredondamento e quebra a reconciliação exata
exigida pelo SC-004 (Σ formas de pagamento = Σ totais, R$ 0,00).

## Como aplicar
- Rust: tipo `domain::dinheiro::Dinheiro` (envolve `i64` de centavos). Use `Dinheiro::de_centavos`,
  `.centavos()`, `.soma`, `.diferenca_piso_zero`, `parse_brl`, `to_brl`.
- Colunas SQLite: `*_centavos INTEGER`.
- DTOs/IPC: trafegam `centavos: i64`/`number`. Formate para `R$ 1.234,56` só na borda (UI) com
  `lib/format.ts::brl` ou `Dinheiro::to_brl`.
- Entrada do usuário (pt-BR, vírgula decimal): `Dinheiro::parse_brl` / `parseBrlParaCentavos`.
- Importação do legado (float "30.0000"): converta com `valor_para_centavos` (× 100, arredonda).

## Erro a evitar
Nunca fazer `preco * quantidade` em float, nem armazenar `REAL`. Se vir `f64`/`REAL`/`toFixed` ligado a
dinheiro, troque por centavos inteiros.
