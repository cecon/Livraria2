# ADR-0026 — Ajuste manual de estoque nunca deixa o saldo negativo

**Status**: Aceito · **Data**: 2026-10-16 · **Relaciona**: [ADR-0008](0008-razao-movimentos-estoque.md),
[ADR-0018](0018-baixa-venda-limitada-ao-estoque-cacheado.md), [ADR-0022](0022-escritorio-reusa-dominio-wasm.md),
[ADR-0023](0023-estoque-oficial-nuvem-venda-pronta.md)

## Contexto
A feature 014 leva o "Ajustar estoque" para a tela "Alterar livro" do Cadastro do escritório. Na
clarificação decidiu-se que um **ajuste manual** que deixaria o saldo abaixo de zero é **recusado**
(FR-012) — no Cadastro e na Pesquisa. Até aqui o ajuste avulso era um insert direto em
`movimento_estoque` sem nenhuma checagem. O estorno de nota de entrada cancelada também grava um
movimento `ajuste` (origem `escritorio`), mas **não** deve ser afetado.

## Decisão
1. **Regra no domínio**: `estoque::validar_ajuste(saldo, delta, motivo) -> Result<i64, ErroDominio>`
   (delta 0 → `AJUSTE_SEM_QUANTIDADE`; motivo vazio → `MOTIVO_OBRIGATORIO`; saldo + delta < 0 →
   `ESTOQUE_NEGATIVO`). Exposta ao escritório via WASM (`validar_ajuste_estoque`) para retorno
   imediato — o escritório não reimplementa a regra (ADR-0022).
2. **Guarda na nuvem**: gatilho `BEFORE INSERT` em `movimento_estoque` (migração `0016`) ativo só para
   `tipo='ajuste' and origem='escritorio' and referencia='ajuste_manual'`. Trava a linha do livro
   (`for update`), soma os movimentos e recusa com `ESTOQUE_NEGATIVO` (saldo atual no `detail`).
3. **Marcador explícito**: `registrarAjuste` grava `referencia='ajuste_manual'` (mesmo padrão do
   inventário, `referencia='inventario'`). Estorno de nota, inventário, venda e movimentos vindos por
   sync não têm o marcador e não são afetados.

## Consequências
- (+) Saldo oficial nunca fica negativo por ajuste manual, nem com dois ajustes simultâneos.
- (+) Uma regra só para Cadastro e Pesquisa; a Pesquisa passa a recusar negativo.
- (−) DRY parcial: a condição "saldo + delta ≥ 0" existe no domínio e na guarda SQL. Justificado: o
  domínio é a regra testável e dá retorno imediato; só a nuvem enxerga o saldo oficial no instante do
  insert.
- (−) Risco residual aceito: a baixa de venda (0011) não usa a mesma trava; uma venda simultânea a um
  ajuste ainda pode, em tese, levar o saldo abaixo de zero. Ajustes são raros e a baixa de venda já é
  limitada ao saldo (ADR-0018).

## Alternativas rejeitadas
RPC `registrar_ajuste` (muda o contrato e duplica o insert); validar só no cliente (corrida entre
ajustes); só no SQL (regra fora do domínio, Princípio I); filtrar o estorno pelo texto do motivo
(frágil); travar também a baixa de venda (mexe no caminho crítico de venda).
