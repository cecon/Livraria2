# Quickstart — validação da feature 012 (PDV responsabilidade reduzida — fase 2)

Cenários executáveis que provam cada história. Detalhes de contrato em [contracts/](./contracts/);
modelo em [data-model.md](./data-model.md).

## Pré-requisitos

- Fase 1 em produção (migrações `0011`/`0012`/`0013`; triggers de venda pronta/cancelamento; `0012`
  republicando). Migração nova `0014` aplicada em homologação.
- PDV atualizado (build da fase 2) + retaguarda atualizada.

## US1 — Venda/cancelamento como fatos; a nuvem contabiliza

- **SC-001/SC-002**: vender 1x de um livro no PDV → no sync, a nuvem cria `saida_venda`, o saldo oficial
  cai e é republicado; o "saldo op." no PDV converge. **Cancelar** essa venda no PDV → o pedido
  re-sincroniza (`sincronizado_em` volta a NULL), a nuvem cria `estorno_venda`, o saldo volta e
  republica; o "saldo op." converge.
- **SC-004**: o PDV **não** empurra `saida_venda`/`estorno` (verificar na nuvem: 0 movimentos de venda
  com origem PDV).
- **Offline**: repetir sem internet → venda/cancelamento registram localmente e o saldo operacional
  reflete os fatos pendentes; ao reconectar, a nuvem contabiliza.

## US2 — Cadastros somente-leitura no PDV

- **SC-003**: no PDV atualizado, não há ação de criar/editar/excluir fornecedor, forma de pagamento ou
  destinação. Editar uma forma de pagamento na retaguarda → aparece no PDV no próximo sync. Concluir uma
  venda escolhendo a forma (uso, não edição).

## US3 — Entrada de nota apenas na nuvem

- **SC-005**: lançar uma nota de entrada na retaguarda (RPC `lancar_entrada`) → o saldo oficial sobe e é
  republicado → o PDV mostra o novo saldo. No PDV, a função de lançar entrada não existe. Re-aplicar a
  mesma nota é idempotente (sem duplicar entrada).

## US4 — Inventário apenas na nuvem

- **SC-005**: registrar a contagem de um item na retaguarda (RPC `ajustar_inventario`) com valor
  diferente do saldo → cria `ajuste` (delta) → saldo reflete a contagem → republica. No PDV, o
  inventário não existe. Re-enviar a mesma contagem não duplica o ajuste.

## US5 — Dashboard = lista de vendas do turno aberto

- **SC-006**: com turno aberto e vendas, a tela inicial do PDV mostra a lista de vendas do turno (número,
  valor, hora, situação) — sem indicadores de estoque legados. Sem turno aberto → estado vazio orientando
  a abrir o turno.

## Destinar (D6)

- Mover quantidade entre "livre" e uma destinação na retaguarda (RPC `destinar_estoque`) → os saldos por
  destinação mudam (total inalterado) e são republicados; o PDV lê os saldos, sem oferecer a operação.

## Portões finais

- `cargo test` (domínio: janela de cancelamento, saldo operacional).
- `apps/nuvem/tests/0014_*.sql` (idempotência de `lancar_entrada`/`ajustar_inventario`/`destinar_estoque`
  + republicação).
- `npm run build -w apps/escritorio`.
- Constituição: `scripts/check-file-size.sh` nos arquivos novos (≤300 linhas).
