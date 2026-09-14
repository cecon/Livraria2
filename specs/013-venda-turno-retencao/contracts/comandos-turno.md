# Contrato — Comandos Tauri de turno & venda (PDV)

Base: `src-tauri/src/commands_turno.rs` (`turno_aberto`, `turno_abrir`, `turno_encerrar`,
`turno_resumo`, `turno_listar`, `vendas_do_turno`) e `commands.rs` (`registrar_venda`,
`excluir_pedido`). DTOs em camelCase. Erros como `ErroDto { codigo, mensagem }`.

## Abrir / continuar turno (FR-017)
`turno_abrir(operador, caixaInicialCentavos) -> TurnoDto`
- Se **já há** turno aberto: retorna-o (continua), **não** abre outro.
- Senão: abre novo com `maquina` = hostname (porta `Maquina`), `operador`, `abertura` = agora.
- `TurnoDto { syncUid, maquina, operador, status, abertura, ... }`.

## Estado do turno (header + gate)
`turno_aberto() -> Option<TurnoDto>`
- `None` ⇒ o front aplica o **bloqueio incisivo** da janela de venda (FR-002) e header "sem turno".
- Inclui idade para o **aviso de turno esquecido** (FR-023): `abertura` < virada do dia ⇒ alertar.

## Encerrar turno
`turno_encerrar(conferidoCentavos) -> FechamentoDto`
- `status` → `'encerrado'`; grava `encerramento`, `esperado/conferido/diferenca`.
- Libera abrir novo turno.

## Vendas do turno aberto (FR-022)
`vendas_do_turno() -> Vec<PedidoRelatorioDto>`
- **Só** as vendas do turno **aberto**, no formato da lista do relatório (reusa `PedidoRelatorio`).
- Sem turno aberto ⇒ vazio.

## Registrar venda (FR-001/002)
`registrar_venda(input) -> ...`
- **Pré-condição**: existe turno aberto (`pode_registrar_venda`). Senão ⇒ `ErroDto { codigo: "SEM_TURNO" }`.
- Grava `turno_uid` (do aberto) + `numero_no_turno` (`proximo_numero` pela contagem do turno).
- "Pedido Nº" exibido = `numero_no_turno`.

## Cancelar venda (FR-003)
`excluir_pedido(numero) -> ...`
- **Pré-condição**: o pedido pertence ao **turno aberto** (`pode_cancelar`). Senão ⇒
  `ErroDto { codigo: "TURNO_FECHADO", mensagem: "corrija no escritório" }`.
- Efeito: `cancelado=1`, `sincronizado_em=NULL` (re-push); **mantém** `ja_sincronizado`.
