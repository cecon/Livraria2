# Contrato — Operações na nuvem (Supabase) por caso de uso

Implementadas em `apps/escritorio/lib/nuvem/{turno,venda,inventario,relatorios}.ts` com supabase-js. Padrão
herdado da 008: upsert por `sync_uid` (`crypto.randomUUID()`), LWW por `atualizado_em`, soft-delete via
`excluido_em`, `origem="escritorio"`, `criado_por` = usuário autenticado. Saldo derivado de `movimento_estoque`.
Todas exigem **sessão autenticada** (RLS `to authenticated`).

## Turno (`lib/nuvem/turno.ts`)

| Operação | Efeito | Regra/gate |
|---|---|---|
| `abrirTurno(caixaInicial?)` | insere `turno_operacao` (status `aberto`, operador = usuário) | **falha se já há turno `aberto` do operador nesta origem** (D7) |
| `turnoAberto()` | lê o turno `aberto` do operador (ou `null`) | — |
| `contarPedidosDoTurno(turnoUid)` | `count` de `pedido` com `turno_uid` | alimenta `turno_proximo_numero` |
| `encerrarTurno(turnoUid, conferidoDinheiro)` | lê pagamentos do turno → `turno_resumir_fechamento` + `turno_encerrar` (WASM) → grava `status=encerrado` + esperado/conferido/diferença | não bloqueia se diferença ≠ 0 |
| `listarTurnos()` | histórico de turnos + fechamentos | — |

## Venda (`lib/nuvem/venda.ts`)

Pré-condição: **turno aberto** (`turno_pode_registrar_venda`). Ao concluir:

1. `validar_conclusao_venda(itens, pagamentos, dinheiroFormaId)` (WASM) — aborta com o erro do domínio.
2. `numeroNoTurno = turno_proximo_numero(contarPedidosDoTurno(turnoUid))`.
3. Para cada item: `qtdBaixa = clamp_baixa_venda(qtd, saldo)` (saldo via `recompor_ledger`/`vw_saldo_livro`).
4. Grava (ordem por FK `sync_uid`): `pedido { numero (global), numero_no_turno, turno_uid, operador_uid,
   cliente, turno (Manhã/Tarde por hora), data, total_centavos }` → `item_pedido[]` → `pagamento_pedido[]` →
   `movimento_estoque` (saída de venda, `qtd=qtdBaixa`) → `alocacao_venda`.
5. Retorna `{ numeroNoTurno, totalCentavos, trocoCentavos }` (troco via `troco_venda`).

`listarVendasDoDia()` — lista/edita as vendas do dia (paridade com a aba "Lista de vendas" do PDV).

## Inventário (`lib/nuvem/inventario.ts`) — sessão client-side

| Operação | Efeito |
|---|---|
| sessão (abrir/contar/desfazer) | **estado no cliente** (`localStorage`), modo `parcial`/`total`; usa `EntradaProduto` p/ bipar por código/câmera |
| `saldosParaContagem(codigos?)` | lê saldos correntes (derivados) dos livros a conferir |
| fechamento | por livro: `contagem_efetiva(modo, contada)` → `diferenca_contagem(sistema, efetiva)` (WASM); `resumir` p/ o resumo |
| `aplicarAjustes(ajustes)` | grava um `movimento_estoque` tipo **ajuste** por livro com diferença ≠ 0 |

Sem tabelas de inventário na nuvem (D5). Os ajustes sincronizam para o PDV.

## Relatórios — export (`lib/nuvem/relatorios.ts`, pendência 008/US4)

| Ação | Implementação (cliente) |
|---|---|
| Exportar Excel | gera `.xlsx` das linhas já carregadas (sem endpoint novo) |
| Exportar PDF | impressão para PDF reaproveitando `@media print` (folha existente) |
| WhatsApp | resumo textual via `https://wa.me/?text=<resumo>` |

Mesmos números do PDV (mesmas queries/domínio). Sem `service_role`, sem edge function nova (D13).
